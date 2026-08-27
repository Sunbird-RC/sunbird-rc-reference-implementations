// Flow 1, end to end against a live stack: the citizen signs in inside the
// wallet, and the wallet fetches the credential itself. No QR, no issuer page.
//
// This is the charter's first journey, minus the phone. The fork's unit tests
// prove how the issuer treats a Keycloak token in isolation; these tests prove
// the whole chain is really wired: our realm import, nginx, Keycloak's own login
// page, the `citizenId` claim, the registry lookup, the nonce endpoint, holder
// binding — and that the credential the wallet ends up holding is one the
// verifier accepts.
//
// What a real device still adds is the wallet's own UI: the issuer list, the
// in-app browser, the preview-then-approve screen. Those are the recordings.
// Everything the SERVER contributes is covered here, so a device session that
// fails can be attributed to the wallet rather than the stack.
//
//   ./scripts/bootstrap.sh          # generates the demo password
//   npm run test:e2e
//
// The password is generated, never committed (answer 3). Without it these tests
// skip themselves with a message rather than guessing one.

import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deployEnv, requireStack, json, issueOfferFor, startVerification, readVerification } from './lib/stack.mjs';
import { signIn, WALLET_CLIENT_ID } from './lib/keycloak.mjs';
import {
  createHolder,
  requestCredential,
  tryRequestCredential,
  collectCredential,
  parseSdJwt,
  disclosableValues,
  presentSdJwt,
  fetchRequestObject,
  submitPresentation,
} from './lib/wallet.mjs';

const { base, opsBase, ageIssuerDid, demoPassword } = deployEnv();

/** Realm, accounts and the citizens they map to — deploy/keycloak/realm-age.json. */
const REALM = `${base}/auth/realms/age`;
const REDIRECT_URI = `${base}/wallet/redirect`;
const ADULT = { username: 'citizen.meera', citizenId: 'AGE-000001' };
const OTHER = { username: 'citizen.arjun', citizenId: 'AGE-000002' };
const UNMAPPED = { username: 'citizen.unmapped' };

let skip = null;
/** The trusted issuer's configuration id, as advertised in issuer metadata. */
let configurationId = null;
/**
 * The OAuth scope that same configuration advertises.
 *
 * This matters more than it looks. OID4VCI lets an issuer publish a `scope` per
 * credential configuration, and a standards wallet asks the authorization server
 * for exactly that scope rather than plain `openid`. Keycloak rejects any scope
 * it does not know, with `invalid_scope` — which surfaces in a wallet as nothing
 * more useful than "something went wrong".
 *
 * The first version of this suite signed in with `openid` and passed while a real
 * wallet could not get past the login screen. So the scope comes from metadata
 * now: if the issuer advertises one, the tests use it, and the realm has to have
 * it.
 */
let credentialScope = null;

before(async () => {
  skip = await requireStack(base);
  if (!skip && !demoPassword) {
    skip = 'no DEMO_CITIZEN_PASSWORD in deploy/.env or the environment — run ./scripts/bootstrap.sh';
  }
  if (!skip) {
    const { status, body } = await json(`${base}/.well-known/openid-credential-issuer`);
    if (status !== 200) skip = `issuer metadata -> ${status}`;
    else {
      const listed = Object.entries(body.credential_configurations_supported || {});
      // The stack also publishes a deliberately unlisted issuer's configuration
      // for the trust tests; Flow 1 wants the National Identity Authority's.
      const trusted = listed.find(([, v]) => !/unlisted/i.test((v.display?.[0]?.name || '')));
      if (!trusted) skip = 'issuer metadata advertises no credential configuration';
      else {
        configurationId = trusted[0];
        credentialScope = trusted[1]?.scope || null;
      }
      if (!skip && !(body.authorization_servers || []).some((a) => a.includes('/realms/'))) {
        skip = 'the issuer does not advertise Keycloak — the wallet-driven capability is off';
      }
    }
  }
});
const guard = () => {
  if (skip) throw new Error(skip);
};

/** What a standards wallet asks for: openid plus the credential's own scope. */
const walletScope = () => (credentialScope ? `openid ${credentialScope}` : 'openid');

/** The registry record behind a citizen, to compare the credential against. */
async function registryRecord(citizenId) {
  const { body } = await json(`${opsBase}/api/v1/AgeCitizen/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filters: { citizenId: { eq: citizenId } } }),
  });
  return (Array.isArray(body) ? body : body?.data || [])[0];
}

/** Signs a citizen in and lets their wallet fetch its credential. */
async function walletFetchesOwnCredential(account, extra) {
  const session = await signIn({ authorizationServer: REALM, redirectUri: REDIRECT_URI, username: account.username, password: demoPassword, scope: walletScope() });
  assert.ok(session.accessToken, `sign-in failed for ${account.username}: ${session.error}`);
  const holder = await createHolder();
  const { credential } = await requestCredential({
    base,
    token: { access_token: session.accessToken },
    holder,
    extra: { credential_configuration_id: configurationId, ...extra },
  });
  return { session, holder, credential, claims: disclosableValues(credential) };
}

describe('Flow 1 — the citizen signs in and the wallet fetches the credential', () => {
  test('the account is linked to exactly one citizen, and Keycloak says which', async () => {
    guard();
    const session = await signIn({ authorizationServer: REALM, redirectUri: REDIRECT_URI, username: ADULT.username, password: demoPassword, scope: walletScope() });
    assert.ok(session.accessToken, `sign-in failed: ${session.error}`);
    // The link the issuer trusts. It lives in Keycloak, not in the request.
    assert.equal(session.claims.citizenId, ADULT.citizenId);
    assert.equal(session.claims.iss, REALM);
    assert.equal(session.claims.azp, WALLET_CLIENT_ID);
  });

  test('the credential is built from that citizen’s own registry record', async () => {
    guard();
    const record = await registryRecord(ADULT.citizenId);
    assert.ok(record?.dateOfBirth, `${ADULT.citizenId} must be seeded — run ./scripts/seed-age-citizens.sh`);

    const { claims, credential } = await walletFetchesOwnCredential(ADULT);
    const { payload } = parseSdJwt(credential);

    assert.equal(payload.iss, ageIssuerDid, 'signed by the National Identity Authority');
    assert.equal(claims.name, record.name, 'the name comes from the registry, not the request');
    assert.equal(claims.dateOfBirth, record.dateOfBirth);
    assert.equal(claims.ageOver18, true, 'the seeded adult must be over 18');
  });

  test('the credential is bound to the wallet key that asked for it', async () => {
    guard();
    const { credential, holder } = await walletFetchesOwnCredential(ADULT);
    const boundJwk = parseSdJwt(credential).payload.cnf?.jwk;
    assert.ok(boundJwk, 'a wallet-fetched credential must still carry cnf');
    assert.equal(boundJwk.x, holder.publicJwk.x, 'bound to THIS wallet key');
    assert.equal(boundJwk.y, holder.publicJwk.y);
  });

  test('the credential the wallet fetched is one the verifier accepts', async () => {
    guard();
    // The point of the journey: what Flow 1 produces must work in Flow 2. If
    // the two paths issued subtly different credentials, this is where it shows.
    const { credential, holder } = await walletFetchesOwnCredential(ADULT);
    const session = await startVerification(base);
    const request = await fetchRequestObject({ base, transactionId: session.sessionId });
    const presentation = await presentSdJwt({
      credential,
      disclose: ['ageOver18'],
      nonce: request.nonce,
      audience: request.client_id,
      holder,
    });
    const submission = await submitPresentation({ base, state: request.state, queryId: 'age_cred', presentation });
    const { body: result } = await readVerification(base, session.sessionId);

    assert.equal(submission.status, 200);
    assert.equal(result.decision, 'APPROVED');
    assert.equal(result.checks.holderBinding, 'OK');
  });
});

describe('Flow 1 — cross-citizen protection (answer 8)', () => {
  test('a different citizen receives their own credential, not the first one’s', async () => {
    guard();
    const first = await walletFetchesOwnCredential(ADULT);
    const second = await walletFetchesOwnCredential(OTHER);

    const firstRecord = await registryRecord(ADULT.citizenId);
    const secondRecord = await registryRecord(OTHER.citizenId);
    assert.equal(second.claims.name, secondRecord.name);
    assert.notEqual(second.claims.name, first.claims.name, 'two accounts must not receive the same person');
    assert.equal(
      JSON.stringify(second.claims).includes(firstRecord.name),
      false,
      'no trace of the other citizen in the second credential',
    );
  });

  test('naming another citizen in the request does not reach their record', async () => {
    guard();
    // The attack the wallet-driven path has to close: the caller IS the holder,
    // so nothing it asserts about itself can be trusted. The issuer must use the
    // signed-in identity and ignore the body.
    const record = await registryRecord(ADULT.citizenId);
    const otherRecord = await registryRecord(OTHER.citizenId);
    const { claims } = await walletFetchesOwnCredential(ADULT, {
      citizenId: OTHER.citizenId,
      claims: { citizenId: OTHER.citizenId, name: 'Someone Else', ageOver18: true, dateOfBirth: '1900-01-01' },
    });

    assert.equal(claims.name, record.name, 'the signed-in citizen, not the one named in the request');
    assert.notEqual(claims.name, otherRecord.name);
    assert.notEqual(claims.dateOfBirth, '1900-01-01', 'wallet-supplied claims must be ignored');
  });
});

describe('Flow 1 — refusals', () => {
  test('the wrong password yields no code and no token', async () => {
    guard();
    const attempt = await signIn({
      authorizationServer: REALM,
      redirectUri: REDIRECT_URI,
      username: ADULT.username,
      password: `${demoPassword}-wrong`,
      scope: walletScope(),
    });
    assert.equal(attempt.accessToken, undefined, 'Keycloak must not issue a token for a wrong password');
    assert.ok(attempt.error, 'the failure should be reported, not silent');
  });

  test('an account with no linked citizen is refused, without inventing a record', async () => {
    guard();
    const session = await signIn({ authorizationServer: REALM, redirectUri: REDIRECT_URI, username: UNMAPPED.username, password: demoPassword, scope: walletScope() });
    assert.ok(session.accessToken, `sign-in failed: ${session.error}`);
    assert.equal(session.claims.citizenId, undefined, 'this account is deliberately unmapped');

    const res = await tryRequestCredential({
      base,
      token: { access_token: session.accessToken },
      holder: await createHolder(),
      extra: { credential_configuration_id: configurationId },
    });
    assert.ok(res.status >= 400, `expected a refusal, got ${res.status}`);
    assert.equal(res.body?.credential, undefined, 'no credential may be issued');
  });

  test('a credential type the issuer does not publish is refused', async () => {
    guard();
    const session = await signIn({ authorizationServer: REALM, redirectUri: REDIRECT_URI, username: ADULT.username, password: demoPassword, scope: walletScope() });
    const res = await tryRequestCredential({
      base,
      token: { access_token: session.accessToken },
      holder: await createHolder(),
      extra: { credential_configuration_id: 'did:schema:does-not-exist' },
    });
    assert.ok(res.status >= 400, `expected a refusal, got ${res.status}`);
    assert.equal(res.body?.credential, undefined, 'no substitute credential may be issued');
  });

  test('a random bearer token is not accepted as a signed-in citizen', async () => {
    guard();
    const res = await tryRequestCredential({
      base,
      token: { access_token: 'not.a.real.token' },
      holder: await createHolder(),
      extra: { credential_configuration_id: configurationId },
    });
    assert.ok(res.status >= 400, `expected a refusal, got ${res.status}`);
    assert.equal(res.body?.credential, undefined);
  });
});

describe('Flow 1 — the authorization server accepts what the issuer advertises', () => {
  test('every scope in issuer metadata is a scope Keycloak will grant', async () => {
    guard();
    // The device-level failure this suite previously missed entirely: the wallet
    // asks for the credential's advertised scope, Keycloak answers
    // `invalid_scope`, and the wallet can only say "something went wrong".
    const { body } = await json(`${base}/.well-known/openid-credential-issuer`);
    const scopes = Object.values(body.credential_configurations_supported || {})
      .map((c) => c.scope)
      .filter(Boolean);
    assert.ok(scopes.length > 0, 'expected the issuer to advertise credential scopes');

    for (const scope of scopes) {
      const attempt = await signIn({
        authorizationServer: REALM,
        redirectUri: REDIRECT_URI,
        username: ADULT.username,
        password: demoPassword,
        scope: `openid ${scope}`,
      });
      assert.ok(
        attempt.accessToken,
        `Keycloak refused the advertised scope '${scope}': ${attempt.error} — add it as a client scope in deploy/keycloak/realm-age.json`,
      );
      assert.ok(
        (attempt.claims.scope || '').split(' ').includes(scope),
        `the granted token should carry '${scope}', got '${attempt.claims.scope}'`,
      );
    }
  });
});

describe('Flow 1 — the other grant still works (regression)', () => {
  test('pre-authorised issuance is unaffected by Keycloak being enabled', async () => {
    guard();
    // Anand's control on decision 1: adding the wallet-driven grant must not
    // change the path that was already accepted. Both grants, one stack, live.
    const holder = await createHolder();
    const offer = await issueOfferFor(base, ADULT.citizenId);
    const { credential } = await collectCredential({ base, offer, holder });
    const claims = disclosableValues(credential);
    const record = await registryRecord(ADULT.citizenId);

    assert.equal(claims.name, record.name);
    assert.equal(parseSdJwt(credential).payload.cnf?.jwk?.x, holder.publicJwk.x);
  });
});
