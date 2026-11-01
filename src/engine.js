(function (root) {
  'use strict';
  const periods = { '1H': 3600000, '4H': 14400000, '1D': 86400000, '1S': 604800000 };
  const profiles = ['Estável', 'Alta gradual', 'Baixa gradual', 'Volátil', 'Reversão', 'Rompimentos'];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function hash(text) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 || 1; }
  function random(seed) { let x = seed >>> 0; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
  function positive(n) { return Number.isFinite(n) && n > 0; }
  class Engine {
    constructor(coins, snapshot, now = Date.now()) {
      this.coins = coins.map(c => ({ ...c, basePrice: c.price }));
      this.clock = now; this.lastAt = now; this.speed = 1; this.paused = false;
      this.events = []; this.log = []; this.sequence = 0; this.states = {};
      for (let i = 0; i < this.coins.length; i++) this.resetCoin(this.coins[i].symbol, i);
      if (snapshot) this.restore(snapshot, now);
    }
    coin(symbol) { const c = this.coins.find(c => c.symbol === symbol); if (!c) throw Error('Moeda inválida.'); return c; }
    resetCoin(symbol, index) {
      const c = this.coin(symbol), i = index ?? this.coins.indexOf(c);
      const config = { profile: i % profiles.length, volatility: 1, trend: 0, frozen: false };
      const s = { config, rng: hash(symbol), momentum: 0, series: {}, trades: [] };
      c.price = c.basePrice;
      for (const [period, span] of Object.entries(periods)) {
        const rng = random(hash(symbol + period)), bars = [], count = 90, step = span / count;
        let p = c.price, momentum = 0;
        for (let j = 0; j < count; j++) {
          const open = p, vol = (i < 3 ? .003 : .01 + (i % 7) * .003) * Math.sqrt(span / periods['1D']);
          momentum = momentum * .6 + (rng() - .5) * vol;
          let drift = config.profile === 1 ? vol * .25 : config.profile === 2 ? -vol * .25 : 0;
          if (config.profile === 4) drift = Math.log(c.basePrice / p) * .08;
          const jump = config.profile === 5 && rng() < .06 ? (rng() - .35) * vol * 15 : 0;
          p = Math.max(1e-12, p * Math.exp(momentum + (rng() - .5) * vol * (config.profile === 3 ? 4 : 1) + drift + jump));
          bars.push({ time: this.clock - (count - 1 - j) * step, open, close: p, high: Math.max(open, p) * (1 + rng() * vol), low: Math.min(open, p) / (1 + rng() * vol), volume: 100 + rng() * 1000 });
        }
        const factor = c.price / p;
        for (const b of bars) for (const key of ['open', 'close', 'high', 'low']) b[key] *= factor;
        s.series[period] = bars;
      }
      this.states[symbol] = s; this.refresh(c);
    }
    nextRandom(s) { let x = s.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.rng = x >>> 0 || 1; return s.rng / 4294967296; }
    refresh(c) {
      const bars = this.states[c.symbol].series['1D'];
      c.change = (c.price / bars[0].open - 1) * 100;
      c.cap = c.price * (this.coins.indexOf(c) < 3 ? 14000000 : 980000000);
      c.volume = bars.reduce((sum, b) => sum + b.volume, 0) * 120;
    }
    record(c, now, amount = 0) {
      const s = this.states[c.symbol];
      for (const [period, span] of Object.entries(periods)) {
        const bars = s.series[period], step = span / 90;
        if (this.clock - bars.at(-1).time >= step) {
          const previous = bars.at(-1).close;
          bars.push({ time: this.clock, open: previous, close: previous, high: previous, low: previous, volume: 0 });
          if (bars.length > 90) bars.shift();
        }
        const b = bars.at(-1); b.close = c.price; b.high = Math.max(b.high, c.price); b.low = Math.min(b.low, c.price); b.volume += amount;
      }
      this.refresh(c);
    }
    tick(now = Date.now()) {
      const seconds = clamp((now - this.lastAt) / 1000, 0, 30); this.lastAt = now;
      const dt = this.paused ? 0 : seconds * this.speed; this.clock += dt * 1000;
      for (const c of this.coins) {
        const s = this.states[c.symbol];
        if (dt > 0 && !s.config.frozen) {
          const rng = () => this.nextRandom(s), i = this.coins.indexOf(c), cfg = s.config;
          const vol = (i < 3 ? .0006 : .0015 + (i % 7) * .0006) * cfg.volatility;
          s.momentum = s.momentum * .72 + (rng() - .5) * vol * .45;
          let drift = cfg.profile === 1 ? vol * .12 : cfg.profile === 2 ? -vol * .12 : 0;
          if (cfg.profile === 4) drift += Math.log(c.basePrice / c.price) * .001;
          const jump = cfg.profile === 5 && rng() < .015 ? (rng() - .4) * vol * 25 : 0;
          const move = (rng() - .5) * vol * (cfg.profile === 3 ? 4 : 1) * Math.sqrt(dt) + s.momentum * Math.sqrt(dt) + drift * dt + cfg.trend / 100 / 60 * dt + jump;
          c.price = clamp(c.price * Math.exp(clamp(move, -.5, .5)), 1e-12, 1e12);
          if (rng() < .45) {
            s.trades.unshift({ time: now, side: move >= 0 ? 'Compra' : 'Venda', price: c.price, amount: 5 + rng() * 2400, trader: 'lab_' + Math.floor(rng() * 100000).toString(16) });
            s.trades = s.trades.slice(0, 30);
          }
        }
        this.record(c, now, dt > 0 && !s.config.frozen ? 5 + this.nextRandom(s) * 35 : 0);
      }
      for (const event of this.events) {
        if (event.status === 'cancelled' || event.status === 'done' || now < event.at) continue;
        const fraction = event.duration === 0 ? 1 : clamp((now - event.at) / event.duration, 0, 1);
        const eased = fraction * fraction * (3 - 2 * fraction);
        const c = this.coin(event.symbol), factor = Math.pow(1 + event.percent / 100, eased - event.applied);
        c.price = clamp(c.price * factor, 1e-12, 1e12); event.applied = eased;
        event.status = fraction === 1 ? 'done' : 'running'; this.record(c, now, Math.abs(event.percent) * 10);
        if (fraction === 1) this.message(`${event.symbol} ${event.percent >= 0 ? 'pump' : 'dump'} ${event.percent}% concluído`, now);
      }
      this.events = this.events.filter(e => ['queued', 'running'].includes(e.status)).concat(this.events.filter(e => ['done', 'cancelled'].includes(e.status) && now - e.at - e.duration < 3600000).slice(-50));
    }
    schedule(symbol, percent, delay = 0, duration = 0, now = Date.now()) {
      this.coin(symbol);
      if (!Number.isFinite(percent) || percent === 0 || percent < -99 || percent > 10000) throw Error('Pump: até 10.000%. Dump: até 99%.');
      if (!Number.isFinite(delay) || delay < 0 || delay > 86400 || !Number.isFinite(duration) || duration < 0 || duration > 3600) throw Error('Espera: 0–86.400s. Duração: 0–3.600s.');
      if (this.events.filter(e => ['queued', 'running'].includes(e.status)).length >= 50) throw Error('Limite de 50 eventos pendentes.');
      const event = { id: ++this.sequence, symbol, percent, at: now + delay * 1000, duration: duration * 1000, applied: 0, status: 'queued' };
      this.events.push(event); this.message(`${symbol} evento #${event.id} ${percent}% · espera ${delay}s · duração ${duration}s`, now);
      if (delay === 0 && duration === 0) { const c = this.coin(symbol); c.price = clamp(c.price * (1 + percent / 100), 1e-12, 1e12); event.applied = 1; event.status = 'done'; this.record(c, now, Math.abs(percent) * 10); this.message(`Evento #${event.id} aplicado`, now); }
      return event;
    }
    cancel(id) { const e = this.events.find(e => e.id === id); if (e && ['queued', 'running'].includes(e.status)) { e.status = 'cancelled'; this.message(`Evento #${id} cancelado; movimentos já aplicados preservados`); } }
    configure(symbol, patch) {
      const cfg = this.states[this.coin(symbol).symbol].config;
      if (patch.profile !== undefined && (!Number.isInteger(patch.profile) || patch.profile < 0 || patch.profile >= profiles.length)) throw Error('Perfil inválido.');
      if (patch.volatility !== undefined && (!Number.isFinite(patch.volatility) || patch.volatility < .1 || patch.volatility > 10)) throw Error('Volatilidade deve estar entre 0,1 e 10.');
      if (patch.trend !== undefined && (!Number.isFinite(patch.trend) || Math.abs(patch.trend) > 100)) throw Error('Tendência: -100 a +100% por minuto.');
      Object.assign(cfg, patch);
    }
    message(text, time = Date.now()) { this.log.unshift({ text, time }); this.log = this.log.slice(0, 60); }
    snapshot() { return { version: 2, clock: this.clock, speed: this.speed, paused: this.paused, sequence: this.sequence, states: this.states, prices: this.coins.map(c => [c.symbol, c.price]), events: this.events, log: this.log }; }
    restore(data, now) {
      try {
        if (data.version !== 2 || !positive(data.clock) || !Array.isArray(data.prices) || data.prices.length !== this.coins.length || !Array.isArray(data.events) || !Array.isArray(data.log)) return;
        for (const c of this.coins) {
          const s = data.states[c.symbol], price = data.prices.find(p => p[0] === c.symbol)?.[1];
          if (!s || !positive(price) || !s.config || !Number.isInteger(s.rng) || !Number.isFinite(s.momentum) || !Array.isArray(s.trades)) return;
          if (!Number.isInteger(s.config.profile) || s.config.profile < 0 || s.config.profile > 5 || !positive(s.config.volatility) || s.config.volatility > 10 || !Number.isFinite(s.config.trend) || Math.abs(s.config.trend) > 100) return;
          for (const period of Object.keys(periods)) if (!Array.isArray(s.series[period]) || s.series[period].length < 2 || s.series[period].length > 90 || s.series[period].some(b => !['time', 'open', 'close', 'high', 'low'].every(k => positive(b[k])) || !Number.isFinite(b.volume) || b.volume < 0)) return;
        }
        if (data.events.some(e => !this.states[e.symbol] || !Number.isFinite(e.percent) || e.percent < -99 || e.percent > 10000 || !Number.isFinite(e.at) || !Number.isFinite(e.duration) || e.duration < 0 || !Number.isFinite(e.applied) || e.applied < 0 || e.applied > 1 || !['queued', 'running', 'done', 'cancelled'].includes(e.status))) return;
        this.states = data.states; this.clock = data.clock; this.speed = clamp(Number(data.speed) || 1, .25, 10); this.paused = !!data.paused;
        this.sequence = Math.max(0, ...data.events.map(e => e.id), Number(data.sequence) || 0); this.events = data.events; this.log = data.log.slice(0, 60); this.lastAt = now;
        for (const c of this.coins) { c.price = data.prices.find(p => p[0] === c.symbol)[1]; this.refresh(c); }
      } catch { /* Corrupt local snapshots are ignored. */ }
    }
  }
  root.Simulation = { Engine, periods, profiles }; if (typeof module !== 'undefined') module.exports = root.Simulation;
})(globalThis);
