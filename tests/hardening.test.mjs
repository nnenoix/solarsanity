import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditQuote, loanCost } from '../audit.js';

const find = (r, id) => r.flags.find((f) => f.id === id);

// --- battery fair-range adjustment ----------------------------------------
test('battery cost widens the fair range and prevents a false "overpriced"', () => {
  const withBattery = auditQuote({ state: 'CA', sizeKw: 10, cashPrice: 40000, financingType: 'cash', batteryKwh: 10 });
  assert.equal(withBattery.fairLow, 35000);  // 2.6*10000 + 10*900
  assert.equal(withBattery.fairHigh, 47000); // 3.5*10000 + 10*1200
  assert.equal(find(withBattery, 'overpriced'), undefined);
  assert.equal(withBattery.verdict, 'fair');

  // Same $40k with NO battery IS overpriced (fairHigh 35000).
  const noBattery = auditQuote({ state: 'CA', sizeKw: 10, cashPrice: 40000, financingType: 'cash' });
  assert.ok(find(noBattery, 'overpriced'));
});

// --- negative / garbage input guards --------------------------------------
test('negative or garbage inputs never crash or flip a comparison', () => {
  const r = auditQuote({ state: 'CA', sizeKw: -10, cashPrice: -40000, financingType: 'cash', batteryKwh: -5 });
  assert.equal(r.perWatt, 0);
  assert.equal(r.fairLow, 0);
  assert.equal(r.fairHigh, 0);
  assert.equal(r.atStake, 0);
  assert.equal(r.verdict, 'fair');
  assert.equal(r.flags.length, 0);
});

// --- loan total-cost transparency -----------------------------------------
test('loanCost amortizes correctly and handles 0% without dividing by zero', () => {
  const zero = loanCost(24000, 0, 2); // interest-free
  assert.equal(Math.round(zero.monthly), 1000);
  assert.equal(Math.round(zero.interest), 0);
  const c = loanCost(30000, 6, 25);
  assert.ok(c.monthly > 190 && c.monthly < 200);
  assert.ok(c.interest > 25000); // long expensive loan
  assert.equal(loanCost(0, 5, 10), null);
  assert.equal(loanCost(30000, 5, 0), null);
});

test('a heavy long loan is flagged for attention but NOT counted as money at stake', () => {
  const r = auditQuote({ state: 'TX', sizeKw: 10, cashPrice: 30000, financingType: 'loan', apr: 6, termYears: 25 });
  const f = find(r, 'loan-cost');
  assert.ok(f);
  assert.equal(f.severity, 'medium'); // interest > 40% of principal
  assert.equal(f.amount, 0);          // never inflates atStake
  assert.equal(r.atStake, 0);
  assert.equal(r.verdict, 'watch');
  assert.match(f.detail, /total/);
});

test('no loan-cost flag without a term (nothing to amortize)', () => {
  const r = auditQuote({ state: 'TX', sizeKw: 10, cashPrice: 25000, financingType: 'loan', financedAmount: 34000 });
  assert.equal(find(r, 'loan-cost'), undefined); // still catches the dealer fee though
  assert.ok(find(r, 'dealer-fee'));
});
