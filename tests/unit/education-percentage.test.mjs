// Deterministic percentage arithmetic (REQUIREMENTS §4, DESIGN §8).
//
// Both Education policies turn on a threshold, and a threshold is exactly where
// floating point embarrasses you. These tests pin the boundary as EVIDENCE rather
// than assumption: PRODUCT writes both rules with `>=`, so the boundary value
// itself passes, and 59.99 / 60 / 60.01 and 69.99 / 70 / 70.01 are asserted
// explicitly.

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  percentageToHundredths,
  meetsThreshold,
  formatPercentage,
  PERCENTAGE_SCALE,
  MAX_PERCENTAGE,
} from '../../services/verifier/src/domains/education/percentage.mjs';

describe('percentage conversion', () => {
  test('whole and two-decimal percentages convert exactly', () => {
    assert.equal(percentageToHundredths(0), 0);
    assert.equal(percentageToHundredths(60), 6000);
    assert.equal(percentageToHundredths(70), 7000);
    assert.equal(percentageToHundredths(100), 10000);
    assert.equal(percentageToHundredths(59.99), 5999);
    assert.equal(percentageToHundredths(72.35), 7235);
  });

  test('binary representation error is tolerated, not rejected', () => {
    // 72.35 * 100 is 7234.999999999999 in IEEE 754. A strict integer test would
    // refuse a legitimate registry value, so the conversion allows that error
    // while still refusing genuine extra precision (below).
    assert.equal(72.35 * PERCENTAGE_SCALE === 7235, false, 'the premise: this is not exact in binary');
    assert.equal(percentageToHundredths(72.35), 7235);
    for (const value of [0.07, 8.29, 29.97, 66.66, 99.99]) {
      assert.equal(percentageToHundredths(value), Math.round(value * PERCENTAGE_SCALE));
    }
  });

  test('more precision than the schema promises is MALFORMED, not rounded away', () => {
    // Silently rounding 72.355 would mean the verifier decided something the
    // registry never said. The schema promises two decimals.
    for (const value of [72.355, 60.001, 0.005]) {
      assert.throws(() => percentageToHundredths(value), (err) => err.code === 'MALFORMED_CLAIM');
    }
  });

  test('values outside 0-100 are MALFORMED', () => {
    for (const value of [-0.01, -1, 100.01, 101, 1000]) {
      assert.throws(() => percentageToHundredths(value), (err) => err.code === 'MALFORMED_CLAIM');
    }
    assert.equal(MAX_PERCENTAGE, 100);
  });

  test('a non-number is MALFORMED, never coerced', () => {
    // '60' passing a >=60 rule by coercion is the class of bug this showcase
    // exists to prove absent.
    for (const value of ['60', '', null, undefined, true, {}, [], NaN, Infinity]) {
      assert.throws(() => percentageToHundredths(value), (err) => err.code === 'MALFORMED_CLAIM',
        `${JSON.stringify(value)} must not be accepted`);
    }
  });

  test('the diagnostic names which credential the value came from', () => {
    assert.throws(() => percentageToHundredths('x', 'university percentage'),
      /university percentage/);
  });
});

describe('threshold comparison — the boundaries both policies turn on', () => {
  test('the 60% boundary is inclusive', () => {
    assert.equal(meetsThreshold(59.99, 60), false);
    assert.equal(meetsThreshold(60, 60), true, 'PRODUCT writes the rule as >=, so 60 passes');
    assert.equal(meetsThreshold(60.01, 60), true);
  });

  test('the 70% boundary is inclusive', () => {
    assert.equal(meetsThreshold(69.99, 70), false);
    assert.equal(meetsThreshold(70, 70), true);
    assert.equal(meetsThreshold(70.01, 70), true);
  });

  test('a value that is not exact in binary still compares correctly at the boundary', () => {
    // The failure this module exists to prevent: a percentage arriving as
    // 69.99999999999999 and failing a >=70 rule a human would say it passes.
    assert.equal(meetsThreshold(70.0, 70), true);
    assert.equal(meetsThreshold(0.1 + 0.2 + 69.7, 70), true, '0.1+0.2 is 0.30000000000000004');
  });

  test('a malformed claim throws rather than quietly failing the threshold', () => {
    // Returning false would report a verified business answer for a credential
    // that is not what the schema promised.
    assert.throws(() => meetsThreshold('70', 70), (err) => err.code === 'MALFORMED_CLAIM');
    assert.throws(() => meetsThreshold(70.001, 70), (err) => err.code === 'MALFORMED_CLAIM');
  });
});

describe('formatting', () => {
  test('no precision is invented and none is lost', () => {
    assert.equal(formatPercentage(60), '60%');
    assert.equal(formatPercentage(70.5), '70.5%');
    assert.equal(formatPercentage(72.35), '72.35%');
    assert.equal(formatPercentage(59.99), '59.99%');
    assert.equal(formatPercentage(0), '0%');
    assert.equal(formatPercentage(100), '100%');
  });

  test('a two-decimal value with a trailing zero reads as one decimal', () => {
    assert.equal(formatPercentage(65.1), '65.1%');
    assert.equal(formatPercentage(65.10), '65.1%');
  });
});
