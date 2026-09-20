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
  startFarmCreditVerification,
  readFarmCreditVerification,
  requestUriFromQr,
  farmCreditPolicy,
} from './lib/stack.mjs';
import { signIn } from './lib/keycloak.mjs';
import {
  createHolder,
  requestCredential,
  presentSdJwt,
  fetchRequestObject,
  submitMultiPresentation,
} from './lib/wallet.mjs';

const { base, demoPassword } = deployEnv();
const REALM = `${base}/auth/realms/agriculture`;
const REDIRECT_URI = `${base}/wallet/redirect`;
const AUTHORITY = process.env.AUTHORITY_URL || 'http://127.0.0.1:3334';
// Lakshmi rather than Ravi, because this file changes its subject's record and the rest of
// the suite depends on Ravi being the canonical eligible farmer.
const SUBJECT = { username: 'farmer.lakshmi', nationalId: 'NAT-90023815', farmerId: 'FRM-PB-0117' };

let skip = null;
let wallet = null;
const advertised = { farmer: {}, land: {} };

/** Moves a record's lifecycle through the Authority Service, as an officer would. */
async function lifecycle(localId, state) {
  const officer = localId.startsWith('FRM-') ? 'agri-farmer-officer' : 'agri-land-officer';
  const entity = localId.startsWith('FRM-') ? 'FarmerRecord' : 'LandRecord';
  const field = localId.startsWith('FRM-') ? 'farmerId' : 'landId';
  const headers = {
    'x-dev-issuer': 'https://idp.test',
    'x-dev-subject': officer,
    'content-type': 'application/json',
  };
  const authorities = await (await fetch(`${AUTHORITY}/api/v1/authorities`, {
    headers: { ...headers, 'x-dev-subject': 'bootstrap' },
  })).json();
  const list = Array.isArray(authorities) ? authorities : authorities.items || [];
  for (const a of list) {
    const bindings = await (await fetch(`${AUTHORITY}/api/v1/authorities/${a.id}/registries`, {
      headers: { ...headers, 'x-dev-subject': 'bootstrap' },
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

/** Presents the credentials this wallet already holds, and reads the bank's answer. */
async function applyForCredit() {
  const session = await startFarmCreditVerification(base);
  const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
  const policy = await farmCreditPolicy(base);
  const presentations = {
    farmer_cred: await presentSdJwt({
      credential: wallet.farmer.credential,
      disclose: policy.requestedClaims.farmer,
      nonce: request.nonce,
      audience: request.client_id,
      holder: wallet.holder,
    }),
    land_cred: await presentSdJwt({
      credential: wallet.land.credential,
      disclose: policy.requestedClaims.land,
      nonce: request.nonce,
      audience: request.client_id,
      holder: wallet.holder,
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

  // Inactivation is deliberately NOT exercised here. It is terminal — the Authority
  // refuses INACTIVE -> ACTIVE — so a test that used it would destroy its own fixture for
  // every later run, and no cleanup could undo that. The precedence it sits in is covered
  // against the status route itself, which can be asked about a credential without needing
  // a record to survive the asking.
});
