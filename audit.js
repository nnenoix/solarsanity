// audit.js — pure, DOM-free solar-quote audit logic. Unit-tested.
import { benchmarkFor } from './benchmarks.js';

// Owned residential solar federal credit (IRC §25D) ended 2025-12-31 (OBBBA, 2025).
export const CREDIT_25D_LAST_YEAR = 2025;
export const FED_CREDIT_RATE = 0.30;
// Rough installed battery cost per kWh (used to fair-adjust $/W benchmarks).
const BATTERY_LOW = 900;
const BATTERY_HIGH = 1200;

const round = (n) => Math.round(n);
const clampPct = (n) => Math.round(n * 1000) / 10;

export function perWatt(cashPrice, sizeKw) {
  const w = sizeKw * 1000;
  return w > 0 ? cashPrice / w : 0;
}

export function expectedAnnualKwh(sizeKw, yieldPerKw) {
  return sizeKw * yieldPerKw;
}

/** Hidden dealer fee = financed total − cash price. */
export function dealerFee(cashPrice, financedAmount) {
  if (!cashPrice || !financedAmount) return null;
  const fee = financedAmount - cashPrice;
  return { fee, pct: cashPrice > 0 ? fee / cashPrice : 0 };
}

/**
 * Audit a solar quote. `input` fields:
 *  state, sizeKw, cashPrice, financingType ('cash'|'loan'|'lease'|'ppa'),
 *  financedAmount?, apr?, termYears?, promisedAnnualKwh?, escalatorPct?,
 *  assumes30Credit?, batteryKwh?, placedInServiceYear?
 * Returns { verdict, atStake, fairLow, fairHigh, perWatt, flags:[...] }.
 */
export function auditQuote(input) {
  const b = benchmarkFor(input.state || 'US');
  const sizeKw = +input.sizeKw || 0;
  const cash = +input.cashPrice || 0;
  const watts = sizeKw * 1000;
  const battery = +input.batteryKwh || 0;
  const owned = input.financingType === 'cash' || input.financingType === 'loan';
  const year = +input.placedInServiceYear || 2026;

  const fairLow = round(b.low * watts + battery * BATTERY_LOW);
  const fairHigh = round(b.high * watts + battery * BATTERY_HIGH);
  const ppw = perWatt(cash, sizeKw);
  const flags = [];

  // 1) Price per watt vs fair range
  if (cash && watts) {
    if (cash > fairHigh) {
      const over = cash - fairHigh;
      flags.push({
        id: 'overpriced',
        severity: ppw > b.high * 1.2 ? 'high' : 'medium',
        title: 'Priced above the fair range for your area',
        amount: round(over),
        detail: `$${ppw.toFixed(2)}/W vs a fair $${b.low.toFixed(2)}–$${b.high.toFixed(2)}/W for ${b.state}. That's ~$${round(over).toLocaleString('en-US')} over a fair price.`,
        argument: 'Ask them to match the local market rate per watt, or walk. Solar is a competitive market — get 2–3 quotes.',
      });
    } else if (ppw > 0 && ppw < b.low * 0.7 && !battery) {
      flags.push({
        id: 'too-cheap',
        severity: 'info',
        title: 'Suspiciously cheap',
        detail: `$${ppw.toFixed(2)}/W is well below the fair range. Check for low-quality panels, undersized equipment, or missing scope (permits, inspection, warranty).`,
        argument: 'Confirm equipment brands, wattage, warranty, and that permitting/inspection are included in writing.',
      });
    }
  }

  // 2) Hidden dealer fee (financing)
  if (input.financingType === 'loan') {
    const df = dealerFee(cash, +input.financedAmount);
    if (df && df.pct > 0.1) {
      flags.push({
        id: 'dealer-fee',
        severity: df.pct > 0.2 ? 'high' : 'medium',
        title: 'Hidden financing "dealer fee"',
        amount: round(df.fee),
        detail: `The financed total is $${round(df.fee).toLocaleString('en-US')} (${clampPct(df.pct)}%) above the cash price. That gap is a hidden dealer fee baked into the loan to buy down the "low" APR.`,
        argument: 'The CFPB flags these markups (often 15–30%+). Ask for the cash price and a low-fee loan instead of a low-APR one, or finance elsewhere and pay the installer cash.',
      });
    } else if (!df && +input.apr && +input.apr < 3.5) {
      flags.push({
        id: 'dealer-fee-suspect',
        severity: 'medium',
        title: 'That low APR probably hides a dealer fee',
        detail: `A ${(+input.apr).toFixed(2)}% solar loan almost always bakes a 15–30% dealer fee into the amount financed.`,
        argument: 'Get two numbers in writing: the CASH price and the total AMOUNT FINANCED. The difference is the fee.',
      });
    }
  }

  // 3) Expired 25D federal credit trap (owned systems in 2026+)
  if (owned && year > CREDIT_25D_LAST_YEAR && input.assumes30Credit) {
    const overstated = round(cash * FED_CREDIT_RATE);
    flags.push({
      id: 'credit-expired',
      severity: 'high',
      title: 'Savings assume a tax credit that no longer exists',
      amount: overstated,
      detail: `The 30% federal residential credit (§25D) expired Dec 31, 2025. For an owned system placed in service in ${year}, you likely get $0 federal credit — so any savings math using 30% overstates by ~$${overstated.toLocaleString('en-US')}.`,
      argument: 'Ask them to re-run payback with $0 federal credit (leases/PPAs may still pass through a commercial credit — get it in writing). Verify current state/utility incentives separately.',
    });
  }

  // 4) Production overpromise
  if (+input.promisedAnnualKwh && sizeKw) {
    const expected = expectedAnnualKwh(sizeKw, b.yield);
    if (+input.promisedAnnualKwh > expected * 1.1) {
      const overPct = clampPct(+input.promisedAnnualKwh / expected - 1);
      flags.push({
        id: 'overpromise',
        severity: 'medium',
        title: 'Production estimate looks inflated',
        detail: `They promise ${round(+input.promisedAnnualKwh).toLocaleString('en-US')} kWh/yr; a realistic estimate for ${sizeKw} kW in ${b.state} is ~${round(expected).toLocaleString('en-US')} kWh/yr (${overPct}% lower). Inflated production makes payback look better than it is.`,
        argument: 'Ask for a PVWatts or shade-analysis report. Over-promised output is a classic way to justify an over-priced system.',
      });
    }
  }

  // 5) Lease / PPA escalator
  if ((input.financingType === 'lease' || input.financingType === 'ppa')) {
    const esc = +input.escalatorPct || 0;
    if (esc > 2.9) {
      flags.push({
        id: 'escalator',
        severity: 'high',
        title: `${esc}% annual escalator will balloon your payments`,
        detail: `A ${esc}%/yr escalator roughly ${Math.round(Math.pow(1 + esc / 100, 20) * 100 - 100)}% raises your payment over 20 years. You never own the system and (in 2026) can't claim the federal credit yourself.`,
        argument: 'Prefer a $0-escalator PPA, or buy the system outright. Compare 25-year total cost of the lease/PPA vs cash ownership.',
      });
    } else {
      flags.push({
        id: 'lease-note',
        severity: 'info',
        title: "You won't own this system",
        detail: 'With a lease/PPA you rent the panels: no asset, harder home sale, and the installer (not you) keeps any tax credit.',
        argument: 'Get the 25-year total cost in writing and compare to buying outright.',
      });
    }
  }

  // Rank + total at stake
  const rank = { high: 0, medium: 1, info: 2 };
  flags.sort((a, z) => rank[a.severity] - rank[z.severity] || (z.amount || 0) - (a.amount || 0));
  const atStake = flags.reduce((s, f) => s + (f.severity !== 'info' ? f.amount || 0 : 0), 0);
  const verdict = flags.some((f) => f.severity === 'high')
    ? 'red'
    : flags.some((f) => f.severity === 'medium')
    ? 'watch'
    : 'fair';

  return { verdict, atStake: round(atStake), fairLow, fairHigh, perWatt: ppw, benchmark: b, flags };
}

/** Copy-paste negotiation message for the installer. */
export function negotiationScript(input, result) {
  const L = [];
  L.push('Hi — before I move forward, please put the following in writing:');
  L.push('');
  L.push('1) The full CASH price and the total AMOUNT FINANCED (I want to see the difference).');
  L.push('2) An itemized breakdown of every line item and adder.');
  L.push(`3) Payback re-calculated with $0 federal tax credit (the §25D residential credit expired 31 Dec 2025 for owned systems).`);
  L.push('4) A production estimate backed by PVWatts or a shade analysis.');
  if (result && result.fairHigh) {
    L.push('');
    L.push(`Based on current local pricing, a fair installed price for this system is about $${result.fairLow.toLocaleString('en-US')}–$${result.fairHigh.toLocaleString('en-US')}. Can you meet that?`);
  }
  L.push('');
  L.push("I'm comparing 2–3 quotes, so clear numbers will help me decide.");
  return L.join('\n');
}
