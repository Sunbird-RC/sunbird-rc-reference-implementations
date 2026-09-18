// Resolving the allowlist against the Authority Service instead of a file.
//
// The property under test is not "a DID can be fetched". It is that resolution
// changes WHERE a DID comes from and nothing else: an issuer that resolves is
// still only trusted for the roles the policy grants it, and an issuer that does
// not resolve stops the verifier from starting rather than quietly leaving the
// allowlist.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadTrustPolicy, resolveTrustPolicy } from '../../services/verifier/src/core/trust.mjs';

const BASE = 'http://authority.test:3334';
const FARMER_ID = '1e10170e-71dc-4496-ae93-9300eb3a2c3a';
const LAND_ID = '2f20281f-82ed-55a7-bf04-a411fc4b3d4b';
const FARMER_DID = 'did:web:agri.example.org:farmer';
const LAND_DID = 'did:web:agri.example.org:land';
const AGE_DID = 'did:web:age.example.org:national-identity';

function policyFile(contents) {
  const dir = mkdtempSync(join(tmpdir(), 'trust-resolve-'));
  const file = join(dir, 'issuers.json');
  writeFileSync(file, JSON.stringify(contents));
  return file;
}

// A stand-in for the Authority Service's public trust route. Returns exactly the
// shape the real one returns — checked against a running service, not invented.
function authority(published, { fail } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (fail) throw new Error(fail);
    const id = decodeURIComponent(url.split('/').pop());
    const body = published[id];
    if (!body) return { ok: false, status: 404, json: async () => ({ code: 'NOT_FOUND' }) };
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetchImpl, calls };
}

const PUBLISHED = {
  [FARMER_ID]: {
    issuer: FARMER_DID,
    name: { en: 'Farmer Authority' },
    verificationMethods: [{ id: 'key-0', type: 'IDENTITY_SERVICE_DID', algorithm: 'Ed25519', reference: FARMER_DID }],
  },
  [LAND_ID]: {
    issuer: LAND_DID,
    name: { en: 'Land Authority' },
    verificationMethods: [{ id: 'key-0', type: 'IDENTITY_SERVICE_DID', algorithm: 'Ed25519', reference: LAND_DID }],
  },
};

const AGRI_POLICY = {
  issuers: [
    { name: 'Farmer Registry', authorityIssuer: FARMER_ID, credentials: ['Farmer Identity Credential'], roles: ['farmer'] },
    { name: 'Land Registry', authorityIssuer: LAND_ID, credentials: ['Land Ownership Credential'], roles: ['land'] },
  ],
};

test('an issuer named in the policy is resolved to its published DID', async () => {
  const { fetchImpl, calls } = authority(PUBLISHED);
  const trust = await resolveTrustPolicy({ file: policyFile(AGRI_POLICY), baseUrl: BASE, fetchImpl });

  const result = trust.check(FARMER_DID, { role: 'farmer' });
  assert.equal(result.ok, true);
  assert.equal(result.issuer.did, FARMER_DID);
  assert.equal(calls[0], `${BASE}/api/v1/trust/issuers/${FARMER_ID}`);
});

test('resolution does not widen trust: the role constraint still refuses the wrong slot', async () => {
  // The property the Land-must-come-from-the-Land-Authority test depends on. If
  // resolution replaced the allowlist rather than sourcing it, a resolvable
  // issuer would satisfy any slot, and this is where that would show.
  const { fetchImpl } = authority(PUBLISHED);
  const trust = await resolveTrustPolicy({ file: policyFile(AGRI_POLICY), baseUrl: BASE, fetchImpl });

  const wrongSlot = trust.check(FARMER_DID, { role: 'land' });
  assert.equal(wrongSlot.ok, false);
  assert.match(wrongSlot.reason, /not trusted to issue the land credential/);

  assert.equal(trust.check(LAND_DID, { role: 'land' }).ok, true);
});

test('an issuer the Authority Service does not publish stops the verifier starting', async () => {
  // 404 is also the answer for "no such issuer" — the route will not say which,
  // so that it cannot be used to enumerate identifiers. Either way, unusable.
  const { fetchImpl } = authority({ [LAND_ID]: PUBLISHED[LAND_ID] });
  await assert.rejects(
    () => resolveTrustPolicy({ file: policyFile(AGRI_POLICY), baseUrl: BASE, fetchImpl }),
    /did not publish issuer "Farmer Registry".*404/s,
  );
});

test('an unreachable Authority Service stops the verifier starting', async () => {
  // Not "start without that issuer". A verifier that drops an unreachable issuer
  // keeps serving and rejects its credentials as untrusted, which looks like a
  // credential fault and is a long way from the cause.
  const { fetchImpl } = authority(PUBLISHED, { fail: 'connect ECONNREFUSED' });
  await assert.rejects(
    () => resolveTrustPolicy({ file: policyFile(AGRI_POLICY), baseUrl: BASE, fetchImpl }),
    /could not reach the Authority Service.*ECONNREFUSED/s,
  );
});

test('a published response carrying no DID is refused', async () => {
  const { fetchImpl } = authority({ [FARMER_ID]: { name: { en: 'Farmer Authority' } }, [LAND_ID]: PUBLISHED[LAND_ID] });
  await assert.rejects(
    () => resolveTrustPolicy({ file: policyFile(AGRI_POLICY), baseUrl: BASE, fetchImpl }),
    /returned no issuer DID/,
  );
});

test('literal DIDs and Authority Service issuers coexist in one policy', async () => {
  // Only two of the six issuers moved. Age and the Education institutions have no
  // Authority Service configuration, and this iteration must not break them.
  const mixed = {
    issuers: [
      { name: 'National Identity Authority', did: '${AGE_ISSUER_DID}', credentials: ['Age Verification Credential'] },
      ...AGRI_POLICY.issuers,
    ],
  };
  const { fetchImpl, calls } = authority(PUBLISHED);
  const trust = await resolveTrustPolicy({
    file: policyFile(mixed),
    env: { AGE_ISSUER_DID: AGE_DID },
    baseUrl: BASE,
    fetchImpl,
  });

  assert.equal(trust.check(AGE_DID).ok, true, 'the file-sourced issuer still works');
  assert.equal(trust.check(FARMER_DID, { role: 'farmer' }).ok, true);
  assert.equal(calls.length, 2, 'only the Authority Service entries are fetched');
});

test('an unset ${VAR} still fails, even when other entries resolve', async () => {
  const mixed = {
    issuers: [
      { name: 'National Identity Authority', did: '${AGE_ISSUER_DID}', credentials: [] },
      ...AGRI_POLICY.issuers,
    ],
  };
  const { fetchImpl } = authority(PUBLISHED);
  await assert.rejects(
    () => resolveTrustPolicy({ file: policyFile(mixed), env: {}, baseUrl: BASE, fetchImpl }),
    /AGE_ISSUER_DID, which is not set/,
  );
});

test('the policy name wins, and the published name fills a gap', async () => {
  // Resolution supplies a DID. It must not quietly relabel an issuer in output a
  // relying party shows its own customers — preferring the published name changed
  // the bank's answer from "Farmer Registry" to "Farmer Authority", and the e2e
  // suite caught it. The published name is still used when the policy has none.
  const { fetchImpl } = authority(PUBLISHED);
  const named = await resolveTrustPolicy({ file: policyFile(AGRI_POLICY), baseUrl: BASE, fetchImpl });
  assert.equal(named.check(FARMER_DID).issuer.name, 'Farmer Registry');
  assert.equal(named.check(LAND_DID).issuer.name, 'Land Registry');

  const anonymous = {
    issuers: [{ name: '', authorityIssuer: FARMER_ID, credentials: [], roles: ['farmer'] }],
  };
  const fallback = await resolveTrustPolicy({ file: policyFile(anonymous), baseUrl: BASE, fetchImpl });
  assert.equal(fallback.check(FARMER_DID).issuer.name, 'Farmer Authority');
});

test('the file-only loader refuses an Authority Service entry rather than dropping it', () => {
  // Silently skipping would shrink the allowlist, and the credential it covers
  // would be rejected as "not in the allowlist" — the wrong symptom entirely.
  assert.throws(
    () => loadTrustPolicy({ file: policyFile(AGRI_POLICY), env: {} }),
    /names an Authority Service issuer.*resolveTrustPolicy/s,
  );
});

test('an issuer needing the Authority Service with no base URL configured is refused', async () => {
  const { fetchImpl } = authority(PUBLISHED);
  await assert.rejects(
    () => resolveTrustPolicy({ file: policyFile(AGRI_POLICY), baseUrl: '', fetchImpl }),
    /needs the Authority Service, but no base URL was configured/,
  );
});

test('a resolved issuer carries the Authority that vouched for it', async () => {
  // This is what binds a status check to a configured endpoint. The verifier reads it from
  // the trust result rather than from the credential, so a credential cannot nominate where
  // its own status is looked up.
  const { fetchImpl } = authority(PUBLISHED);
  const trust = await resolveTrustPolicy({ file: policyFile(AGRI_POLICY), baseUrl: `${BASE}/`, fetchImpl });
  const result = trust.check(FARMER_DID, { role: 'farmer' });
  assert.equal(result.issuer.authorityBaseUrl, BASE, 'trailing slash normalised');
});

test('an issuer configured as a literal DID carries no Authority endpoint', async () => {
  // Nothing vouches for it, so there is nothing to ask about its credentials' status. The
  // caller must read an empty endpoint as "cannot check" rather than "no check needed".
  const policy = { issuers: [{ name: 'National Identity Authority', did: '${AGE_ISSUER_DID}', credentials: [] }] };
  const { fetchImpl } = authority(PUBLISHED);
  const trust = await resolveTrustPolicy({
    file: policyFile(policy), env: { AGE_ISSUER_DID: AGE_DID }, baseUrl: BASE, fetchImpl,
  });
  assert.equal(trust.check(AGE_DID).issuer.authorityBaseUrl, '');
});
