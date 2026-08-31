import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditQuote, negotiationScript, dealerFee, perWatt, expectedAnnualKwh } from '../audit.js';
import { benchmarkFor } from '../benchmarks.js';

const find = (r, id) => r.flags.find((f) => f.id === id);

test('helpers', () => {
  assert.equal(perWatt(35000, 10), 3.5);
  assert.equal(perWatt(0, 0), 0);
  assert.deepEqual(dealerFee(30000, 40000), { fee: 10000, pct: 1 / 3 });
  assert.equal(dealerFee(0, 40000), null);
  assert.equal(expectedAnnualKwh(10, 1550), 15500);
});

test('benchmarks: state -> region (no NE clash)', () => {
  assert.equal(benchmarkFor('CA').region, 'CA');
  assert.equal(benchmarkFor('NE').region, 'MW'); // Nebraska, not Northeast
  assert.equal(benchmarkFor('NY').region, 'NEAST');
  assert.equal(benchmarkFor('ZZ').region, 'US'); // unknown -> default
});

test('flags an overpriced quote', () => {
  const r = auditQuote({ state: 'CA', sizeKw: 10, cashPrice: 45000, financingType: 'cash' });
  const f = find(r, 'overpriced');
  assert.ok(f);
  assert.equal(f.severity, 'high'); // 4.5/W > 3.5*1.2
  assert.equal(f.amount, 10000); // 45000 - fairHigh 35000
  assert.equal(r.verdict, 'red');
  assert.equal(r.atStake, 10000);
});

test('detects a hidden dealer fee', () => {
  const r = auditQuote({ state: 'TX', sizeKw: 10, cashPrice: 25000, financingType: 'loan', financedAmount: 34000 });
  const f = find(r, 'dealer-fee');
  assert.ok(f);
  assert.equal(f.amount, 9000);
  assert.equal(f.severity, 'high'); // 36% > 20%
});

test('warns on low APR without a cash/financed pair', () => {
  const r = auditQuote({ state: 'TX', sizeKw: 10, cashPrice: 25000, financingType: 'loan', apr: 1.99 });
  assert.ok(find(r, 'dealer-fee-suspect'));
});

test('flags the expired 25D credit for an owned 2026 system', () => {
  const r = auditQuote({ state: 'TX', sizeKw: 12, cashPrice: 30000, financingType: 'loan', assumes30Credit: true, placedInServiceYear: 2026 });
  const f = find(r, 'credit-expired');
  assert.ok(f);
  assert.equal(f.severity, 'high');
  assert.equal(f.amount, 9000); // 30000 * 0.30
});

test('no credit flag when the quote does not assume the credit', () => {
  const r = auditQuote({ state: 'TX', sizeKw: 12, cashPrice: 30000, financingType: 'cash', assumes30Credit: false, placedInServiceYear: 2026 });
  assert.equal(find(r, 'credit-expired'), undefined);
});

test('flags inflated production', () => {
  const r = auditQuote({ state: 'CA', sizeKw: 10, cashPrice: 30000, financingType: 'cash', promisedAnnualKwh: 20000 });
  assert.ok(find(r, 'overpromise')); // realistic ~15500, promised 20000
});

test('flags a steep PPA escalator', () => {
  const r = auditQuote({ state: 'FL', sizeKw: 10, cashPrice: 0, financingType: 'ppa', escalatorPct: 3.9 });
  const f = find(r, 'escalator');
  assert.ok(f);
  assert.equal(f.severity, 'high');
});

test('fair cash quote -> verdict fair, nothing at stake', () => {
  const r = auditQuote({ state: 'CA', sizeKw: 10, cashPrice: 28000, financingType: 'cash' });
  assert.equal(r.flags.length, 0);
  assert.equal(r.verdict, 'fair');
  assert.equal(r.atStake, 0);
});

test('atStake sums high+medium amounts, ignores info', () => {
  const r = auditQuote({ state: 'CA', sizeKw: 10, cashPrice: 45000, financingType: 'loan', financedAmount: 55000, assumes30Credit: true, placedInServiceYear: 2026 });
  // overpriced 10000 + dealer-fee 10000 + credit 13500 = 33500
  assert.equal(r.atStake, 10000 + 10000 + Math.round(45000 * 0.3));
  assert.equal(r.verdict, 'red');
});

test('negotiation script includes the key asks', () => {
  const r = auditQuote({ state: 'CA', sizeKw: 10, cashPrice: 45000, financingType: 'cash' });
  const s = negotiationScript({ state: 'CA' }, r);
  assert.match(s, /CASH price/);
  assert.match(s, /AMOUNT FINANCED/);
  assert.match(s, /§25D|tax credit/);
  assert.match(s, /\$26,000–\$35,000|fair installed price/);
});
