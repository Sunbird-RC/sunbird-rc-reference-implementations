// The Agriculture farm-credit decision.
//
// The line these tests exist to hold: a verification problem is REJECTED /
// UNABLE TO VERIFY, and a business answer is NOT ELIGIBLE. PRODUCT says the
// first "must not be presented as ordinary business ineligibility", and the two
// are easy to confuse in code because both stop the loan.

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agricultureCredentialRequests,
  decideFarmCredit,
  loadCropPolicy,
  FARMER_CLAIMS,
  LAND_CLAIMS,
  FARMER_REQUEST_ID,
  LAND_REQUEST_ID,
} from '../../services/verifier/src/domains/agriculture/index.mjs';
import { buildDcqlQuery, ISSUER_CLAIM } from '../../services/verifier/src/core/dcql.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const policy = loadCropPolicy({ file: join(ROOT, 'config', 'policy', 'crop-rates.json') });

/** An eligible pair, from which each test varies exactly one thing. */
const eligible = () => ({
  farmer: { farmerId: 'FRM-KA-0041', registeredFarmer: true },
  land: {
    farmerId: 'FRM-KA-0041',
    ownershipStatus: 'ACTIVE',
    cropType: 'PADDY',
    cultivatedAreaAcres: 4,
  },
});

const rejects = (presented, code) =>
  assert.throws(() => decideFarmCredit(presented, policy), (err) => err.code === code, `expected ${code}`);

describe('what the bank asks for', () => {
  test('two credentials, and only the claims REQUIREMENTS permits', () => {
    const requests = agricultureCredentialRequests({ farmerVct: 'https://x/vct/farmer', landVct: 'https://x/vct/land' });
    assert.equal(requests.length, 2);
    assert.deepEqual(requests.map((r) => r.id), [FARMER_REQUEST_ID, LAND_REQUEST_ID]);
    assert.deepEqual(requests[0].claims, ['farmerId', 'registeredFarmer']);
    assert.deepEqual(requests[1].claims, ['farmerId', 'ownershipStatus', 'cropType', 'cultivatedAreaAcres']);
  });

  test('each request carries the role the verifier pins its issuer against', () => {
    const requests = agricultureCredentialRequests({ farmerVct: 'a', landVct: 'b' });
    assert.deepEqual(requests.map((r) => r.role), ['farmer', 'land']);
  });

  test('nothing the bank must never see is requested', () => {
    // REQUIREMENTS §5: National ID, name, address, date of birth, land id and
    // total land metadata are not disclosed. The strongest form of that
    // guarantee is not asking.
    const forbidden = ['nationalId', 'name', 'dateOfBirth', 'address', 'landId', 'landAreaAcres', 'farmerCategory', 'district'];
    for (const claim of [...FARMER_CLAIMS, ...LAND_CLAIMS]) {
      assert.ok(!forbidden.includes(claim), `${claim} must not be requested`);
    }
  });

  test('the requests build a valid two-credential DCQL query', () => {
    const requests = agricultureCredentialRequests({ farmerVct: 'https://x/vct/farmer', landVct: 'https://x/vct/land' });
    const query = buildDcqlQuery(requests);
    assert.equal(query.credentials.length, 2);
    for (const entry of query.credentials) {
      assert.equal(entry.format, 'dc+sd-jwt');
      assert.ok(entry.meta.vct_values.length === 1, 'the credential type is pinned');
      // `iss` is requested alongside the domain claims or there would be nothing
      // for the trust allowlist to check the issuer against.
      assert.ok(entry.claims.some((c) => c.path[0] === ISSUER_CLAIM));
    }
    assert.deepEqual(query.credentials.map((c) => c.meta.vct_values[0]), ['https://x/vct/farmer', 'https://x/vct/land']);
  });
});

describe('an eligible farmer', () => {
  test('the PRODUCT example, end to end', () => {
    const result = decideFarmCredit(eligible(), policy);
    assert.deepEqual(result, {
      outcome: 'ELIGIBLE',
      farmerId: 'FRM-KA-0041',
      cropType: 'PADDY',
      cultivatedAreaAcres: 4,
      ratePerAcre: 30000,
      maximumLoan: 120000,
    });
  });

  test('every funded crop produces its own rate and amount', () => {
    for (const crop of policy.crops) {
      const presented = eligible();
      presented.land.cropType = crop;
      presented.land.cultivatedAreaAcres = 2.5;
      const result = decideFarmCredit(presented, policy);
      assert.equal(result.outcome, 'ELIGIBLE', crop);
      assert.equal(result.ratePerAcre, policy.rate(crop));
      assert.equal(result.maximumLoan, policy.rate(crop) * 2.5, `${crop} at 2.5 acres`);
    }
  });

  test('the smallest fundable area is still eligible', () => {
    const presented = eligible();
    presented.land.cultivatedAreaAcres = 0.01;
    const result = decideFarmCredit(presented, policy);
    assert.equal(result.outcome, 'ELIGIBLE');
    assert.equal(result.maximumLoan, 300);
  });

  test('the result echoes only verified inputs, and no identity data', () => {
    const result = decideFarmCredit(eligible(), policy);
    const serialised = JSON.stringify(result);
    for (const forbidden of ['NAT-', 'nationalId', 'name', 'landId', 'landAreaAcres', 'district']) {
      assert.equal(serialised.includes(forbidden), false, `${forbidden} must not reach the bank`);
    }
  });
});

describe('a verified business answer: NOT ELIGIBLE', () => {
  test('not a registered farmer', () => {
    const presented = eligible();
    presented.farmer.registeredFarmer = false;
    const result = decideFarmCredit(presented, policy);
    assert.equal(result.outcome, 'NOT_ELIGIBLE');
    assert.match(result.reason, /registered farmer/);
  });

  test('ownership that is not active', () => {
    for (const status of ['INACTIVE', 'DISPUTED', 'TRANSFERRED']) {
      const presented = eligible();
      presented.land.ownershipStatus = status;
      const result = decideFarmCredit(presented, policy);
      assert.equal(result.outcome, 'NOT_ELIGIBLE', status);
      assert.match(result.reason, /no active land ownership/);
    }
  });

  test('nothing cultivated', () => {
    const presented = eligible();
    presented.land.cultivatedAreaAcres = 0;
    const result = decideFarmCredit(presented, policy);
    assert.equal(result.outcome, 'NOT_ELIGIBLE');
    assert.match(result.reason, /no cultivated area/);
  });

  test('a crop the policy does not fund', () => {
    const presented = eligible();
    presented.land.cropType = 'MILLET';
    const result = decideFarmCredit(presented, policy);
    assert.equal(result.outcome, 'NOT_ELIGIBLE');
    assert.match(result.reason, /MILLET is not in the approved lending policy/);
  });

  test('a business answer never carries a loan amount', () => {
    const presented = eligible();
    presented.farmer.registeredFarmer = false;
    const result = decideFarmCredit(presented, policy);
    assert.equal(result.maximumLoan, undefined);
    assert.equal(result.ratePerAcre, undefined);
  });
});

describe('a verification failure: REJECTED / UNABLE TO VERIFY', () => {
  test('the two credentials name different farmers', () => {
    const presented = eligible();
    presented.land.farmerId = 'FRM-KA-0099';
    rejects(presented, 'CORRELATION_FAILED');
  });

  test('a missing credential', () => {
    rejects({ farmer: eligible().farmer, land: undefined }, 'CORRELATION_FAILED');
    rejects({ farmer: undefined, land: eligible().land }, 'CORRELATION_FAILED');
  });

  test('a farmerId that is absent or not a string', () => {
    for (const bad of [undefined, '', 42, null, {}]) {
      const a = eligible(); a.farmer.farmerId = bad; rejects(a, 'MALFORMED_CLAIM');
      const b = eligible(); b.land.farmerId = bad; rejects(b, 'MALFORMED_CLAIM');
    }
  });

  test('registeredFarmer that is not a boolean — including the string "false"', () => {
    // "false" is truthy in JavaScript. A lending gate that funds on it is the
    // exact bug this showcase exists to prove absent, so it is refused rather
    // than read either way.
    for (const bad of ['false', 'true', 1, 0, null, undefined]) {
      const presented = eligible();
      presented.farmer.registeredFarmer = bad;
      rejects(presented, 'MALFORMED_CLAIM');
    }
  });

  test('an ownership status outside the registry vocabulary', () => {
    for (const bad of ['active', 'PENDING', '', 7, null]) {
      const presented = eligible();
      presented.land.ownershipStatus = bad;
      rejects(presented, 'MALFORMED_CLAIM');
    }
  });

  test('an acreage the schema could not have produced', () => {
    for (const bad of [4.005, '4', -1, null, Number.NaN]) {
      const presented = eligible();
      presented.land.cultivatedAreaAcres = bad;
      rejects(presented, 'MALFORMED_CLAIM');
    }
  });

  test('correlation is checked before any business rule', () => {
    // A farmer who is both unregistered AND mismatched must be REJECTED, not
    // NOT ELIGIBLE: the ordering in DESIGN §9 is what stops a verification
    // failure being reported as an ordinary business outcome.
    const presented = eligible();
    presented.farmer.registeredFarmer = false;
    presented.land.farmerId = 'FRM-KA-0099';
    rejects(presented, 'CORRELATION_FAILED');
  });
});
