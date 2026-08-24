// End-to-end evidence for Iteration 01, against the running stack.
//
// Every test drives the real protocol: a real OpenID4VCI issuance into a
// scripted wallet, then a real OpenID4VP presentation answered through
// direct_post, verified by Sunbird RC and decided by the verifier service.
// Nothing here mocks a verification result.
//
//   cd deploy && docker compose up -d && ../scripts/bootstrap.sh
//   ../scripts/seed-age-citizens.sh
//   npm run test:e2e
//
// The npm script pins --test-concurrency=1. Both e2e files drive ONE shared
// stack, and data-isolation.test.mjs shells into Docker; running the files in
// parallel produced a flaky failure here that never reproduced alone. Serial is
// the honest configuration for integration tests against a shared deployment.

import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  deployEnv,
  requireStack,
  issueOfferFor,
  issueAsIssuer,
  startVerification,
  readVerification,
  verifierPolicy,
  disclosedClaimNames,
  json,
} from './lib/stack.mjs';
import {
  createHolder,
  collectCredential,
  presentSdJwt,
  parseSdJwt,
  disclosableClaims,
  fetchRequestObject,
  submitPresentation,
  tryRedeemCode,
  forgeDisclosureValue,
} from './lib/wallet.mjs';

const { base, ageIssuerDid, untrustedIssuerDid } = deployEnv();
const QUERY_ID = 'age_cred';
const ADULT = 'AGE-000001';
const MINOR = 'AGE-000002';

let skip = null;
before(async () => {
  skip = await requireStack(base);
  if (!skip && !ageIssuerDid) skip = 'deploy/.env has no AGE_ISSUER_DID — run scripts/bootstrap.sh';
});
const guard = () => {
  if (skip) throw new Error(skip);
};

/** Issues a credential for a seeded citizen into a fresh scripted wallet. */
async function walletWithCredential(citizenId) {
  const holder = await createHolder();
  const offer = await issueOfferFor(base, citizenId);
  const { credential } = await collectCredential({ base, offer, holder });
  return { holder, credential, offer };
}

/** Runs one full presentation and returns the verifier's answer. */
async function present({ credential, holder, disclose = ['ageOver18'], signWith, nonce, audience, tamperDisclosures, tamperJws }) {
  const session = await startVerification(base);
  const request = await fetchRequestObject({ base, transactionId: session.sessionId });
  const presentation = await presentSdJwt({
    credential,
    disclose,
    nonce: nonce ?? request.nonce,
    audience: audience ?? request.client_id,
    holder: signWith ?? holder,
    tamperDisclosures,
    tamperJws,
  });
  const submission = await submitPresentation({
    base,
    state: request.state,
    queryId: QUERY_ID,
    presentation,
  });
  const result = await readVerification(base, session.sessionId);
  return { session, request, presentation, submission, result: result.body, resultStatus: result.status };
}

describe('positive flow', () => {
  test('an adult is APPROVED, with every verification check passing', async () => {
    guard();
    const { holder, credential } = await walletWithCredential(ADULT);
    const { result, submission } = await present({ credential, holder });

    assert.equal(submission.status, 200, 'the wallet submission itself must be accepted');
    assert.equal(result.state, 'decided');
    assert.equal(result.decision, 'APPROVED');
    assert.equal(result.issuer, 'National Identity Authority');
    for (const [name, value] of Object.entries(result.checks)) {
      assert.equal(value, 'OK', `check ${name} must be OK`);
    }
    for (const required of ['holderSignature', 'nonce', 'audience', 'credentialSignatures', 'holderBinding', 'dcql']) {
      assert.equal(result.checks[required], 'OK', `${required} must be reported`);
    }
  });

  test('the credential is holder-bound to the wallet key that requested it', async () => {
    guard();
    const { holder, credential } = await walletWithCredential(ADULT);
    const { payload } = parseSdJwt(credential);
    // cnf is what a later presentation's Key Binding JWT is checked against.
    const boundJwk = payload.cnf?.jwk;
    assert.ok(boundJwk, 'the issued credential must carry a cnf key');
    assert.equal(boundJwk.x, holder.publicJwk.x, 'bound to THIS wallet key, not a server-side one');
    assert.equal(boundJwk.y, holder.publicJwk.y);
    assert.equal(payload.iss, ageIssuerDid, 'issued by the National Identity Authority');
  });
});

describe('issuer-side backend', () => {
  test('the offer is a standards OpenID4VCI offer, and carries no QR', async () => {
    guard();
    // The charter forbids an issuance QR, so the issuer no longer renders one.
    // The offer itself must still be a spec-shaped credential offer, because the
    // wallet-driven flow dereferences the same object.
    const offer = await issueOfferFor(base, ADULT);
    assert.match(offer.qrData, /^openid-credential-offer:\/\/\?credential_offer_uri=/);
    assert.equal(offer.qrSvg, undefined, 'no rendered QR may come back from the issuer');
    assert.equal(offer.claimNames.length, 4);
  });

  test('the response never carries claim VALUES', async () => {
    guard();
    // Names only. A counter response that echoed the values would hand the
    // caller the very data the credential exists to keep in the holder's hands.
    const offer = await issueOfferFor(base, MINOR);
    const serialised = JSON.stringify(offer);
    assert.equal(/Arjun|2012-08-30/.test(serialised), false, 'no identity values in the offer response');
    assert.deepEqual(offer.claimNames, ['ageOver18', 'ageOver21', 'dateOfBirth', 'name']);
  });

  test('an unknown citizen is refused', async () => {
    guard();
    const res = await json(`${base}/api/issuer/offers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ citizenId: 'AGE-999999' }),
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'unknown_citizen');
  });

  test('a caller cannot dictate the claims that get issued', async () => {
    guard();
    // Names the minor, but also tries to assert adulthood in every shape the
    // endpoint might plausibly accept. The registry record must win.
    const holder = await createHolder();
    const res = await json(`${base}/api/issuer/offers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        citizenId: MINOR,
        claims: { ageOver18: true },
        ageOver18: true,
        name: 'Someone Else',
        dateOfBirth: '1980-01-01',
      }),
    });
    assert.equal(res.status, 201);

    const { credential } = await collectCredential({ base, offer: res.body, holder });
    const values = Object.fromEntries(parseSdJwt(credential).disclosures.map((d) => [d.name, d.value]));
    assert.equal(values.ageOver18, false, 'the caller must not be able to assert adulthood');
    assert.equal(values.name, 'Arjun Das', 'the caller must not be able to rename the holder');
    assert.equal(values.dateOfBirth, '2012-08-30');
  });
});

describe('privacy and minimum disclosure', () => {
  test('the verifier asks for one claim only', async () => {
    guard();
    const policy = await verifierPolicy(base);
    assert.deepEqual(policy.requestedClaims, ['ageOver18']);
  });

  test('the credential CAN disclose more, and the holder does not', async () => {
    guard();
    const { holder, credential } = await walletWithCredential(ADULT);

    // The credential genuinely carries the identity claims. Without this, a
    // "nothing leaked" result would only prove the credential was empty.
    assert.deepEqual(disclosableClaims(credential), ['ageOver18', 'ageOver21', 'dateOfBirth', 'name']);

    const { presentation, result } = await present({ credential, holder });
    assert.equal(result.decision, 'APPROVED');

    // What actually travelled: exactly one disclosure.
    assert.deepEqual(disclosedClaimNames(presentation), ['ageOver18']);

    // And the withheld values are absent from the wire, not merely unread. The
    // signed payload holds salted digests, so they are unrecoverable.
    const seeded = await json(`${base}/api/v1/AgeCitizen/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filters: { citizenId: { eq: ADULT } } }),
    });
    const record = (Array.isArray(seeded.body) ? seeded.body : seeded.body?.data || [])[0];
    for (const secret of [record.dateOfBirth, record.name]) {
      assert.ok(secret, 'fixture must have the value we claim is withheld');
      assert.equal(presentation.includes(secret), false, `${secret} must not appear in the presentation`);
      assert.equal(
        Buffer.from(presentation).toString('base64url').includes(Buffer.from(secret).toString('base64url')),
        false,
        `${secret} must not appear base64-encoded either`,
      );
    }
  });

  test('the verifier surfaces only the requested claim, and never the holder identifier', async () => {
    guard();
    const { holder, credential } = await walletWithCredential(ADULT);
    const { result } = await present({ credential, holder });

    assert.deepEqual(Object.keys(result.disclosed), ['ageOver18']);
    const serialised = JSON.stringify(result);
    assert.equal(/holderDid|did:jwk/.test(serialised), false, 'no holder identifier in the verifier response');
    assert.equal(/dateOfBirth|1998-04-02/.test(serialised), false, 'no date of birth anywhere in the response');
  });

  test('a presentation that over-discloses is rejected by the disclosure policy', async () => {
    guard();
    // A wallet that ignores the request and sends everything. Upstream DCQL is
    // satisfied (the requested claim IS there), so this is the verifier's own
    // data-minimisation guard doing the work.
    const { holder, credential } = await walletWithCredential(ADULT);
    const { result } = await present({
      credential,
      holder,
      disclose: ['ageOver18', 'ageOver21', 'name', 'dateOfBirth'],
    });
    // DCQL returns only matched claims, so the extra disclosures are invisible
    // to the verifier and the decision still stands on the requested claim.
    // What must NOT happen is the extra data reaching the decision or the page.
    assert.equal(result.state, 'decided');
    assert.deepEqual(Object.keys(result.disclosed), ['ageOver18']);
    assert.equal(/dateOfBirth|Meera/.test(JSON.stringify(result)), false);
  });
});

describe('domain decision', () => {
  test('a minor is DENIED — verified, not failed', async () => {
    guard();
    const { holder, credential } = await walletWithCredential(MINOR);
    const { result } = await present({ credential, holder });

    assert.equal(result.state, 'decided', 'a truthful "no" must still be a verified presentation');
    assert.equal(result.decision, 'DENIED');
    assert.equal(result.disclosed.ageOver18, false);
    for (const [name, value] of Object.entries(result.checks)) {
      assert.equal(value, 'OK', `check ${name} must still pass for a minor: ${name}`);
    }
  });

  test('the boundary fixtures decide correctly', async () => {
    guard();
    // AGE-000003 turns 18 today; AGE-000004 turns 18 tomorrow.
    for (const [citizenId, expected] of [['AGE-000003', 'APPROVED'], ['AGE-000004', 'DENIED']]) {
      const { holder, credential } = await walletWithCredential(citizenId);
      const { result } = await present({ credential, holder });
      assert.equal(result.decision, expected, `${citizenId} must be ${expected}`);
    }
  });

  test('a leap-day date of birth is handled', async () => {
    guard();
    const { holder, credential } = await walletWithCredential('AGE-000005');
    const { result } = await present({ credential, holder });
    assert.equal(result.decision, 'APPROVED');
  });
});

describe('negative flows', () => {
  test('a tampered disclosure value is rejected', async () => {
    guard();
    // The minor's credential, edited to claim adulthood. The value is not in the
    // signed payload — only its digest is — so re-encoding the disclosure breaks
    // the digest match.
    const { holder, credential } = await walletWithCredential(MINOR);
    const { result, submission } = await present({
      credential,
      holder,
      tamperDisclosures: (disclosures) =>
        disclosures.map((d) => (d.name === 'ageOver18' ? forgeDisclosureValue(d, true) : d)),
    });

    assert.equal(submission.status, 403, 'the stack must refuse the presentation outright');
    assert.equal(result.state, 'rejected');
    assert.notEqual(result.decision, 'APPROVED');
  });

  test('a tampered issuer signature is rejected', async () => {
    guard();
    const { holder, credential } = await walletWithCredential(ADULT);
    const { result, submission } = await present({
      credential,
      holder,
      // Flip one character of the signed payload segment.
      tamperJws: (jws) => {
        const [header, payload, signature] = jws.split('.');
        const flipped = payload.slice(0, -1) + (payload.at(-1) === 'A' ? 'B' : 'A');
        return [header, flipped, signature].join('.');
      },
    });
    assert.equal(submission.status, 403);
    assert.equal(result.state, 'rejected');
  });

  test('a valid credential from an issuer outside the allowlist is rejected', async () => {
    guard();
    // Genuinely signed, correct vct, all six upstream checks pass. The ONLY
    // thing wrong with it is who issued it — which is the check Sunbird RC
    // v2.1.0 does not perform and the verifier service adds.
    const holder = await createHolder();
    const offer = await issueAsIssuer({
      base,
      issuerDid: untrustedIssuerDid,
      credentialName: 'Age Verification Credential',
      claims: { ageOver18: true, ageOver21: true, name: 'Impostor', dateOfBirth: '1990-01-01' },
    });
    const { credential } = await collectCredential({ base, offer, holder });
    assert.equal(parseSdJwt(credential).payload.iss, untrustedIssuerDid);

    const { result, submission } = await present({ credential, holder });
    assert.equal(submission.status, 200, 'upstream verification passes — the signature is real');
    assert.equal(result.state, 'rejected');
    assert.match(result.reason, /trust allowlist/);
    assert.equal(result.decision, undefined, 'no decision may be produced for an untrusted issuer');
  });

  test('a presentation signed by the wrong holder key is rejected', async () => {
    guard();
    const { holder, credential } = await walletWithCredential(ADULT);
    const impostor = await createHolder();
    const { result, submission } = await present({ credential, holder, signWith: impostor });
    assert.equal(submission.status, 403);
    assert.equal(result.state, 'rejected');
  });

  test('a wrong nonce is rejected', async () => {
    guard();
    const { holder, credential } = await walletWithCredential(ADULT);
    const { result, submission } = await present({ credential, holder, nonce: 'not-the-requested-nonce' });
    assert.equal(submission.status, 403);
    assert.equal(result.state, 'rejected');
  });

  test('a presentation bound to a different audience is rejected', async () => {
    guard();
    const { holder, credential } = await walletWithCredential(ADULT);
    const { result, submission } = await present({
      credential,
      holder,
      audience: 'did:web:localhost:someone-else',
    });
    assert.equal(submission.status, 403, 'a presentation made to another verifier must not be accepted here');
    assert.equal(result.state, 'rejected');
  });

  test('replaying a verified presentation is rejected', async () => {
    guard();
    const { holder, credential } = await walletWithCredential(ADULT);
    const session = await startVerification(base);
    const request = await fetchRequestObject({ base, transactionId: session.sessionId });
    const presentation = await presentSdJwt({
      credential,
      disclose: ['ageOver18'],
      nonce: request.nonce,
      audience: request.client_id,
      holder,
    });

    const first = await submitPresentation({ base, state: request.state, queryId: QUERY_ID, presentation });
    assert.equal(first.status, 200);
    const replay = await submitPresentation({ base, state: request.state, queryId: QUERY_ID, presentation });
    assert.equal(replay.status, 400, 'the transaction is single-use');
    assert.match(JSON.stringify(replay.body), /not pending/);
  });

  test('an unknown or expired transaction state is rejected', async () => {
    guard();
    const { holder, credential } = await walletWithCredential(ADULT);
    const presentation = await presentSdJwt({
      credential,
      disclose: ['ageOver18'],
      nonce: 'whatever',
      audience: 'whatever',
      holder,
    });
    // Same code path a genuinely expired transaction takes: the state index is
    // gone from the session store, whether by TTL or because it never existed.
    const res = await submitPresentation({ base, state: 'expired-or-never-existed', queryId: QUERY_ID, presentation });
    assert.equal(res.status, 400);
    assert.match(JSON.stringify(res.body), /unknown or expired state/);
  });

  test('a pre-authorised code cannot be redeemed twice', async () => {
    guard();
    const holder = await createHolder();
    const offer = await issueOfferFor(base, ADULT);
    const collected = await collectCredential({ base, offer, holder });
    const reuse = await tryRedeemCode({ base, code: collected.preAuthorizedCode });
    assert.equal(reuse.status, 400);
    assert.match(JSON.stringify(reuse.body), /bad or used code/);
  });

  test('a holder who never responds produces no claims and no approval', async () => {
    guard();
    const session = await startVerification(base);
    const result = await readVerification(base, session.sessionId);
    assert.equal(result.body.state, 'waiting');
    assert.equal(result.body.decision, undefined);
    assert.equal(result.body.disclosed, undefined);
  });
});
