// The Agriculture money and policy arithmetic.
//
// This is the part of the iteration a customer reads off the screen as a rupee
// figure, so it is tested as arithmetic rather than through the protocol.

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acresToHundredths,
  hundredthsToAcres,
  maximumLoan,
  formatIndianRupees,
} from '../../services/verifier/src/domains/agriculture/money.mjs';
import { loadCropPolicy } from '../../services/verifier/src/domains/agriculture/index.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const POLICY_FILE = join(ROOT, 'config', 'policy', 'crop-rates.json');

describe('acreage precision', () => {
  test('whole and two-decimal acreages convert exactly', () => {
    assert.equal(acresToHundredths(4), 400);
    assert.equal(acresToHundredths(0), 0);
    assert.equal(acresToHundredths(2.5), 250);
    assert.equal(acresToHundredths(0.01), 1);
    assert.equal(acresToHundredths(12.34), 1234);
  });

  test('a value that is not exactly representable in binary still converts', () => {
    // 4.1 * 100 is 409.99999999999994. A strict integer check would reject a
    // legitimate registry value; this is why the conversion carries a tolerance.
    assert.equal(acresToHundredths(4.1), 410);
    assert.equal(acresToHundredths(0.07), 7);
    assert.equal(acresToHundredths(8.29), 829);
  });

  test('more precision than the schema permits is a malformed claim, not a decision', () => {
    for (const acres of [4.005, 1.234, 0.001]) {
      assert.throws(() => acresToHundredths(acres), (err) => err.code === 'MALFORMED_CLAIM', `${acres} should be refused`);
    }
  });

  test('a non-numeric or negative acreage is a malformed claim', () => {
    for (const acres of ['4', null, undefined, {}, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      assert.throws(() => acresToHundredths(acres), (err) => err.code === 'MALFORMED_CLAIM');
    }
  });

  test('the round trip back to acres is exact', () => {
    for (const acres of [0, 0.01, 1, 2.5, 4.1, 12.34, 99.99]) {
      assert.equal(hundredthsToAcres(acresToHundredths(acres)), acres);
    }
  });
});

describe('the loan calculation', () => {
  test('the example from PRODUCT', () => {
    // "Cultivated Area: 4 acres, Rate ₹30,000, Maximum Loan ₹1,20,000"
    assert.equal(maximumLoan(acresToHundredths(4), 30000), 120000);
    assert.equal(formatIndianRupees(120000), '₹1,20,000');
  });

  test('fractional acreage stays exact in whole rupees', () => {
    assert.equal(maximumLoan(acresToHundredths(2.5), 40000), 100000);
    assert.equal(maximumLoan(acresToHundredths(4.1), 30000), 123000);
    assert.equal(maximumLoan(acresToHundredths(0.01), 30000), 300);
    assert.equal(maximumLoan(acresToHundredths(8.29), 45000), 373050);
  });

  test('a half rupee rounds up, deterministically', () => {
    // 0.01 acres at ₹25,000 is ₹250 exactly; 0.01 at ₹25,001 is ₹250.01 -> ₹250.
    assert.equal(maximumLoan(1, 25000), 250);
    assert.equal(maximumLoan(1, 25001), 250);
    // 1.5 rupees rounds to 2, not 1.
    assert.equal(maximumLoan(1, 150), 2);
    assert.equal(maximumLoan(1, 149), 1);
  });

  test('zero cultivated area is zero rupees, not an error', () => {
    assert.equal(maximumLoan(0, 50000), 0);
  });

  test('a nonsensical rate is a programming error, not a claim problem', () => {
    for (const rate of [0, -1, 1.5, '30000']) {
      assert.throws(() => maximumLoan(400, rate), /crop rate must be a positive whole number/);
    }
  });

  test('Indian digit grouping, which is what the customer reads', () => {
    assert.equal(formatIndianRupees(0), '₹0');
    assert.equal(formatIndianRupees(300), '₹300');
    assert.equal(formatIndianRupees(1000), '₹1,000');
    assert.equal(formatIndianRupees(100000), '₹1,00,000');
    assert.equal(formatIndianRupees(120000), '₹1,20,000');
    assert.equal(formatIndianRupees(373050), '₹3,73,050');
    assert.equal(formatIndianRupees(12345678), '₹1,23,45,678');
  });
});

describe('the lending policy as committed', () => {
  const policy = loadCropPolicy({ file: POLICY_FILE });

  test('every rate PRODUCT lists is present and within the demo ceiling', () => {
    const expected = { PADDY: 30000, WHEAT: 40000, MAIZE: 25000, COTTON: 45000, SUGARCANE: 50000 };
    for (const [crop, rate] of Object.entries(expected)) {
      assert.equal(policy.rate(crop), rate, `${crop} rate`);
      assert.ok(rate <= policy.maxRatePerAcre, `${crop} is within the ceiling`);
    }
    assert.deepEqual(policy.crops, Object.keys(expected).sort());
  });

  test('a crop the registry permits but the policy does not fund returns no rate', () => {
    // MILLET is in the LandRecord vocabulary on purpose, so the NOT ELIGIBLE
    // path has a real fixture rather than an invented value.
    assert.equal(policy.rate('MILLET'), null);
    assert.equal(policy.rate('paddy'), null, 'lookup is case sensitive; the registry stores upper case');
    assert.equal(policy.rate(''), null);
    assert.equal(policy.rate(undefined), null);
  });

  test('every committed rate produces a whole-rupee loan for a whole acre', () => {
    for (const crop of policy.crops) {
      const rate = policy.rate(crop);
      assert.equal(maximumLoan(acresToHundredths(1), rate), rate, `1 acre of ${crop}`);
    }
  });
});

describe('the policy loader refuses a policy it cannot trust', () => {
  const write = (policy) => {
    const dir = mkdtempSync(join(tmpdir(), 'crop-policy-'));
    const file = join(dir, 'crop-rates.json');
    writeFileSync(file, JSON.stringify(policy));
    return file;
  };

  test('a rate above the demo ceiling is a startup failure, not a higher limit', () => {
    const file = write({ maxRatePerAcre: 50000, rates: { PADDY: 60000 } });
    assert.throws(() => loadCropPolicy({ file }), /exceeds the permitted maximum/);
  });

  test('a fractional or non-positive rate is refused', () => {
    for (const rate of [0, -100, 30000.5]) {
      const file = write({ maxRatePerAcre: 50000, rates: { PADDY: rate } });
      assert.throws(() => loadCropPolicy({ file }), /non-positive or fractional rate/);
    }
  });

  test('an empty policy is refused rather than treated as "fund nothing"', () => {
    const file = write({ maxRatePerAcre: 50000, rates: {} });
    assert.throws(() => loadCropPolicy({ file }), /lists no crop rates/);
  });

  test('a missing ceiling is refused', () => {
    const file = write({ rates: { PADDY: 30000 } });
    assert.throws(() => loadCropPolicy({ file }), /no usable maxRatePerAcre/);
  });

  test('a lower-case crop name is refused, because lookups are case sensitive', () => {
    const file = write({ maxRatePerAcre: 50000, rates: { paddy: 30000 } });
    assert.throws(() => loadCropPolicy({ file }), /must be upper case/);
  });
});
