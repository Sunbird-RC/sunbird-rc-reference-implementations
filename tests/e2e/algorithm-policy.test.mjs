// The approved-algorithm policy, enforced against a running stack.
//
// REQUIREMENTS §8 asks the verifier to "validate credential signatures and
// approved algorithms", and to obtain a decision rather than claim an unenforced
// allowlist. Iteration 01 took the second option: `alg` lives in a JWS protected
// header, never reaches the claim set, and was not reported, so a policy field
// would have been a control that did nothing.
//
// oid4vc-service now reports the algorithms it observed on each presentation as
// `algs` (fork commit 1583b7bd, in the pinned build), so the control is real.
// Anand's Option A: enforce it. These tests are the evidence that it bites.
//
// The negative case that matters is a presentation which is CRYPTOGRAPHICALLY
// VALID and refused anyway. A broken signature is rejected by upstream long
// before any policy runs and proves nothing about the policy — so the wallet here
// holds a genuine ES384 key, uses it for proof of possession at issuance and for
// key binding at presentation, and upstream accepts the submission with HTTP 200.
// The refusal is entirely ours, and entirely about the algorithm.
//
//   cd deploy && docker compose up -d && ../scripts/bootstrap.sh
//   ../scripts/seed-agriculture.sh
//   npm run test:e2e

import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  deployEnv,
  requireStack,
  json,
  issueAgricultureCredential,
  startFarmCreditVerification,
  farmCreditPolicy,
  readFarmCreditVerification,
  requestUriFromQr,
} from './lib/stack.mjs';
import { signIn } from './lib/keycloak.mjs';
import {
  createHolder,
  collectCredential,
  requestCredential,
  presentSdJwt,
  fetchRequestObject,
  submitMultiPresentation,
} from './lib/wallet.mjs';

const { base, opsBase, demoPassword } = deployEnv();
const advertised = { farmer: {}, land: {} };
const FIXTURE = { username: 'farmer.ravi', farmerId: 'FRM-KA-0041' };

let skip = null;
let farmerIssuerDid = null;
let landIssuerDid = null;

before(async () => {
  skip = await requireStack(base);
  if (skip) return;
  const configs = await json(`${opsBase}/credential-schema/oid4vci-configs`);
  const list = Array.isArray(configs.body) ? configs.body : [];
  farmerIssuerDid = list.find((c) => c.name === 'Farmer Identity Credential')?.author || null;
  landIssuerDid = list.find((c) => c.name === 'Land Ownership Credential')?.author || null;
  if (!farmerIssuerDid || !landIssuerDid) {
    skip = 'the Agriculture credential schemas are not published — run scripts/bootstrap.sh';
    return;
  }
  if (!demoPassword) {
    skip = 'no DEMO_CITIZEN_PASSWORD in deploy/.env — run ./scripts/bootstrap.sh';
    return;
  }
  // What each registry advertises, so the wallet can ask for a credential and for a token
  // scoped to it.
  for (const which of ['farmer', 'land']) {
    const meta = await json(`${base}/${which}/.well-known/openid-credential-issuer`);
    const entries = Object.entries(meta.body?.credential_configurations_supported || {});
    if (entries.length === 0) {
      skip = `the ${which} registry advertises no credential — run ./scripts/bootstrap.sh`;
      return;
    }
    const [id, cfg] = entries[0];
    advertised[which] = { issuerBase: `${base}/${which}`, configurationId: id, scope: cfg.scope };
  }
});

const guard = () => {
  if (skip) throw new Error(skip);
};

async function registryRecord(entity) {
  const res = await json(`${opsBase}/api/v1/${entity}/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filters: { farmerId: { eq: FIXTURE.farmerId } } }),
  });
  const rows = Array.isArray(res.body) ? res.body : res.body?.data || [];
  return rows[0] || null;
}

/**
 * One full journey with a holder key of the given algorithm.
 *
 * The algorithm is used for proof of possession at issuance AND for key binding
 * at presentation, because `cnf` ties them together — a mismatch would fail the
 * holder-binding check and test something else entirely.
 */
async function applyWithHolderAlgorithm(alg) {
  const farmerRecord = await registryRecord('FarmerRecord');
  const landRecord = await registryRecord('LandRecord');
  assert.ok(farmerRecord && landRecord, `${FIXTURE.farmerId} must be seeded — run scripts/seed-agriculture.sh`);

  // Collected through the authorization-code flow, like the customer journey, so these
  // credentials carry the Authority linkage the bank's request asks for. The holder key is
  // still the algorithm under test — which is the only thing this file is about.
  const holder = await createHolder({ alg });
  const auth = await signIn({
    authorizationServer: `${base}/auth/realms/agriculture`,
    redirectUri: `${base}/wallet/redirect`,
    username: FIXTURE.username,
    password: demoPassword,
    scope: ['openid', advertised.farmer.scope, advertised.land.scope].filter(Boolean).join(' '),
  });
  assert.ok(auth.accessToken, `sign-in failed for ${FIXTURE.username}: ${auth.error}`);
  const collect = async (which) =>
    (
      await requestCredential({
        base: advertised[which].issuerBase,
        token: { access_token: auth.accessToken },
        holder,
        extra: { credential_configuration_id: advertised[which].configurationId },
      })
    ).credential;
  const farmer = await collect('farmer');
  const land = await collect('land');

  const session = await startFarmCreditVerification(base);
  const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
  const policy = await farmCreditPolicy(base);
  const submission = await submitMultiPresentation({
    base,
    responseUri: request.response_uri,
    state: request.state,
    presentations: {
      farmer_cred: await presentSdJwt({
        credential: farmer,
        disclose: policy.requestedClaims.farmer,
        nonce: request.nonce,
        audience: request.client_id,
        holder,
      }),
      land_cred: await presentSdJwt({
        credential: land,
        disclose: policy.requestedClaims.land,
        nonce: request.nonce,
        audience: request.client_id,
        holder,
      }),
    },
  });
  const { body } = await readFarmCreditVerification(base, session.sessionId);
  return { submission, result: body };
}

describe('the approved-algorithm policy is enforced', () => {
  test('the bank publishes which algorithms it approves', async () => {
    guard();
    // Read from the service, so the page and the evidence cannot claim a policy
    // the verifier does not hold.
    const policy = await farmCreditPolicy(base);
    assert.deepEqual(policy.approvedAlgorithms, ['ES256']);
  });

  test('an ES256 presentation is accepted, and the check is reported', async () => {
    guard();
    const { submission, result } = await applyWithHolderAlgorithm('ES256');
    assert.equal(submission.status, 200);
    assert.equal(result.state, 'decided');
    assert.equal(result.decision, 'ELIGIBLE');
    // The pill exists so the enforcement is visible on screen, not only in code.
    assert.equal(result.checks.algorithm, 'OK');
  });

  test('an unapproved algorithm is rejected, though every signature verifies', async () => {
    guard();
    const { submission, result } = await applyWithHolderAlgorithm('ES384');

    // Upstream ACCEPTED the presentation: the ES384 key binding is genuine, the
    // credential signatures are genuine, and nothing is tampered with. If this
    // were a 4xx the test would be proving something else.
    assert.equal(submission.status, 200, 'the presentation must be cryptographically valid');

    assert.equal(result.state, 'rejected');
    assert.equal(result.failedCheck, 'algorithm');
    assert.match(result.reason, /algorithm is not approved/);
    assert.match(result.diagnostic, /ES384/);

    // A rejection is not a business answer, and must never carry one.
    assert.equal(result.decision, undefined, 'an algorithm rejection is not a lending decision');
    assert.equal(result.loan, undefined);
    assert.equal(result.disclosed, undefined, 'no claims may be reported for a refused presentation');
  });

  test('an algorithm rejection is distinct from an untrusted issuer', async () => {
    guard();
    // Both are "we could not trust what we were shown", and both must be
    // reportable separately or the evidence cannot say which control fired.
    const { result } = await applyWithHolderAlgorithm('ES384');
    assert.equal(result.failedCheck, 'algorithm');
    assert.doesNotMatch(result.reason, /issuer/);
  });
});

// Absent and malformed algorithms are covered exhaustively in
// tests/unit/algorithm-policy.test.mjs, which drives the policy module directly.
// They are not reproducible end to end against this stack by design: the
// upstream helper omits an alg it could not parse rather than reporting a
// guessed one, so producing `algs: []` here would mean running a build that does
// not report algorithms at all. The unit tests assert that such a deployment is
// REFUSED rather than defaulted, which is the property that matters.
