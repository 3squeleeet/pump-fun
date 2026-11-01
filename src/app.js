'use strict';
const $ = s => document.querySelector(s), { initial, transact } = Market;
let snapshot; try { snapshot = JSON.parse(localStorage.getItem('pump-market-v2')); } catch { /* first session */ }
const engine = new Simulation.Engine(Market.coins, snapshot), coins = engine.coins;
let state; try { state = JSON.parse(localStorage.getItem('pump-lab-v1')); if (!state || !Number.isFinite(state.cash) || state.cash < 0 || !state.positions || typeof state.positions !== 'object' || !Array.isArray(state.history)) state = initial(); } catch { state = initial(); }
let favorites; try { favorites = new Set(JSON.parse(localStorage.getItem('pump-favorites') || '[]')); } catch { favorites = new Set(); }
let selected = coins[2], mode = 'buy', filter = 'all', view = 'trades', period = '1D', moneyMode = 'deposit', orderFraction = null;
const images = globalThis.COIN_IMAGES || {}, fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n < .01 ? 9 : 2 }).format(n), compact = n => '$' + Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n), signed = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
function toast(msg) { $('#toast').textContent = msg; $('#toast').style.display = 'block'; clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => $('#toast').style.display = 'none', 4000); }
let storageWarning = false;
function saveMarket() { try { localStorage.setItem('pump-market-v2', JSON.stringify(engine.snapshot())); } catch { if (!storageWarning) { storageWarning = true; toast('Armazenamento cheio: o mercado atual não pôde ser salvo. Exporte a sessão nos controles.'); } } }
function persist(next) { localStorage.setItem('pump-lab-v1', JSON.stringify(next)); state = next; saveMarket(); render(); }
function icon(c) { const span = document.createElement('span'); span.className = 'coin-icon'; span.style.background = c.color; span.textContent = c.symbol.slice(0, 2); if (images[c.id]) { const img = document.createElement('img'); img.src = images[c.id]; img.alt = c.name; img.className = 'coin-img'; img.onerror = () => { img.remove(); span.textContent = c.symbol.slice(0, 2); }; span.replaceChildren(img); } return span; }
function renderCoins() {
  const list = $('#coins'), query = $('#search').value.toLowerCase(); list.replaceChildren();
  let visible = coins.filter(c => (c.name + ' ' + c.symbol).toLowerCase().includes(query));
  if (filter === 'hot') visible = visible.filter(c => c.change > 0).sort((a, b) => b.change - a.change);
  if (filter === 'star') visible = visible.filter(c => favorites.has(c.symbol));
  for (const c of visible) {
    const b = document.createElement('button'); b.className = 'coin-row' + (selected === c ? ' current' : ''); b.dataset.symbol = c.symbol; b.append(icon(c));
    const info = document.createElement('div'); info.className = 'coin-info'; info.innerHTML = `<b>${c.symbol} ${favorites.has(c.symbol) ? '★' : ''}</b><small>${c.name} · ${compact(c.volume)}</small>`;
    const val = document.createElement('div'); val.className = 'coin-values'; val.innerHTML = `<b>${fmt(c.price)}</b><span class="${c.change >= 0 ? 'positive' : 'negative'}">${signed(c.change)}</span>`;
    b.append(info, val); b.onclick = () => { selected = c; orderFraction = null; render(); }; list.append(b);
  }
  if (!visible.length) list.innerHTML = '<div class="empty">Nenhuma moeda encontrada.</div>';
}
function render() {
  renderCoins(); const c = selected, identity = $('#coin-identity'); identity.replaceChildren(icon(c));
  const title = document.createElement('div'); title.innerHTML = `<h1>${c.symbol} <small>✓</small></h1><p>${c.name}</p>`;
  const star = document.createElement('button'); star.id = 'favorite'; star.ariaLabel = 'Favoritar moeda'; star.textContent = favorites.has(c.symbol) ? '★' : '☆';
  star.onclick = () => { favorites.has(c.symbol) ? favorites.delete(c.symbol) : favorites.add(c.symbol); try { localStorage.setItem('pump-favorites', JSON.stringify([...favorites])); } catch { toast('Não foi possível salvar os favoritos.'); } render(); };
  identity.append(title, star); $('#network').textContent = ['BTC', 'LTC'].includes(c.symbol) ? 'PoW' : c.symbol === 'ETH' ? 'Ethereum' : 'Multirrede'; updateQuotes();
}
function updateQuotes() {
  const c = selected, bars = engine.states[c.symbol].series[period], last = bars.at(-1);
  $('#cap').textContent = compact(c.cap); $('#volume').textContent = compact(c.volume);
  $('#chart-title').textContent = `${c.symbol} / USD · ${period} · Pump Lab`;
  $('#ohlc').textContent = `${fmt(c.price)}  ${signed(c.change)}`; $('#change').textContent = signed(c.change); $('#change').className = c.change >= 0 ? 'positive' : 'negative';
  $('#chart').setAttribute('aria-label', `${c.symbol}, preço ${fmt(c.price)}, gráfico de demonstração em movimento`);
  document.querySelectorAll('.coin-row').forEach(row => { const coin = engine.coin(row.dataset.symbol); row.querySelector('.coin-values b').textContent = fmt(coin.price); const change = row.querySelector('.coin-values span'); change.textContent = signed(coin.change); change.className = coin.change >= 0 ? 'positive' : 'negative'; row.querySelector('.coin-info small').textContent = `${coin.name} · ${compact(coin.volume)}`; });
  document.querySelectorAll('[data-ticker]').forEach(el => { const coin = engine.coin(el.dataset.ticker); el.querySelector('b').textContent = fmt(coin.price); const em = el.querySelector('em'); em.textContent = signed(coin.change); em.className = coin.change >= 0 ? 'positive' : 'negative'; });
  const s = engine.states[c.symbol], buys = s.trades.filter(t => t.side === 'Compra').length, sells = s.trades.length - buys;
  $('#buy-count').textContent = `${buys} compras recentes`; $('#sell-count').textContent = `${sells} vendas recentes`; $('.bar i').style.width = (buys + sells ? buys / (buys + sells) * 100 : 50) + '%';
  $('#liquidity').textContent = compact(c.volume * .14); $('#holders').textContent = Math.round(1000 + c.volume / 300).toLocaleString('pt-BR');
  $('#market-status').textContent = engine.paused ? '● MERCADO PAUSADO' : `● MERCADO ATIVO · ${engine.speed}×`;
  $('#clock').textContent = new Date().toLocaleTimeString('pt-BR', { timeZone: 'UTC' });
  $('#chart').dataset.close = String(last.close); updateWallet(); renderTable(); drawChart();
  window.dispatchEvent(new Event('lab-tick'));
}
function updateWallet() { $('#balance').textContent = fmt(state.cash) + ' ▾'; $('#available').textContent = mode === 'buy' ? fmt(state.cash) : ((state.positions[selected.symbol] || 0).toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' ' + selected.symbol); $('#trade').textContent = (mode === 'buy' ? 'Comprar ' : 'Vender ') + selected.symbol; $('#equity').textContent = fmt(state.cash + coins.reduce((n, c) => n + (state.positions[c.symbol] || 0) * c.price, 0)); estimate(); }
function estimate() { const n = Number($('#amount').value); $('#estimate').textContent = n > 0 ? `≈ ${(n / selected.price).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${selected.symbol}` : 'Digite um valor para a ordem'; }
function renderTable() {
  const el = $('#table-content');
  if (view === 'about') { el.innerHTML = `<div class="about"><h3>${selected.name} <span class="positive">${selected.symbol}</span></h3>Perfil: <b>${Simulation.profiles[engine.states[selected.symbol].config.profile]}</b>. Preço atual: <b>${fmt(selected.price)}</b>.<p>Mercado local de demonstração. Cotações, negócios e saldo são simulados. As ordens usam o mesmo preço exibido no gráfico. Ícones: cryptocurrency-icons (CC0). Projeto independente, sem conexão com exchanges ou blockchains.</p></div>`; return; }
  let headers, rows;
  if (view === 'portfolio') { headers = ['Ativo', 'Quantidade', 'Preço atual', 'Valor']; rows = coins.filter(c => (state.positions[c.symbol] || 0) > 1e-12).map(c => [c.symbol, state.positions[c.symbol].toLocaleString('en-US', { maximumFractionDigits: 6 }), fmt(c.price), fmt(state.positions[c.symbol] * c.price)]); }
  else if (view === 'history') { headers = ['Operação', 'Ativo', 'Horário', 'Valor']; const labels = { buy: 'Compra', sell: 'Venda', deposit: 'Depósito', withdraw: 'Saque' }; rows = state.history.map(h => [labels[h.type] || h.type, h.symbol, new Date(h.time).toLocaleTimeString('pt-BR'), fmt(h.amount)]); }
  else { headers = ['Horário', 'Tipo', 'Preço', 'Valor (USD)', 'Trader']; rows = engine.states[selected.symbol].trades.slice(0, 9).map(t => [new Date(t.time).toLocaleTimeString('pt-BR'), t.side, fmt(t.price), fmt(t.amount), t.trader]); }
  if (!rows.length) { el.innerHTML = '<div class="empty">' + (view === 'history' ? 'Suas operações aparecerão aqui.' : view === 'portfolio' ? 'Sua carteira está vazia. Selecione uma moeda para comprar.' : 'Aguardando os próximos negócios do motor local…') + '</div>'; return; }
  const table = document.createElement('table'), head = table.createTHead().insertRow();
  for (const text of headers) { const th = document.createElement('th'); th.textContent = text; head.append(th); }
  const body = table.createTBody(); for (const row of rows) { const tr = body.insertRow(); for (const text of row) { const td = tr.insertCell(); td.textContent = text; if (text === 'Compra') td.className = 'positive'; if (text === 'Venda') td.className = 'negative'; } } el.replaceChildren(table);
}
function drawChart() {
  const canvas = $('#chart'), r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1; canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); const w = r.width, h = r.height, right = 87, bottom = 35, top = 52, cw = w - right; if (cw <= 0 || h <= 100) return;
  ctx.font = '9px sans-serif'; ctx.strokeStyle = '#20262a'; ctx.lineWidth = .5;
  const values = engine.states[selected.symbol].series[period], lo = Math.min(...values.map(v => v.low)) * .995, hi = Math.max(...values.map(v => v.high)) * 1.005, range = Math.max(hi - lo, hi * .0001), y = n => top + (hi - n) / range * (h - top - bottom - 60), vmax = Math.max(1, ...values.map(v => v.volume));
  for (let i = 0; i < 6; i++) { const yy = top + i * (h - top - bottom - 60) / 5; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(cw, yy); ctx.stroke(); ctx.fillStyle = '#77818b'; ctx.fillText(fmt(hi - range * i / 5), cw + 8, yy + 3); }
  const step = cw / values.length;
  for (let i = 0; i < values.length; i++) { const v = values[i], x = i * step + step / 2, color = v.close >= v.open ? '#63d99b' : '#ed7482';
    if (i % 15 === 0) { ctx.strokeStyle = '#20262a'; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h - bottom); ctx.stroke(); ctx.fillStyle = '#737e88'; const date = new Date(v.time); const text = period === '1S' ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }); ctx.fillText(text, x, h - 12); }
    ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(x, y(v.high)); ctx.lineTo(x, y(v.low)); ctx.stroke(); ctx.fillStyle = color; ctx.fillRect(x - step * .32, Math.min(y(v.open), y(v.close)), step * .64, Math.max(1, Math.abs(y(v.open) - y(v.close)))); ctx.globalAlpha = .25; ctx.fillRect(x - step * .32, h - bottom - v.volume / vmax * 50, step * .64, v.volume / vmax * 50); ctx.globalAlpha = 1;
  }
  const last = selected.price; ctx.strokeStyle = '#8aefb8'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(0, y(last)); ctx.lineTo(cw, y(last)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#8aefb8'; ctx.fillRect(cw, y(last) - 9, right - 3, 18); ctx.fillStyle = '#10291a'; ctx.fillText(fmt(last), cw + 5, y(last) + 3);
}
function setView(v) { view = v; document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('selected', b.dataset.view === v)); renderTable(); }
function money(type) { moneyMode = type; $('#modal-title').textContent = type === 'deposit' ? 'Depositar créditos' : 'Sacar créditos'; $('#modal-description').textContent = type === 'deposit' ? 'Adicione saldo à sua conta de demonstração.' : 'Remova saldo da sua conta de demonstração. Nenhuma transferência real será feita.'; $('#money-amount').value = ''; $('#modal-error').textContent = ''; $('#modal').showModal(); $('#money-amount').focus(); }
$('#money-form').onsubmit = e => { e.preventDefault(); try { persist(transact(state, moneyMode, Number($('#money-amount').value))); $('#modal').close(); toast(moneyMode === 'deposit' ? 'Créditos adicionados.' : 'Créditos retirados.'); } catch (err) { $('#modal-error').textContent = err.message; } };
$('#close-modal').onclick = () => $('#modal').close(); $('#deposit').onclick = $('#deposit-top').onclick = () => money('deposit'); $('#withdraw').onclick = () => money('withdraw'); $('#balance').onclick = $('#wallet-nav').onclick = () => setView('portfolio'); $('#history-nav').onclick = () => setView('history'); $('#search').oninput = renderCoins;
document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { filter = b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('selected', x === b)); renderCoins(); });
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view)); document.querySelectorAll('[data-period]').forEach(b => b.onclick = () => { period = b.dataset.period; document.querySelectorAll('[data-period]').forEach(x => x.classList.toggle('selected', x === b)); updateQuotes(); });
for (const type of ['buy', 'sell']) $('#' + type + '-tab').onclick = () => { mode = type; orderFraction = null; $('#buy-tab').classList.toggle('selected', type === 'buy'); $('#sell-tab').classList.add('sell'); $('#sell-tab').classList.toggle('selected', type === 'sell'); updateWallet(); };
document.querySelectorAll('[data-percent]').forEach(b => b.onclick = () => { orderFraction = Number(b.dataset.percent) / 100; $('#amount').value = (Math.floor((mode === 'buy' ? state.cash : (state.positions[selected.symbol] || 0) * selected.price) * Number(b.dataset.percent)) / 100).toFixed(2); estimate(); });
document.querySelectorAll('[data-amount]').forEach(b => b.onclick = () => { orderFraction = null; $('#amount').value = b.dataset.amount; estimate(); }); $('#amount').oninput = () => { orderFraction = null; estimate(); };
$('#trade').onclick = () => { try { engine.tick(); const amount = orderFraction === null ? Number($('#amount').value) : Math.floor((mode === 'buy' ? state.cash : (state.positions[selected.symbol] || 0) * selected.price) * orderFraction * 100) / 100; persist(transact(state, mode, amount, selected)); toast('Ordem executada.'); } catch (err) { toast(err.message); } };
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); $('#search').focus(); } });
new ResizeObserver(drawChart).observe($('#chart')); let ticks = 0; setInterval(() => { engine.tick(); updateQuotes(); if (++ticks % 5 === 0) saveMarket(); }, 1000);
window.addEventListener('pagehide', saveMarket); document.addEventListener('visibilitychange', () => { if (document.hidden) saveMarket(); }); render();
