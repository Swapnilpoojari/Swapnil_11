// Dividend Income Planner - client-side only
// Features: add/remove holdings, compute annual dividends, monthly cash flow, projection with reinvestment

const form = document.getElementById('holding-form');
const holdingsListEl = document.getElementById('holdings-list');
const totalValueEl = document.getElementById('total-value');
const annualDividendsEl = document.getElementById('annual-dividends');
const monthlyCashEl = document.getElementById('monthly-cash');
const proj5El = document.getElementById('proj-5y');
const reinvestRateEl = document.getElementById('reinvest-rate');
const cagrEl = document.getElementById('cagr');
const recalcBtn = document.getElementById('recalc');
const clearBtn = document.getElementById('clear');
const browseBtn = document.getElementById('browse-symbols');

let holdings = [];
let allShares = [];

// load from localStorage
function load() {
  try {
    const raw = localStorage.getItem('makeon_holdings');
    holdings = raw ? JSON.parse(raw) : [];
  } catch (e) {
    holdings = [];
  }
}

function save() {
  localStorage.setItem('makeon_holdings', JSON.stringify(holdings));
}

function formatMoney(v) {
  return '$' + v.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
}

function renderHoldings() {
  holdingsListEl.innerHTML = '';
  if (holdings.length === 0) {
    holdingsListEl.innerHTML = '<div class="small">No holdings yet. Add one using the form.</div>';
    return;
  }

  holdings.forEach((h, idx) => {
    const div = document.createElement('div');
    div.className = 'holding';

    const info = document.createElement('div');
    info.className = 'h-info';
    info.innerHTML = `<div><strong>${escapeHtml(h.symbol.toUpperCase())}</strong><div class="small">${h.shares} sh @ ${formatMoney(h.price)}</div></div>`;

    const right = document.createElement('div');
    right.innerHTML = `<div class="small">Yield: ${h.yield}% | Freq: ${h.freq} / yr</div><div style="margin-top:6px"><button data-idx="${idx}">Remove</button></div>`;

    div.appendChild(info);
    div.appendChild(right);
    holdingsListEl.appendChild(div);
  });

  // attach remove handlers
  holdingsListEl.querySelectorAll('button[data-idx]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const i = Number(btn.getAttribute('data-idx'));
      holdings.splice(i,1);
      save();
      refreshAll();
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]+/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]||s));
}

function computeSummary() {
  let totalValue = 0;
  let annualDividends = 0;
  let monthlyCash = 0;

  holdings.forEach(h => {
    const val = h.shares * h.price;
    totalValue += val;
    const annDiv = val * (h.yield/100);
    annualDividends += annDiv;
    // monthly cash estimated by dividing payments into months according to frequency
    const perPay = annDiv / h.freq; // amount paid each frequency
    // distribute into months: assume freq payments spread evenly across year -> monthly contribution = annDiv/12
    monthlyCash += annDiv/12;
  });

  totalValueEl.textContent = formatMoney(totalValue);
  annualDividendsEl.textContent = formatMoney(annualDividends);
  monthlyCashEl.textContent = formatMoney(monthlyCash);

  return {totalValue, annualDividends, monthlyCash};
}

function projectValueYears(startingValue, annualDividends, reinvestRatePct, cagrPct, years) {
  // Simple yearly loop: each year dividends received = annualDividends * (1+growth)^year? For simplicity assume dividends grow at CAGR as well
  let value = startingValue;
  let currentDividends = annualDividends;
  const reinvestFraction = Math.max(0, Math.min(1, reinvestRatePct/100));
  const growth = cagrPct/100;

  for (let y=1;y<=years;y++) {
    // portfolio grows by market growth
    value = value * (1 + growth);
    // dividends also grow in line with growth
    currentDividends = currentDividends * (1 + growth);
    // reinvest portion adds to portfolio
    const reinvestAmount = currentDividends * reinvestFraction;
    value += reinvestAmount;
  }

  return value;
}

function refreshAll() {
  renderHoldings();
  const {totalValue, annualDividends} = computeSummary();
  // projection
  const reinvestRate = Number(reinvestRateEl.value) || 100;
  const cagr = Number(cagrEl.value) || 6;
  const proj5 = projectValueYears(totalValue, annualDividends, reinvestRate, cagr, 5);
  proj5El.textContent = formatMoney(proj5);
}

// Symbol browser: load shares.json
async function loadShares() {
  try {
    const res = await fetch('shares.json');
    if (!res.ok) throw new Error('failed to load');
    allShares = await res.json();
  } catch (e) {
    allShares = [];
  }
}

function openSymbolBrowser() {
  const modal = document.getElementById('symbol-browser');
  const list = document.getElementById('sb-list');
  const filter = document.getElementById('sb-filter');
  modal.style.display = 'flex';
  filter.value = '';
  renderSymbolList(allShares);
  filter.focus();

  function onFilter() {
    const q = filter.value.trim().toLowerCase();
    if (!q) {
      renderSymbolList(allShares);
      return;
    }
    const filtered = allShares.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || (s.exchange && s.exchange.toLowerCase().includes(q)));
    renderSymbolList(filtered);
  }

  filter.removeEventListener('input', onFilter);
  filter.addEventListener('input', onFilter);
}

function closeSymbolBrowser() {
  const modal = document.getElementById('symbol-browser');
  modal.style.display = 'none';
}

function renderSymbolList(list) {
  const el = document.getElementById('sb-list');
  el.innerHTML = '';
  if (!list || list.length === 0) {
    el.innerHTML = '<div class="small">No symbols available</div>';
    return;
  }

  list.forEach(s => {
    const item = document.createElement('div');
    item.style.border = '1px solid #eef2f7';
    item.style.padding = '8px';
    item.style.borderRadius = '6px';
    item.style.cursor = 'pointer';

    item.innerHTML = `<div style="font-weight:600">${escapeHtml(s.symbol)}</div><div class="small">${escapeHtml(s.name || '')}</div><div class="small">${escapeHtml(s.exchange || '')}</div>`;
    item.addEventListener('click', () => {
      document.getElementById('symbol').value = s.symbol;
      closeSymbolBrowser();
    });

    el.appendChild(item);
  });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const s = document.getElementById('symbol').value.trim();
  const shares = Number(document.getElementById('shares').value) || 0;
  const price = Number(document.getElementById('price').value) || 0;
  const y = Number(document.getElementById('yield').value) || 0;
  const freq = Number(document.getElementById('freq').value) || 4;

  if (!s || shares <=0 || price <=0) {
    alert('Please provide valid symbol, shares and price.');
    return;
  }

  holdings.push({symbol:s, shares, price, yield: y, freq});
  save();
  form.reset();
  document.getElementById('freq').value = '4';
  refreshAll();
});

recalcBtn.addEventListener('click', (e) => {
  refreshAll();
});

clearBtn.addEventListener('click', () => {
  if (!confirm('Clear all holdings?')) return;
  holdings = [];
  save();
  refreshAll();
});

browseBtn && browseBtn.addEventListener('click', async () => {
  if (!allShares || allShares.length === 0) await loadShares();
  openSymbolBrowser();
});

// close button
const sbClose = document.getElementById('sb-close');
sbClose && sbClose.addEventListener('click', () => closeSymbolBrowser());

// init
load();
loadShares();
refreshAll();