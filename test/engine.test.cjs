const { test } = require('node:test');
const assert = require('node:assert/strict');
const { coins, initial, transact } = require('../src/market.js');
const { Engine, periods } = require('../src/engine.js');
const epoch = 1700000000000;
function frozen() { const e = new Engine(coins, null, epoch); e.paused = true; return e; }

test('históricos têm formas independentes, OHLC válidos e fechamento igual ao preço negociável', () => {
  const e = new Engine(coins, null, epoch), shapes = new Set();
  for (const c of e.coins) {
    for (const period of Object.keys(periods)) {
      const bars = e.states[c.symbol].series[period]; assert.equal(bars.length, 90);
      assert.ok(Math.abs(bars.at(-1).close / c.price - 1) < 1e-12);
      assert.ok(bars.every(b => b.low <= Math.min(b.open, b.close) && b.high >= Math.max(b.open, b.close)));
    }
    const bars = e.states[c.symbol].series['1D']; shapes.add(bars.map(b => (b.close / b.open - 1).toFixed(7)).join(','));
  }
  assert.equal(shapes.size, 36);
});
test('ticks movimentam preços e carteira; nova vela preserva continuidade e períodos', () => {
  const e = new Engine(coins, null, epoch), c = e.coin('SOL'), start = c.price;
  let wallet = transact(initial(), 'buy', 1000, c); const qty = wallet.positions.SOL;
  for (let i = 1; i <= 60; i++) e.tick(epoch + i * 1000);
  assert.notEqual(c.price, start); assert.notEqual(qty * c.price, 1000);
  for (const p of Object.keys(periods)) assert.equal(e.states.SOL.series[p].at(-1).close, c.price);
  assert.equal(e.states.SOL.series['1H'].length, 90); assert.ok(e.states.SOL.series['1H'].at(-1).time > epoch);
  wallet = transact(wallet, 'sell', Math.floor(qty * c.price * 100) / 100, c); assert.ok(wallet.cash > 9000);
});
test('pump/dump imediato alteram somente o alvo e todos os períodos', () => {
  const e = frozen(), sol = e.coin('SOL').price, btc = e.coin('BTC').price;
  e.schedule('SOL', 50, 0, 0, epoch); assert.equal(e.coin('SOL').price, sol * 1.5);
  e.schedule('SOL', -20, 0, 0, epoch); assert.equal(e.coin('SOL').price, sol * 1.5 * .8); assert.equal(e.coin('BTC').price, btc);
  for (const p of Object.keys(periods)) assert.equal(e.states.SOL.series[p].at(-1).close, e.coin('SOL').price);
});
test('evento respeita espera, duração e conclusão exata; não é reaplicado', () => {
  const e = frozen(), start = e.coin('BTC').price;
  e.schedule('BTC', 100, 2, 4, epoch); e.tick(epoch + 1000); assert.equal(e.coin('BTC').price, start);
  e.tick(epoch + 4000); assert.ok(Math.abs(e.coin('BTC').price / start - Math.sqrt(2)) < 1e-12);
  e.tick(epoch + 6000); assert.ok(Math.abs(e.coin('BTC').price / start - 2) < 1e-12);
  e.tick(epoch + 9000); assert.ok(Math.abs(e.coin('BTC').price / start - 2) < 1e-12); assert.equal(e.events[0].status, 'done');
});
test('cancelar movimento parcial preserva alteração já aplicada', () => {
  const e = frozen(), event = e.schedule('SOL', -80, 0, 10, epoch); e.tick(epoch + 5000);
  const before = e.coin('SOL').price; e.cancel(event.id); e.tick(epoch + 20000); assert.equal(e.coin('SOL').price, before); assert.equal(event.status, 'cancelled');
});
test('snapshot recupera histórico, configurações e eventos vencidos sem duplicar', () => {
  const e = frozen(); e.configure('SOL', { volatility: 2, trend: -1, frozen: true }); e.schedule('SOL', 25, 5, 0, epoch);
  const restored = new Engine(coins, JSON.parse(JSON.stringify(e.snapshot())), epoch + 10000);
  assert.equal(restored.states.SOL.config.volatility, 2); restored.tick(epoch + 10000); assert.equal(restored.coin('SOL').price, 162 * 1.25);
  const again = new Engine(coins, restored.snapshot(), epoch + 20000); again.tick(epoch + 20000); assert.equal(again.coin('SOL').price, 162 * 1.25);
});
test('pausa, congelamento e retomada controlam somente movimento natural', () => {
  const e = new Engine(coins, null, epoch); e.configure('SOL', { frozen: true }); const price = e.coin('SOL').price;
  e.tick(epoch + 1000); assert.equal(e.coin('SOL').price, price); assert.notEqual(e.coin('BTC').price, 68000);
  e.paused = true; const btc = e.coin('BTC').price; e.tick(epoch + 2000); assert.equal(e.coin('BTC').price, btc);
  e.schedule('SOL', 10, 0, 0, epoch + 2000); assert.equal(e.coin('SOL').price, price * 1.1);
  e.paused = false; e.configure('SOL', { frozen: false }); e.tick(epoch + 3000); assert.notEqual(e.coin('SOL').price, price * 1.1);
});
test('valida limites e rejeita snapshots corrompidos', () => {
  const e = frozen(); for (const n of [-100, -101, NaN, Infinity, 10001, 0]) assert.throws(() => e.schedule('SOL', n));
  assert.throws(() => e.schedule('NOPE', 10)); assert.throws(() => e.schedule('SOL', 10, -1)); assert.throws(() => e.configure('SOL', { volatility: 0 }));
  const s = JSON.parse(JSON.stringify(e.snapshot())); s.states.SOL.series['1D'][0].close = -1;
  const restored = new Engine(coins, s, epoch); assert.ok(restored.states.SOL.series['1D'][0].close > 0);
});
