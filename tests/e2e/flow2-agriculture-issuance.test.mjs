// Wallet-driven issuance for Iteration 02, end to end against a live stack.
//
// The Agriculture counterpart of flow1-wallet-issuance.test.mjs, and the reason
// it exists separately: every other Agriculture test gets credentials into the
// wallet with a PRE-AUTHORISED offer, which is supporting protocol evidence and
// explicitly not the customer journey. The charter's journey is the farmer
// signing in INSIDE the wallet and the wallet fetching each credential itself.
//
// Two issuers make this more than a copy. Each registry is its own credential
// issuer with its own authorization server realm, its own scope and its own DID,
// and the farmer collects from both with one token and one holder key. The
// failure this catches is a registry whose Keycloak wiring is subtly different
// from the other's — nothing else in the suite would notice, and on a device it
// appears as "something went wrong" on the second card only.
//
// What a real device still adds is the wallet's own UI: the issuer directory,
// the in-app browser, the trust screen, preview-then-approve. Those are the
// recordings. Everything the SERVER contributes to that journey is here, so a
// failed device session can be attributed to the wallet rather than the stack.
//
//   ./scripts/bootstrap.sh          # generates the demo password
//   ./scripts/seed-agriculture.sh
//   npm run test:e2e

import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deployEnv, requireStack, json } from './lib/stack.mjs';
import { signIn, WALLET_CLIENT_ID } from './lib/keycloak.mjs';
import { createHolder, requestCredential, tryRequestCredential, disclosableValues } from './lib/wallet.mjs';

const { base, opsBase, demoPassword } = deployEnv();

/** Accounts and the registry records they map to — deploy/keycloak/realm-agriculture.json. */
const REALM = `${base}/auth/realms/agriculture`;
const AGE_REALM = `${base}/auth/realms/age`;
const REDIRECT_URI = `${base}/wallet/redirect`;
const RAVI = { username: 'farmer.ravi', nationalId: 'NAT-90018472', farmerId: 'FRM-KA-0041' };
const LAKSHMI = { username: 'farmer.lakshmi', nationalId: 'NAT-90023815', farmerId: 'FRM-PB-0117' };
const NO_LAND = { username: 'farmer.noland', nationalId: 'NAT-90055010', farmerId: 'FRM-KA-0072' };
const NO_RECORD = { username: 'farmer.norecord', nationalId: 'NAT-90099999' };
const UNMAPPED = { username: 'farmer.unmapped' };

/** The two registries, addressed exactly as a wallet addresses them. */
const REGISTRIES = {
  farmer: { path: '/farmer', credentialName: 'Farmer Identity Credential' },
  land: { path: '/land', credentialName: 'Land Ownership Credential' },
};

let skip = null;
/** Per registry: its own configuration id and its own advertised scope. */
const advertised = { farmer: {}, land: {} };

before(async () => {
  skip = await requireStack(base);
  if (!skip && !demoPassword) {
    skip = 'no DEMO_CITIZEN_PASSWORD in deploy/.env or the environment — run ./scripts/bootstrap.sh';
  }
  if (skip) return;

  for (const [which, registry] of Object.entries(REGISTRIES)) {
    const issuerBase = `${base}${registry.path}`;
    const { status, body } = await json(`${issuerBase}/.well-known/openid-credential-issuer`);
    if (status !== 200) {
      skip = `${which} issuer metadata -> ${status} at ${issuerBase}`;
      return;
    }
    const listed = Object.entries(body.credential_configurations_supported || {});
    // Exactly one, because ADVERTISE_OWN_CREDENTIALS_ONLY is on. If a registry
    // ever advertises the other's credential again, this is where it shows.
    if (listed.length !== 1) {
      skip = `the ${which} registry advertises ${listed.length} credentials; expected exactly its own`;
      return;
    }
    const [configurationId, config] = listed[0];
    advertised[which] = {
      issuerBase,
      configurationId,
      // A standards wallet asks the authorization server for the scope the
      // credential configuration publishes, not plain `openid`. Keycloak refuses
      // an unknown scope with invalid_scope, which a wallet renders as nothing
      // useful at all — so the realm has to know every scope the issuers publish.
      scope: config?.scope || null,
      displayName: config?.display?.[0]?.name || null,
    };
    if (!(body.authorization_servers || []).some((a) => a.includes('/realms/agriculture'))) {
      skip = `the ${which} registry does not advertise the agriculture realm — wallet-driven issuance is off`;
      return;
    }
  }
});

const guard = () => {
  if (skip) throw new Error(skip);
};

/** openid plus every scope the two registries publish, as one wallet would ask. */
const walletScope = () =>
  ['openid', advertised.farmer.scope, advertised.land.scope].filter(Boolean).join(' ');

async function registryRecord(entity, nationalId) {
  const { body } = await json(`${opsBase}/api/v1/${entity}/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filters: { nationalId: { eq: nationalId } } }),
  });
  return (Array.isArray(body) ? body : body?.data || [])[0];
}

/** Signs a farmer in once and returns the token their wallet would hold. */
async function signInAs(account) {
  const session = await signIn({
    authorizationServer: REALM,
    redirectUri: REDIRECT_URI,
    username: account.username,
    password: demoPassword,
    scope: walletScope(),
  });
  assert.ok(session.accessToken, `sign-in failed for ${account.username}: ${session.error}`);
  return session;
}

/** One registry issuing to one holder, driven as the wallet drives it. */
async function collect(which, session, holder) {
  const { issuerBase, configurationId } = advertised[which];
  return requestCredential({
    base: issuerBase,
    token: { access_token: session.accessToken },
    holder,
    extra: { credential_configuration_id: configurationId },
  });
}

describe('Flow 2 — the farmer signs in and the wallet fetches from both registries', () => {
  test('the account is linked to exactly one national id, and Keycloak says which', async () => {
    guard();
    const session = await signInAs(RAVI);
    // The link the issuers trust. It lives in Keycloak, not in the request —
    // a wallet cannot ask for someone else's record by changing a parameter.
    assert.equal(session.claims.nationalId, RAVI.nationalId);
    assert.equal(session.claims.iss, REALM);
    assert.equal(session.claims.azp, WALLET_CLIENT_ID);
  });

  test('one sign-in yields both credentials, each from its own registry', async () => {
    guard();
    const session = await signInAs(RAVI);
    // ONE holder key for both, which is what makes the bank's correlation check
    // a statement about one person rather than two coincidences.
    const holder = await createHolder();

    const farmer = await collect('farmer', session, holder);
    const land = await collect('land', session, holder);

    const farmerClaims = disclosableValues(farmer.credential);
    const landClaims = disclosableValues(land.credential);
    assert.equal(farmerClaims.farmerId, RAVI.farmerId);
    assert.equal(landClaims.farmerId, RAVI.farmerId);
  });

  test('each credential is built from that farmer’s own registry record', async () => {
    guard();
    const farmerRecord = await registryRecord('FarmerRecord', RAVI.nationalId);
    const landRecord = await registryRecord('LandRecord', RAVI.nationalId);
    assert.ok(farmerRecord, `${RAVI.nationalId} must be seeded — run ./scripts/seed-agriculture.sh`);
    assert.ok(landRecord, `${RAVI.nationalId} must have a seeded LandRecord`);

    const session = await signInAs(RAVI);
    const holder = await createHolder();
    const farmerClaims = disclosableValues((await collect('farmer', session, holder)).credential);
    const landClaims = disclosableValues((await collect('land', session, holder)).credential);

    assert.equal(farmerClaims.registeredFarmer, farmerRecord.registeredFarmer);
    assert.equal(landClaims.ownershipStatus, landRecord.ownershipStatus);
    assert.equal(landClaims.cropType, landRecord.cropType);
    assert.equal(Number(landClaims.cultivatedAreaAcres), Number(landRecord.cultivatedAreaAcres));
  });

  test('the two registries sign with different keys', async () => {
    guard();
    const session = await signInAs(RAVI);
    const holder = await createHolder();
    const farmer = await collect('farmer', session, holder);
    const land = await collect('land', session, holder);
    const iss = (jwt) => JSON.parse(Buffer.from(jwt.split('~')[0].split('.')[1], 'base64url').toString()).iss;
    assert.notEqual(
      iss(farmer.credential),
      iss(land.credential),
      'the registries must be independent issuers, not one issuer wearing two names',
    );
  });

  test('the national id is never a claim in either credential', async () => {
    guard();
    // It is the issuer-side lookup key only. A wallet that received it would be
    // able to disclose it, and the bank's privacy guarantee would be a policy
    // rather than a property of what was issued.
    const session = await signInAs(RAVI);
    const holder = await createHolder();
    const farmer = await collect('farmer', session, holder);
    const land = await collect('land', session, holder);
    for (const [which, { credential }] of Object.entries({ farmer, land })) {
      assert.equal(
        credential.includes(RAVI.nationalId),
        false,
        `the ${which} credential carries the national id`,
      );
      assert.equal(disclosableValues(credential).nationalId, undefined);
    }
  });

  test('a second farmer gets their own records, not the first farmer’s', async () => {
    guard();
    const session = await signInAs(LAKSHMI);
    const holder = await createHolder();
    const claims = disclosableValues((await collect('farmer', session, holder)).credential);
    assert.equal(claims.farmerId, LAKSHMI.farmerId);
    assert.notEqual(claims.farmerId, RAVI.farmerId);
  });
});

describe('Flow 2 — what the registries refuse', () => {
  test('an account with no registry record receives no credential', async () => {
    guard();
    // Authenticated, and still nothing to issue. The issuer must say so rather
    // than invent a subject.
    const session = await signInAs(NO_RECORD);
    const holder = await createHolder();
    const res = await tryRequestCredential({
      base: advertised.farmer.issuerBase,
      token: { access_token: session.accessToken },
      holder,
      extra: { credential_configuration_id: advertised.farmer.configurationId },
    });
    assert.notEqual(res.status, 200, 'a farmer with no record must not receive a credential');

    // The refusal names the caller's OWN national id — 'no record for nationalId
    // NAT-...' — and that is deliberate on the issuer's part: it is the value
    // they would quote to the issuing authority, it is returned only to the
    // holder it belongs to, over TLS, and it is not written to any log (checked:
    // the container logs contain no occurrence). So what is asserted here is the
    // thing that would actually be a leak: no OTHER farmer's identifiers, and no
    // registry data at all.
    const body = JSON.stringify(res.body);
    for (const other of [RAVI.nationalId, RAVI.farmerId, LAKSHMI.nationalId, LAKSHMI.farmerId]) {
      assert.equal(body.includes(other), false, `the refusal leaked ${other}`);
    }
    assert.equal(/FRM-[A-Z]{2}-\d{4}/.test(body), false, 'a refusal must carry no registry record');
  });

  test('an account with no national id claim receives no credential', async () => {
    guard();
    const session = await signInAs(UNMAPPED);
    assert.equal(session.claims.nationalId, undefined, 'the fixture must have no nationalId mapping');
    const holder = await createHolder();
    const res = await tryRequestCredential({
      base: advertised.farmer.issuerBase,
      token: { access_token: session.accessToken },
      holder,
      extra: { credential_configuration_id: advertised.farmer.configurationId },
    });
    assert.notEqual(res.status, 200);
  });

  test('a farmer with no land gets the farmer credential and no land credential', async () => {
    guard();
    // The half-issued case, which the bank then has to fail safely on. Both
    // halves are asserted here so the fixture cannot silently gain a land record.
    const session = await signInAs(NO_LAND);
    const holder = await createHolder();
    const farmer = await collect('farmer', session, holder);
    assert.equal(disclosableValues(farmer.credential).farmerId, NO_LAND.farmerId);

    const res = await tryRequestCredential({
      base: advertised.land.issuerBase,
      token: { access_token: session.accessToken },
      holder,
      extra: { credential_configuration_id: advertised.land.configurationId },
    });
    assert.notEqual(res.status, 200, 'a farmer with no land record must not receive a land credential');
  });

  test('a token from the Age realm buys nothing from a registry', async () => {
    guard();
    // Both realms live behind the same nginx and the same Keycloak. A registry
    // that accepted an age-realm token would let one use case's accounts issue
    // another's credentials, which is the separation this iteration claims.
    const session = await signIn({
      authorizationServer: AGE_REALM,
      redirectUri: REDIRECT_URI,
      username: 'citizen.meera',
      password: demoPassword,
      scope: 'openid',
    });
    assert.ok(session.accessToken, `age-realm sign-in failed: ${session.error}`);
    const holder = await createHolder();
    const res = await tryRequestCredential({
      base: advertised.farmer.issuerBase,
      token: { access_token: session.accessToken },
      holder,
      extra: { credential_configuration_id: advertised.farmer.configurationId },
    });
    assert.notEqual(res.status, 200, 'an age-realm token must not be accepted by the Farmer Registry');
  });

  test('a registry refuses to issue the other registry’s credential', async () => {
    guard();
    // The separation is structural — each instance is configured with one
    // subject entity — but it is worth pinning, because the failure mode is one
    // issuer quietly able to speak for the other.
    const session = await signInAs(RAVI);
    const holder = await createHolder();
    const res = await tryRequestCredential({
      base: advertised.farmer.issuerBase,
      token: { access_token: session.accessToken },
      holder,
      extra: { credential_configuration_id: advertised.land.configurationId },
    });
    assert.notEqual(res.status, 200, 'the Farmer Registry must not issue the Land credential');
  });
});
