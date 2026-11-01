'use strict';
(() => {
  const dialog = $('#ops'), modules = new Set(); let folder = 'runtime';
  for (const c of coins) { const option = document.createElement('option'); option.value = c.symbol; option.textContent = `${c.symbol} / ${c.name}`; $('#ops-coin').append(option); }
  Simulation.profiles.forEach((name, i) => { const o = document.createElement('option'); o.value = i; o.textContent = name; $('#ops-profile').append(o); });
  function current() { return engine.coin($('#ops-coin').value); }
  function loadConfig() { const cfg = engine.states[current().symbol].config; $('#ops-profile').value = cfg.profile; $('#ops-volatility').value = cfg.volatility; $('#ops-trend').value = cfg.trend; }
  function update() {
    if (!dialog.open) return;
    const c = current(), cfg = engine.states[c.symbol].config;
    $('#ops-price').textContent = `${fmt(c.price)} · ${signed(c.change)}`; $('#ops-profile-name').textContent = Simulation.profiles[cfg.profile] + (cfg.frozen ? ' · congelada' : '');
    $('#ops-cash').textContent = fmt(state.cash); $('#ops-freeze').textContent = cfg.frozen ? 'Descongelar moeda' : 'Congelar moeda';
    $('#ops-pause').textContent = engine.paused ? 'Retomar movimento natural' : 'Pausar movimento natural'; $('#module-status').textContent = modules.size ? [...modules].join(' · ') + ' / attached' : 'detached';
    const target = $('#ops-events'); target.replaceChildren();
    const active = engine.events.filter(e => ['queued', 'running'].includes(e.status));
    if (!active.length) { const empty = document.createElement('div'); empty.className = 'ops-empty'; empty.textContent = 'Nenhum evento pendente.'; target.append(empty); }
    for (const e of active) {
      const row = document.createElement('div'); row.className = 'ops-event'; const title = document.createElement('b'); title.textContent = `#${e.id} ${e.symbol} ${e.percent >= 0 ? '+' : ''}${e.percent}%`;
      const status = document.createElement('span'); status.textContent = e.status === 'queued' ? `em ${Math.max(0, (e.at - Date.now()) / 1000).toFixed(1)}s · duração ${e.duration / 1000}s` : `executando · ${(e.applied * 100).toFixed(0)}% aplicado`;
      const cancel = document.createElement('button'); cancel.textContent = 'Cancelar'; cancel.onclick = () => { engine.cancel(e.id); saveMarket(); update(); }; row.append(title, status, cancel); target.append(row);
    }
    const log = $('#ops-log-lines'); log.replaceChildren(); for (const entry of engine.log.slice(0, 12)) { const line = document.createElement('div'); line.textContent = `[${new Date(entry.time).toLocaleTimeString('pt-BR')}] ${entry.text}`; log.append(line); }
  }
  function open() { if (dialog.open) { dialog.close(); return; } if ($('#modal').open) $('#modal').close(); $('#ops-coin').value = selected.symbol; $('#ops-speed').value = engine.speed; loadConfig(); dialog.showModal(); update(); }
  function action(id, fn) { $(id).onclick = () => { $('#ops-error').textContent = ''; try { fn(); saveMarket(); updateQuotes(); update(); } catch (e) { $('#ops-error').textContent = e.message; } }; }
  $('#open-ops').onclick = open; $('#ops-close').onclick = () => dialog.close();
  document.addEventListener('keydown', e => { if (e.altKey && e.code === 'KeyP' && !e.repeat) { e.preventDefault(); open(); } });
  document.querySelectorAll('[data-folder]').forEach(b => b.onclick = () => { folder = b.dataset.folder; document.querySelectorAll('[data-folder]').forEach(x => x.classList.toggle('selected', x === b)); });
  action('#inject', () => { (folder === 'runtime' ? ['market', 'wallet', 'scheduler'] : [folder]).forEach(m => modules.add(m)); $('#ops-welcome').hidden = true; $('#ops-controls').hidden = false; document.querySelectorAll('[data-module]').forEach(card => card.hidden = !modules.has(card.dataset.module)); engine.message(`runtime.attach /${folder} · controles locais ativados`); });
  $('#ops-coin').onchange = () => { loadConfig(); update(); };
  action('#ops-go', () => { selected = current(); render(); dialog.close(); });
  function event(direction) {
    const percent = Number($('#ops-percent').value); if (!Number.isFinite(percent) || percent <= 0) throw Error('Informe uma variação maior que zero.');
    const delay = Number($('#ops-delay').value), duration = Number($('#ops-duration').value);
    if ((delay > 0 || duration > 0) && !modules.has('scheduler')) throw Error('Ative scheduler/ ou runtime/ para usar eventos no tempo.');
    engine.schedule(current().symbol, direction * percent, delay, duration); toast(delay > 0 ? 'Evento agendado.' : duration > 0 ? 'Movimento iniciado.' : 'Preço atualizado.');
  }
  action('#ops-pump', () => event(1)); action('#ops-dump', () => event(-1));
  action('#ops-config', () => { const symbol = current().symbol; engine.configure(symbol, { profile: Number($('#ops-profile').value), volatility: Number($('#ops-volatility').value), trend: Number($('#ops-trend').value) }); engine.message(`${symbol} perfil atualizado`); });
  action('#ops-freeze', () => { const symbol = current().symbol; engine.configure(symbol, { frozen: !engine.states[symbol].config.frozen }); engine.message(`${symbol} movimento natural ${engine.states[symbol].config.frozen ? 'congelado' : 'retomado'}`); });
  action('#ops-reset-coin', () => { const symbol = current().symbol; if (!confirm(`Restaurar preço e histórico de ${symbol}? Os eventos pendentes dessa moeda serão cancelados. Suas posições serão mantidas.`)) return; for (const e of engine.events.filter(e => e.symbol === symbol)) engine.cancel(e.id); engine.resetCoin(symbol); engine.message(`${symbol} preço e histórico restaurados`); loadConfig(); });
  for (const [id, type] of [['#ops-add', 'deposit'], ['#ops-remove', 'withdraw']]) action(id, () => { persist(transact(state, type, Number($('#ops-cash-amount').value))); engine.message(`wallet.${type} · ${fmt(Number($('#ops-cash-amount').value))}`); });
  action('#ops-set', () => { const target = Number($('#ops-cash-amount').value); if (!Number.isFinite(target) || target < 0 || target > 100000000) throw Error('Saldo: US$ 0 a US$ 100 milhões.'); const rounded = Math.round(target * 100) / 100, diff = Math.round((rounded - state.cash) * 100) / 100; if (diff) persist(transact(state, diff > 0 ? 'deposit' : 'withdraw', Math.abs(diff))); engine.message(`wallet.set · ${fmt(rounded)}`); });
  action('#ops-pause', () => { engine.paused = !engine.paused; engine.message(engine.paused ? 'engine.pause · eventos manuais continuam ativos' : 'engine.resume'); });
  $('#ops-speed').onchange = () => { const speed = Number($('#ops-speed').value); if ([.25, 1, 2, 5, 10].includes(speed)) engine.speed = speed; engine.message(`engine.speed ${engine.speed}x`); saveMarket(); updateQuotes(); };
  action('#ops-cancel-all', () => { for (const e of engine.events) engine.cancel(e.id); });
  action('#ops-liquidate', () => { let next = structuredClone(state); for (const c of coins) { const value = Math.floor((next.positions[c.symbol] || 0) * c.price * 100) / 100; if (value >= .01) next = transact(next, 'sell', value, c); } persist(next); engine.message('wallet.liquidate · posições vendidas ao preço atual'); });
  action('#ops-reset-wallet', () => { if (!confirm('Apagar posições e histórico e retornar a US$ 10.000 de demonstração?')) return; persist(initial()); engine.message('wallet.reset · carteira reiniciada'); });
  action('#ops-export', () => { const blob = new Blob([JSON.stringify({ application: 'Pump Lab sandbox', exportedAt: new Date().toISOString(), wallet: state, market: engine.snapshot() }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'pump-lab-session.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); engine.message('session.export'); });
  window.addEventListener('lab-tick', update);
})();
