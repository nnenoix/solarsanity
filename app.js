// app.js — UI wiring. Pure logic in audit.js/benchmarks.js.
import { auditQuote, negotiationScript } from './audit.js';
import { STATES } from './benchmarks.js';

const $ = (id) => document.getElementById(id);
const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
}

// Populate states
$('state').innerHTML = STATES.map(([code, name]) => `<option value="${code}">${esc(name)}</option>`).join('');
$('state').value = 'US';

// Conditional fields
function syncFields() {
  const t = $('financingType').value;
  const loan = t === 'loan';
  const rent = t === 'lease' || t === 'ppa';
  $('f-financed').classList.toggle('hidden', !loan);
  $('f-apr').classList.toggle('hidden', !loan);
  $('f-escalator').classList.toggle('hidden', !rent);
}
$('financingType').addEventListener('change', syncFields);
syncFields();

function readInput() {
  return {
    state: $('state').value,
    sizeKw: parseFloat($('sizeKw').value) || 0,
    cashPrice: parseFloat($('cashPrice').value) || 0,
    financingType: $('financingType').value,
    financedAmount: parseFloat($('financedAmount').value) || 0,
    apr: parseFloat($('apr').value) || 0,
    escalatorPct: parseFloat($('escalatorPct').value) || 0,
    promisedAnnualKwh: parseFloat($('promisedKwh').value) || 0,
    batteryKwh: parseFloat($('batteryKwh').value) || 0,
    assumes30Credit: $('assumes30Credit').checked,
    placedInServiceYear: 2026,
  };
}

const VERDICT = {
  red: { tag: 'Red flags', head: (r) => `~${usd(r.atStake)} at stake`, sub: 'This quote has serious issues. Negotiate hard or walk — details below.' },
  watch: { tag: 'Worth a closer look', head: (r) => (r.atStake ? `~${usd(r.atStake)} worth questioning` : 'A few things to check'), sub: 'Not a disaster, but push back on the items below before signing.' },
  fair: { tag: 'Looks fair', head: () => 'No red flags found', sub: 'Pricing and terms look reasonable for your area. Still get 2–3 quotes to be sure.' },
};

function render(input) {
  const r = auditQuote(input);
  const v = VERDICT[r.verdict];
  $('verdict').className = `verdict ${r.verdict}`;
  $('verdict').innerHTML = `
    <div class="verdict__tag">${v.tag}</div>
    <div class="verdict__headline">${v.head(r)}</div>
    <div class="verdict__sub">${v.sub}</div>
    <div class="stat-row">
      <div class="stat"><b>${input.perWatt || r.perWatt ? '$' + r.perWatt.toFixed(2) : '—'}</b><span>your $/W</span></div>
      <div class="stat"><b>$${r.benchmark.low.toFixed(2)}–$${r.benchmark.high.toFixed(2)}</b><span>fair $/W (${r.benchmark.state})</span></div>
      <div class="stat"><b>${usd(r.fairLow)}–${usd(r.fairHigh)}</b><span>fair total price</span></div>
    </div>`;

  const sevLabel = { high: 'Red flag', medium: 'Check this', info: 'FYI' };
  $('flags').innerHTML = r.flags.length
    ? r.flags.map((f) => `
      <div class="card flag ${f.severity}">
        <span class="chip">${sevLabel[f.severity]}</span>
        <div class="flag__head">
          <p class="flag__title">${esc(f.title)}</p>
          ${f.severity !== 'info' && f.amount ? `<div class="flag__amt">${usd(f.amount)}</div>` : ''}
        </div>
        <p class="flag__detail">${esc(f.detail)}</p>
        <div class="flag__do"><b>What to do:</b> ${esc(f.argument)}</div>
      </div>`).join('')
    : `<div class="card"><p style="margin:0;color:var(--ink-2)">Nothing flagged. The numbers you entered look reasonable — but always compare 2–3 quotes and get everything in writing.</p></div>`;

  const script = negotiationScript(input, r);
  $('scriptBox').innerHTML = `<textarea readonly>${esc(script)}</textarea><div class="row"><button class="btn btn--primary btn--sm" id="copyScript">Copy email</button></div>`;
  $('copyScript').onclick = async () => { await copy(script); toast('Copied'); };

  $('form-stage').classList.add('hidden');
  $('result-stage').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('quoteForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = readInput();
  if (!input.sizeKw || !input.cashPrice) {
    if (input.financingType === 'lease' || input.financingType === 'ppa') {
      // lease/ppa can have no cash price; still need size for some checks
    } else {
      toast('Enter at least system size (kW) and price');
      return;
    }
  }
  render(input);
});

$('editBtn').onclick = () => { $('result-stage').classList.add('hidden'); $('form-stage').classList.remove('hidden'); };
$('againBtn').onclick = () => {
  $('quoteForm').reset(); $('state').value = 'US'; syncFields();
  $('result-stage').classList.add('hidden'); $('form-stage').classList.remove('hidden');
};

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
