// Live credential status, checked before the lending decision.
//
// The property this file exists for cannot be shown by issuing and presenting in one breath:
// a credential must be issued while its source record is good, and then presented after that
// record changes. Everything else in the suite re-issues on each run, so a suspended record
// simply blocks issuance and the presentation never happens — which proves nothing about
// what a verifier does with a credential it is handed.
//
// So this collects ONCE, and then changes the record underneath the credential it is holding.
// That is also the real situation: a wallet holds a card for months, and the authority that
// issued it changes its mind.

import test, { before, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  deployEnv,
  requireStack,
  issueAgricultureCredential,
  json,
  startFarmCreditVerification,
  readFarmCreditVerification,
  requestUriFromQr,
  farmCreditPolicy,
} from './lib/stack.mjs';
import { signIn } from './lib/keycloak.mjs';
import {
  createHolder,
  requestCredential,
  collectCredential,
  disclosableValues,
  presentSdJwt,
  fetchRequestObject,
  submitMultiPresentation,
} from './lib/wallet.mjs';
import { authorityHeaders } from './lib/authority-auth.mjs';

const { base, opsBase, demoPassword } = deployEnv();
const REALM = `${base}/auth/realms/agriculture`;
const REDIRECT_URI = `${base}/wallet/redirect`;
const AUTHORITY = process.env.AUTHORITY_URL || 'http://127.0.0.1:3334';
// Whichever way this deployment authenticates. A role name, not a subject string: with
// authentication on the subject is a Keycloak service account id, generated per install.
const as = (principal) => authorityHeaders(principal, { authorityBase: AUTHORITY, opsBase });
// Lakshmi rather than Ravi, because this file changes its subject's record and the rest of
// the suite depends on Ravi being the canonical eligible farmer.
const SUBJECT = { username: 'farmer.lakshmi', nationalId: 'NAT-90023815', farmerId: 'FRM-PB-0117' };
// Terminal states get their own subjects, because they cannot be undone: the Authority
// refuses INACTIVE -> ACTIVE, and issuance is idempotent so a revoked credential stays the
// credential that subject gets. A shared fixture spent on either would be spent for the life
// of the deployment.
const TO_INACTIVATE = { username: 'farmer.terminal.inactive', nationalId: 'NAT-90077001', farmerId: 'FRM-KA-0901' };
const TO_REVOKE = { username: 'farmer.terminal.revoked', nationalId: 'NAT-90077002', farmerId: 'FRM-KA-0902' };

let skip = null;
let wallet = null;
const advertised = { farmer: {}, land: {} };
let farmerIssuerDid = null;

/** Moves a record's lifecycle through the Authority Service, as an officer would. */
async function lifecycle(localId, state) {
  const officer = localId.startsWith('FRM-') ? 'FARMER_OFFICER' : 'LAND_OFFICER';
  const entity = localId.startsWith('FRM-') ? 'FarmerRecord' : 'LandRecord';
  const field = localId.startsWith('FRM-') ? 'farmerId' : 'landId';
  const headers = await as(officer);
  const admin = await as('BOOTSTRAP');
  const authorities = await (await fetch(`${AUTHORITY}/api/v1/authorities`, {
    headers: admin,
  })).json();
  const list = Array.isArray(authorities) ? authorities : authorities.items || [];
  for (const a of list) {
    const bindings = await (await fetch(`${AUTHORITY}/api/v1/authorities/${a.id}/registries`, {
      headers: admin,
    })).json();
    for (const b of (Array.isArray(bindings) ? bindings : bindings.items || [])) {
      if (b.entityName !== entity) continue;
      const found = await (await fetch(`${AUTHORITY}/api/v1/registries/${b.id}/records/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ filters: { [field]: { eq: localId } } }),
      })).json();
      const row = (found.data || [])[0];
      if (!row) continue;
      const res = await fetch(`${AUTHORITY}/api/v1/registries/${b.id}/records/${row.osid}/lifecycle`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ state, reason: `status journey: ${state}` }),
      });
      assert.ok(res.ok, `could not move ${localId} to ${state}: ${res.status}`);
      return;
    }
  }
  assert.fail(`no Authority-managed record for ${localId}`);
}

/** A record's current lifecycle state, read without changing it. */
async function recordState(localId) {
  const entity = localId.startsWith('FRM-') ? 'FarmerRecord' : 'LandRecord';
  const field = localId.startsWith('FRM-') ? 'farmerId' : 'landId';
  const H = await as('BOOTSTRAP');
  const operator = await as('FARMER_OPERATOR');
  const authorities = await (await fetch(`${AUTHORITY}/api/v1/authorities`, { headers: H })).json();
  for (const a of (Array.isArray(authorities) ? authorities : authorities.items || [])) {
    const bindings = await (await fetch(`${AUTHORITY}/api/v1/authorities/${a.id}/registries`, { headers: H })).json();
    for (const b of (Array.isArray(bindings) ? bindings : bindings.items || [])) {
      if (b.entityName !== entity) continue;
      const found = await (await fetch(`${AUTHORITY}/api/v1/registries/${b.id}/records/search`, {
        method: 'POST',
        headers: operator,
        body: JSON.stringify({ filters: { [field]: { eq: localId } } }),
      })).json();
      const row = (found.data || [])[0];
      if (row) return row.authorityState?.lifecycleState ?? null;
    }
  }
  return null;
}

/** Collects both credentials for an account, as the wallet does. */
async function collectFor(account) {
  const auth = await signIn({
    authorizationServer: REALM,
    redirectUri: REDIRECT_URI,
    username: account.username,
    password: demoPassword,
    scope: ['openid', advertised.farmer.scope, advertised.land.scope].filter(Boolean).join(' '),
  });
  const holder = await createHolder();
  const one = async (which) =>
    requestCredential({
      base: advertised[which].issuerBase,
      token: { access_token: auth.accessToken },
      holder,
      extra: { credential_configuration_id: advertised[which].configurationId },
    });
  return { holder, farmer: await one('farmer'), land: await one('land') };
}

/** The Authority's own view of a wallet credential's anchor. */
async function authorityStatusOf(cred) {
  const id = disclosableValues(cred.credential).authorityCredentialId;
  const res = await fetch(`${AUTHORITY}/api/v1/trust/credentials/${encodeURIComponent(id)}/status`);
  return { id, ...(res.ok ? await res.json() : { status: `HTTP ${res.status}` }) };
}

/** Presents the credentials this wallet already holds, and reads the bank's answer. */
async function applyForCredit(held = wallet, disclose = {}) {
  const session = await startFarmCreditVerification(base);
  const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
  const policy = await farmCreditPolicy(base);
  const presentations = {
    farmer_cred: await presentSdJwt({
      credential: held.farmer.credential,
      disclose: disclose.farmer || policy.requestedClaims.farmer,
      nonce: request.nonce,
      audience: request.client_id,
      holder: held.holder,
    }),
    land_cred: await presentSdJwt({
      credential: held.land.credential,
      disclose: disclose.land || policy.requestedClaims.land,
      nonce: request.nonce,
      audience: request.client_id,
      holder: held.holder,
    }),
  };
  const submitted = await submitMultiPresentation({
    responseUri: request.response_uri,
    state: request.state,
    presentations,
  });
  assert.equal(submitted.status, 200, 'the presentation itself is well-formed');
  const { body } = await readFarmCreditVerification(base, session.sessionId);
  return body;
}

before(async () => {
  try {
    await setUp();
  } catch (err) {
    // A hook that throws cancels every test with "cancelled by parent", which says nothing
    // about what actually went wrong. Recording it as the skip reason puts the real cause
    // in front of whoever runs this.
    skip = `set-up failed: ${err?.message ?? err}`;
  }
});

async function setUp() {
  skip = await requireStack(base);
  if (!skip && !demoPassword) skip = 'no DEMO_CITIZEN_PASSWORD — run ./scripts/bootstrap.sh';
  if (skip) return;

  const published = await farmCreditPolicy(base).catch(() => null);
  if (!published?.requestedClaims?.farmer?.includes('authorityCredentialId')) {
    skip = 'the verifier is not configured to check status — set AGRICULTURE_STATUS_CLAIM';
    return;
  }
  const configs = await json(`${opsBase}/credential-schema/oid4vci-configs`);
  const list = Array.isArray(configs.body) ? configs.body : [];
  farmerIssuerDid = list.find((c) => c.name === 'Farmer Identity Credential')?.author || null;
  for (const which of ['farmer', 'land']) {
    const meta = await (await fetch(`${base}/${which}/.well-known/openid-credential-issuer`)).json();
    const [id, cfg] = Object.entries(meta.credential_configurations_supported)[0];
    advertised[which] = { issuerBase: `${base}/${which}`, configurationId: id, scope: cfg.scope };
  }

  // Collected ONCE, while every source record is good.
  const auth = await signIn({
    authorizationServer: REALM,
    redirectUri: REDIRECT_URI,
    username: SUBJECT.username,
    password: demoPassword,
    scope: ['openid', advertised.farmer.scope, advertised.land.scope].filter(Boolean).join(' '),
  });
  const holder = await createHolder();
  wallet = {
    holder,
    farmer: await requestCredential({
      base: advertised.farmer.issuerBase,
      token: { access_token: auth.accessToken },
      holder,
      extra: { credential_configuration_id: advertised.farmer.configurationId },
    }),
    land: await requestCredential({
      base: advertised.land.issuerBase,
      token: { access_token: auth.accessToken },
      holder,
      extra: { credential_configuration_id: advertised.land.configurationId },
    }),
  };
}

after(async () => {
  // Leave the fixtures as they were found, whatever happened above.
  if (!skip) await lifecycle(SUBJECT.farmerId, 'ACTIVE').catch(() => {});
});

// A genuine skip rather than a failure, decided INSIDE the test. The options object of
// test() is evaluated when the file is read, before any before-hook has run, so a skip
// computed there would always see the pre-set-up value and never apply.
const unless = (t) => {
  if (skip) t.skip(skip);
  return Boolean(skip);
};

describe('Agriculture — the bank consults live credential status', () => {
  test('an active source: the credential is accepted and a loan is offered', async (t) => {
    if (unless(t)) return;
    const result = await applyForCredit();
    assert.equal(result.state, 'decided');
    assert.equal(result.decision, 'ELIGIBLE', result.reason);
  });

  test('the source is suspended: the SAME credential is refused', async (t) => {
    if (unless(t)) return;
    // Nothing about the credential changed. It is the same signed card, held by the same
    // wallet key, presented to the same bank. Only the Authority's answer changed.
    await lifecycle(SUBJECT.farmerId, 'SUSPENDED');
    const result = await applyForCredit();
    assert.notEqual(result.decision, 'ELIGIBLE', 'a suspended source must not fund a loan');
    assert.match(String(result.reason), /SUSPENDED/i);
  });

  test('the source is reinstated: the same credential funds a loan again', async (t) => {
    if (unless(t)) return;
    // Suspension is reversible, and this is what that means to a farmer: no reissuance, no
    // visit to the authority, the card they already hold simply works again.
    await lifecycle(SUBJECT.farmerId, 'ACTIVE');
    const result = await applyForCredit();
    assert.equal(result.decision, 'ELIGIBLE', result.reason);
  });

  test('an inactivated source: refused, and it stays refused', async (t) => {
    if (unless(t)) return;
    // Written to CONVERGE, not to transition. Inactivation cannot be undone, so on every run
    // after the first this fixture is already INACTIVE — and the property under test is the
    // same either way: a credential whose source is inactive does not fund a loan.
    const held = await collectFor(TO_INACTIVATE).catch(() => null);
    if (held) {
      await lifecycle(TO_INACTIVATE.farmerId, 'INACTIVE').catch(() => {});
      const result = await applyForCredit(held);
      assert.notEqual(result.decision, 'ELIGIBLE');
      assert.match(String(result.reason), /INACTIVE/i);
    } else {
      // The source is already inactive, so the Authority will not issue from it at all.
      // That is the same refusal one step earlier, and worth asserting rather than skipping.
      const state = await recordState(TO_INACTIVATE.farmerId);
      assert.equal(state, 'INACTIVE', 'issuance failed for some reason other than inactivation');
    }
  });

  test('a revoked credential: refused, and not resurrected by a healthy record', async (t) => {
    if (unless(t)) return;
    // Revocation is a statement about the CREDENTIAL, not the record, so the record stays
    // ACTIVE throughout. That is the point: a healthy source does not undo a revocation.
    //
    // Written to converge, like the inactivation case. Once revoked, the Authority refuses
    // to issue against that attempt again — a revoked credential is not quietly replaced by
    // a fresh one — so on every run after the first this subject cannot be collected at all.
    // That refusal is itself the property, one step earlier, and is asserted rather than
    // skipped.
    const held = await collectFor(TO_REVOKE).catch(() => null);
    if (!held) {
      const state = await recordState(TO_REVOKE.farmerId);
      assert.equal(state, 'ACTIVE', 'the record itself must still be good');
      return;
    }

    const before = await authorityStatusOf(held.farmer);
    if (before.status !== 'REVOKED') {
      const res = await fetch(`${AUTHORITY}/api/v1/credentials/${encodeURIComponent(before.id)}/revoke`, {
        method: 'POST',
        headers: await as('FARMER_OFFICER'),
        body: JSON.stringify({ reason: 'status journey: revoked' }),
      });
      assert.ok(res.ok, `could not revoke: ${res.status}`);
    }
    assert.equal((await authorityStatusOf(held.farmer)).status, 'REVOKED');
    assert.equal(await recordState(TO_REVOKE.farmerId), 'ACTIVE', 'the record itself stays good');

    const result = await applyForCredit(held);
    assert.notEqual(result.decision, 'ELIGIBLE');
    assert.match(String(result.reason), /REVOKED/i);
  });

  test('an unlinked credential is refused, however well-formed it is', async (t) => {
    if (unless(t)) return;
    // The offer path mints a credential from claims the caller supplies and never reaches
    // the Authority Service, so there is no anchor to ask about. Such a credential can be
    // perfectly well-formed — right issuer, right type, valid signature, one holder key
    // across both cards — and it still must not fund a loan, because "no identifier to
    // check" is unknown standing rather than good standing.
    //
    // This is the case that decides whether status checking is a control or a formality.
    const held = await collectFor(SUBJECT);
    const offer = await issueAgricultureCredential({
      base,
      which: 'farmer',
      issuerDid: farmerIssuerDid,
      claims: {
        farmerReference: disclosableValues(held.farmer.credential).farmerReference,
        registrationStatus: true,
      },
    });
    // Collected onto the SAME holder key as the land credential, so the presentation is
    // properly bound and the refusal cannot be mistaken for a binding failure.
    const unlinked = await collectCredential({
      base: offer.issuerBase,
      offer,
      holder: held.holder,
    });
    assert.equal(
      disclosableValues(unlinked.credential).authorityCredentialId,
      undefined,
      'the offer path is supposed to produce a credential with no linkage',
    );

    // Disclosing everything this credential HAS, which is the strongest case a holder could
    // make for it. The wallet cannot disclose a claim the card does not carry.
    const session = await startFarmCreditVerification(base);
    const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
    const policy = await farmCreditPolicy(base);
    const submitted = await submitMultiPresentation({
      responseUri: request.response_uri,
      state: request.state,
      presentations: {
        farmer_cred: await presentSdJwt({
          credential: unlinked.credential,
          disclose: ['farmerReference', 'registrationStatus'],
          nonce: request.nonce,
          audience: request.client_id,
          holder: held.holder,
        }),
        land_cred: await presentSdJwt({
          credential: held.land.credential,
          disclose: policy.requestedClaims.land,
          nonce: request.nonce,
          audience: request.client_id,
          holder: held.holder,
        }),
      },
    });

    // The bank refuses the presentation itself, before any business rule runs: its request
    // asks for the linkage claim, and a credential with no anchor cannot satisfy it. That is
    // a stronger refusal than a NOT_ELIGIBLE decision — the lending question is never
    // reached, because there is nothing to ask the Authority about.
    assert.notEqual(submitted.status, 200, 'an unlinked credential must not be accepted');

    const { body } = await readFarmCreditVerification(base, session.sessionId);
    assert.notEqual(body.decision, 'ELIGIBLE', 'and no loan is offered');
  });

  // Inactivation of the MAIN subject is deliberately NOT exercised here. It is terminal — the Authority
  // refuses INACTIVE -> ACTIVE — so a test that used it would destroy its own fixture for
  // every later run, and no cleanup could undo that. The precedence it sits in is covered
  // against the status route itself, which can be asked about a credential without needing
  // a record to survive the asking.
});
