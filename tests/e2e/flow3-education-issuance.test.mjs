// Wallet-driven issuance for Iteration 03, end to end against a live stack.
//
// The Education counterpart of flow1-wallet-issuance.test.mjs and
// flow2-agriculture-issuance.test.mjs, and it exists separately for the same
// reason they do: every other Education test gets credentials into the wallet
// with a PRE-AUTHORISED offer, which is supporting protocol evidence and
// explicitly not the customer journey. REQUIREMENTS §1 is the learner signing in
// INSIDE the wallet and the wallet fetching each credential itself, with no QR
// and no issuer web page.
//
// THREE issuers make this more than a copy of Flow 2. Each institution is its own
// credential issuer with its own scope, its own DID and its own registry entity,
// and the learner collects from all three with one token and one holder key. The
// failure this catches is one institution's Keycloak wiring being subtly
// different from the other two's — nothing else in the suite would notice, and on
// a device it appears as "something went wrong" on the third card only, after two
// have already worked.
//
// It is also where §2's "unmapped, missing, and cross-learner requests fail
// safely" is proved: three issuers means three chances for one of them to invent a
// subject rather than refuse.
//
// What a real device still adds is the wallet's own UI: the issuer directory
// showing exactly three institutions, the in-app browser, the trust screen,
// preview-then-approve, and three cards visible afterwards. Those are the
// recordings. Everything the SERVER contributes is here, so a failed device
// session can be attributed to the wallet rather than to the stack.
//
//   ./scripts/bootstrap.sh          # generates the demo password
//   ./scripts/seed-education.sh
//   npm run test:e2e

import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  deployEnv,
  requireStack,
  json,
  startEducationVerification,
  readEducationVerification,
  educationPolicy,
  requestUriFromQr,
} from './lib/stack.mjs';
import { signIn } from './lib/keycloak.mjs';
import {
  createHolder,
  requestCredential,
  tryRequestCredential,
  disclosableValues,
  disclosableClaims,
  presentSdJwt,
  fetchRequestObject,
  submitMultiPresentation,
} from './lib/wallet.mjs';

const { base, opsBase, demoPassword } = deployEnv();

/** Accounts and the records they map to — deploy/keycloak/realm-education.json. */
const REALM = `${base}/auth/realms/education`;
const AGRICULTURE_REALM = `${base}/auth/realms/agriculture`;
const REDIRECT_URI = `${base}/wallet/redirect`;
const PRIYA = { username: 'learner.priya', nationalId: 'NAT-70011234', learnerId: 'EDU-L-004512' };
const ROHAN = { username: 'learner.rohan', nationalId: 'NAT-70022345', learnerId: 'EDU-L-006733' };
const NO_UNIVERSITY = {
  username: 'learner.nouniversity',
  nationalId: 'NAT-70100123',
  learnerId: 'EDU-L-013001',
};
const NO_RECORD = { username: 'learner.norecord', nationalId: 'NAT-70111234' };
const UNMAPPED = { username: 'learner.unmapped' };
const MISMATCH = { username: 'learner.mismatch', nationalId: 'NAT-70099012', learnerId: 'EDU-L-012550' };

/** The three institutions, addressed exactly as a wallet addresses them. */
const INSTITUTIONS = {
  school: { path: '/school', credentialName: 'School Record Credential', entity: 'SchoolRecord' },
  college: { path: '/college', credentialName: 'College Record Credential', entity: 'CollegeRecord' },
  university: {
    path: '/university',
    credentialName: 'University Record Credential',
    entity: 'UniversityRecord',
  },
};
const ROLES = Object.keys(INSTITUTIONS);
const ROLE_IDS = { school: 'school_cred', college: 'college_cred', university: 'university_cred' };

let skip = null;
/** Per institution: its own configuration id and its own advertised scope. */
const advertised = { school: {}, college: {}, university: {} };

before(async () => {
  skip = await requireStack(base);
  if (!skip && !demoPassword) {
    skip = 'no DEMO_CITIZEN_PASSWORD in deploy/.env or the environment — run ./scripts/bootstrap.sh';
  }
  if (skip) return;

  for (const [which, institution] of Object.entries(INSTITUTIONS)) {
    const issuerBase = `${base}${institution.path}`;
    const { status, body } = await json(`${issuerBase}/.well-known/openid-credential-issuer`);
    if (status !== 200) {
      skip = `${which} issuer metadata -> ${status} at ${issuerBase}`;
      return;
    }
    const listed = Object.entries(body.credential_configurations_supported || {});
    // Exactly one, because ADVERTISE_OWN_CREDENTIALS_ONLY is on. Five path-scoped
    // issuers now share one host, so if any of them ever advertises another's
    // credential again, this is where it shows.
    if (listed.length !== 1) {
      skip = `the ${which} issuer advertises ${listed.length} credentials; expected exactly its own`;
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
    if (!(body.authorization_servers || []).some((a) => a.includes('/realms/education'))) {
      skip = `the ${which} issuer does not advertise the education realm — wallet-driven issuance is off`;
      return;
    }
  }
});

const guard = () => {
  if (skip) throw new Error(skip);
};

/** openid plus every scope the three institutions publish, as one wallet would ask. */
const walletScope = () => ['openid', ...ROLES.map((r) => advertised[r].scope)].filter(Boolean).join(' ');

async function registryRecord(entity, nationalId) {
  const { body } = await json(`${opsBase}/api/v1/${entity}/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filters: { nationalId: { eq: nationalId } } }),
  });
  return (Array.isArray(body) ? body : body?.data || [])[0];
}

/** Signs a learner in once and returns the token their wallet would hold. */
async function signInAs(account, { authorizationServer = REALM } = {}) {
  const session = await signIn({
    authorizationServer,
    redirectUri: REDIRECT_URI,
    username: account.username,
    password: demoPassword,
    scope: walletScope(),
  });
  assert.ok(session.accessToken, `sign-in failed for ${account.username}: ${session.error}`);
  return session;
}

/** One institution issuing to one holder, driven as the wallet drives it. */
async function collect(which, session, holder) {
  const { issuerBase, configurationId } = advertised[which];
  return requestCredential({
    base: issuerBase,
    token: { access_token: session.accessToken },
    holder,
    extra: { credential_configuration_id: configurationId },
  });
}

describe('Flow 3 — the learner signs in once and the wallet fetches all three', () => {
  test('the account is linked to exactly one national id, and Keycloak says which', async () => {
    guard();
    const session = await signInAs(PRIYA);
    assert.equal(session.claims.nationalId, PRIYA.nationalId);
    // One claim, one purpose. The learner id is NOT in the token: it belongs to
    // the registry, and each institution looks it up itself.
    assert.equal(session.claims.learnerId, undefined, 'the token must not carry a learner id');
  });

  test('one sign-in yields all three credentials, each from its own institution', async () => {
    guard();
    const session = await signInAs(PRIYA);
    const holder = await createHolder();
    for (const role of ROLES) {
      const { credential, format } = await collect(role, session, holder);
      assert.ok(credential, `${role} issued nothing`);
      assert.equal(format, 'vc+sd-jwt');
      const values = disclosableValues(credential);
      assert.equal(values.learnerId, PRIYA.learnerId, `${role} named the wrong learner`);
    }
  });

  test('each credential is built from that institution’s own registry record', async () => {
    guard();
    // Not from the token, not from the wallet, not from another institution: the
    // claims must equal the record the issuer itself holds.
    const session = await signInAs(PRIYA);
    const holder = await createHolder();
    for (const role of ROLES) {
      const record = await registryRecord(INSTITUTIONS[role].entity, PRIYA.nationalId);
      assert.ok(record, `no seeded ${INSTITUTIONS[role].entity} — run ./scripts/seed-education.sh`);
      const { credential } = await collect(role, session, holder);
      const values = disclosableValues(credential);
      assert.equal(values.completionStatus, record.completionStatus);
      assert.equal(values.percentage, record.percentage);
      if (role === 'university') {
        assert.equal(values.degreeLevel, record.degreeLevel);
        assert.equal(values.fieldOfStudy, record.fieldOfStudy);
      }
    }
  });

  test('the three institutions sign with three different keys', async () => {
    guard();
    // The premise of the whole iteration. If two of them shared a key, "three
    // independent authorities agreed on this learner" would be one authority
    // agreeing with itself, and the correlation check would prove nothing.
    const session = await signInAs(PRIYA);
    const holder = await createHolder();
    const issuers = [];
    for (const role of ROLES) {
      const { credential } = await collect(role, session, holder);
      const payload = JSON.parse(
        Buffer.from(credential.split('~')[0].split('.')[1], 'base64url').toString('utf8'),
      );
      assert.match(payload.iss, /^did:web:/, `${role} issuer is not a did:web`);
      issuers.push(payload.iss);
    }
    assert.equal(new Set(issuers).size, 3, `expected three distinct issuers, got ${issuers.join(', ')}`);
  });

  test('all three credentials bind to the ONE holder key the wallet used', async () => {
    guard();
    const session = await signInAs(PRIYA);
    const holder = await createHolder();
    for (const role of ROLES) {
      const { credential } = await collect(role, session, holder);
      const payload = JSON.parse(
        Buffer.from(credential.split('~')[0].split('.')[1], 'base64url').toString('utf8'),
      );
      assert.ok(payload.cnf?.jwk, `${role} credential is not holder-bound`);
      assert.equal(payload.cnf.jwk.x, holder.publicJwk.x, `${role} bound to a different key`);
      assert.equal(payload.cnf.jwk.y, holder.publicJwk.y);
    }
  });

  test('the national id and the student ids are never claims in any credential', async () => {
    guard();
    // REQUIREMENTS §2 and §7. The national id is the issuer's lookup key and the
    // student id identifies the learner to one institution; neither may leave the
    // issuer. Asserted on the credential itself, not on a presentation, because a
    // claim absent from the credential cannot be disclosed by any wallet later.
    const session = await signInAs(PRIYA);
    const holder = await createHolder();
    for (const role of ROLES) {
      const { credential } = await collect(role, session, holder);
      const names = disclosableClaims(credential);
      for (const forbidden of [
        'nationalId',
        'schoolStudentId',
        'collegeStudentId',
        'universityStudentId',
      ]) {
        assert.equal(names.includes(forbidden), false, `${role} credential can disclose ${forbidden}`);
      }
      // And not merely undisclosable — not present in the credential at all.
      assert.equal(
        credential.includes(PRIYA.nationalId),
        false,
        `${role} credential contains the national id somewhere`,
      );
    }
  });

  test('a second learner gets their own records, not the first learner’s', async () => {
    guard();
    const session = await signInAs(ROHAN);
    const holder = await createHolder();
    const { credential } = await collect('university', session, holder);
    const values = disclosableValues(credential);
    assert.equal(values.learnerId, ROHAN.learnerId);
    assert.notEqual(values.learnerId, PRIYA.learnerId);
    // The fixture that carries the iteration's argument, checked at the source.
    assert.equal(values.percentage, 65, 'the two-answers fixture drifted away from 65%');
  });
});

describe('Flow 3 — what the institutions refuse', () => {
  test('an account with no registry record receives no credential', async () => {
    guard();
    // Authenticated, and still nothing to issue. Each institution must say so
    // rather than invent a subject.
    const session = await signInAs(NO_RECORD);
    const holder = await createHolder();
    for (const role of ROLES) {
      const res = await tryRequestCredential({
        base: advertised[role].issuerBase,
        token: { access_token: session.accessToken },
        holder,
        extra: { credential_configuration_id: advertised[role].configurationId },
      });
      assert.notEqual(res.status, 200, `${role} issued a credential to a learner with no record`);

      // The refusal names the caller's OWN national id, which is deliberate on
      // the issuer's part: it is the value they would quote to the institution,
      // it is returned only to the holder it belongs to, over TLS. What is
      // asserted here is the thing that would actually be a leak — no OTHER
      // learner's identifiers, and no registry data at all.
      const body = JSON.stringify(res.body);
      for (const other of [PRIYA.nationalId, PRIYA.learnerId, ROHAN.nationalId, ROHAN.learnerId]) {
        assert.equal(body.includes(other), false, `the ${role} refusal leaked ${other}`);
      }
      assert.equal(/EDU-L-\d{6}/.test(body), false, `the ${role} refusal carried a registry record`);
    }
  });

  test('an account with no national id claim receives no credential', async () => {
    guard();
    const session = await signInAs(UNMAPPED);
    assert.equal(session.claims.nationalId, undefined, 'the fixture must have no nationalId mapping');
    const holder = await createHolder();
    for (const role of ROLES) {
      const res = await tryRequestCredential({
        base: advertised[role].issuerBase,
        token: { access_token: session.accessToken },
        holder,
        extra: { credential_configuration_id: advertised[role].configurationId },
      });
      assert.notEqual(res.status, 200, `${role} issued to an unmapped account`);
    }
  });

  test('a learner with no university record gets two credentials and not a third', async () => {
    guard();
    // The partially-issued case, which both portals then have to fail safely on.
    // Both halves are asserted here so the fixture cannot silently gain a record.
    const session = await signInAs(NO_UNIVERSITY);
    const holder = await createHolder();
    const school = await collect('school', session, holder);
    assert.equal(disclosableValues(school.credential).learnerId, NO_UNIVERSITY.learnerId);

    for (const role of ['college', 'university']) {
      const res = await tryRequestCredential({
        base: advertised[role].issuerBase,
        token: { access_token: session.accessToken },
        holder,
        extra: { credential_configuration_id: advertised[role].configurationId },
      });
      assert.notEqual(res.status, 200, `${role} issued from a record that does not exist`);
    }
  });

  test('a token from the Agriculture realm buys nothing from an institution', async () => {
    guard();
    // Three realms now live behind the same nginx and the same Keycloak, and
    // Education deliberately reuses Agriculture's nationalId claim NAME. That is
    // exactly why it must not reuse its realm: an institution that accepted an
    // agriculture-realm token would let a farmer's account collect a degree.
    const session = await signIn({
      authorizationServer: AGRICULTURE_REALM,
      redirectUri: REDIRECT_URI,
      username: 'farmer.ravi',
      password: demoPassword,
      scope: 'openid',
    });
    assert.ok(session.accessToken, `agriculture-realm sign-in failed: ${session.error}`);
    const holder = await createHolder();
    for (const role of ROLES) {
      const res = await tryRequestCredential({
        base: advertised[role].issuerBase,
        token: { access_token: session.accessToken },
        holder,
        extra: { credential_configuration_id: advertised[role].configurationId },
      });
      assert.notEqual(res.status, 200, `${role} accepted an agriculture-realm token`);
    }
  });

  // FINDING (1 September 2026), recorded rather than asserted away.
  //
  // An institution WILL mint another institution's credential for an
  // authenticated learner. `ADVERTISE_OWN_CREDENTIALS_ONLY` filters issuer
  // METADATA; it does not restrict the credential endpoint, which accepts any
  // published `credential_configuration_id`. Asking the school instance for the
  // college configuration returns a credential signed with the COLLEGE's DID
  // (credentials-service signs with the schema author's key) carrying the
  // learner's SCHOOL record.
  //
  // The Agriculture equivalent of this test passes, which is why it went
  // unnoticed: the Land schema requires claims a FarmerRecord lookup cannot
  // supply, so cross-issuance there fails on validation rather than on
  // authorization. The three Education records share their claim shape, so
  // nothing stops it.
  //
  // What contains it is the `vct`, and only the vct: oid4vc-service normalises a
  // relative vct against the MINTING instance's PUBLIC_URL, so the credential's
  // type is `<host>/school/vct/college-record-credential` — not the
  // `<host>/college/vct/...` every portal pins. The two tests below assert both
  // halves: the mint happens, and the result cannot be presented to anyone.
  //
  // See docs/design/COMPATIBILITY.md. This is a defence resting on URL
  // construction rather than on an authorization check, so it is escalated
  // rather than left as a passing test.
  test('an institution can be made to sign another institution’s credential type', async () => {
    guard();
    const session = await signInAs(PRIYA);
    const holder = await createHolder();
    const schoolRecord = await registryRecord('SchoolRecord', PRIYA.nationalId);
    const collegeRecord = await registryRecord('CollegeRecord', PRIYA.nationalId);
    assert.notEqual(
      schoolRecord.percentage,
      collegeRecord.percentage,
      'the two fixtures must differ, or this test cannot show whose data was used',
    );

    const res = await tryRequestCredential({
      base: advertised.school.issuerBase,
      token: { access_token: session.accessToken },
      holder,
      extra: { credential_configuration_id: advertised.college.configurationId },
    });
    assert.equal(res.status, 200, 'behaviour changed — if this now refuses, tighten the test and the finding');

    const credential = res.body.credential;
    const payload = JSON.parse(
      Buffer.from(credential.split('~')[0].split('.')[1], 'base64url').toString('utf8'),
    );
    // Signed by the COLLEGE, over the SCHOOL's data. Both halves stated, because
    // either one alone understates the finding.
    const collegeIssuer = JSON.parse(
      Buffer.from(
        (await collect('college', session, holder)).credential.split('~')[0].split('.')[1],
        'base64url',
      ).toString('utf8'),
    ).iss;
    assert.equal(payload.iss, collegeIssuer, "the credential is signed with the college's key");
    assert.equal(
      disclosableValues(credential).percentage,
      schoolRecord.percentage,
      "and carries the school's percentage",
    );

    // The one thing that saves it.
    assert.match(payload.vct, /\/school\/vct\/college-record-credential$/);
    const collegePinned = (await educationPolicy(base, 'masters')).credentialTypes.college;
    assert.notEqual(payload.vct, collegePinned, 'the vct is what makes this unpresentable');
  });

  test('and that credential cannot be presented to either portal', async () => {
    guard();
    // The containment, proven rather than reasoned about. This is the assertion
    // the demo's safety actually rests on: whatever an instance can be persuaded
    // to sign, a portal must not accept it in a slot it does not belong to.
    const session = await signInAs(PRIYA);
    const holder = await createHolder();
    const forged = (
      await tryRequestCredential({
        base: advertised.school.issuerBase,
        token: { access_token: session.accessToken },
        holder,
        extra: { credential_configuration_id: advertised.college.configurationId },
      })
    ).body.credential;
    const genuine = {
      school: (await collect('school', session, holder)).credential,
      university: (await collect('university', session, holder)).credential,
    };

    for (const policyName of ['masters', 'job']) {
      const policy = await educationPolicy(base, policyName);
      const vpSession = await startEducationVerification(base, policyName);
      const request = await fetchRequestObject({ requestUri: requestUriFromQr(vpSession.qrData) });
      const presentations = {};
      for (const [role, credential] of [
        ['school', genuine.school],
        ['college', forged],
        ['university', genuine.university],
      ]) {
        presentations[ROLE_IDS[role]] = await presentSdJwt({
          credential,
          disclose: policy.requestedClaims[role],
          nonce: request.nonce,
          audience: request.client_id,
          holder,
        });
      }
      await submitMultiPresentation({
        base,
        responseUri: request.response_uri,
        state: request.state,
        presentations,
      });
      const result = (await readEducationVerification(base, policyName, vpSession.sessionId)).body;
      assert.equal(result.state, 'rejected', `${policyName} accepted a cross-minted credential`);
      assert.equal(result.decision, undefined);
    }
  });
});

// The fourth outcome, produced the way a PHONE can produce it.
//
// Anand's feedback on the Agriculture video was that REJECTED / UNABLE TO VERIFY
// had to be shown on the applications, not only in a test suite. The same applies
// here, and Education makes it easier to demonstrate honestly: nothing is
// tampered with and nothing is pre-authorised.
//
// All three credentials are fetched by the wallet itself through
// authorization_code, each signed by its own institution, all three bound to ONE
// holder key. Only the learner id disagrees — a learner combining their own school
// and university records with somebody else's college diploma, which is precisely
// the fraud the correlation check exists to stop.
//
// On a device this is two sign-ins: two institutions as one learner, the third as
// another. The Keycloak SSO session has to be cleared between them or the second
// issuance silently reuses the first learner.
describe('Flow 3 — a mismatched set, collected by the wallet itself', () => {
  test('ONE sign-in is enough: the college record names a different learner', async () => {
    guard();
    // The cleanest REJECTED a phone can produce, and the one the demo records.
    //
    // `learner.mismatch` is seeded so that the COLLEGE's authoritative record
    // carries a different learnerId under the same National ID. Each issuer
    // resolves its own record from the token, so a single sign-in yields three
    // credentials that disagree — no second account, no clearing the Keycloak
    // session, no wallet gymnastics. Agriculture's equivalent needed two farmers
    // and an SSO reset between them.
    //
    // Nothing is tampered with: three valid signatures, three trusted issuers,
    // one holder key. Only the learnerId disagrees.
    const session = await signInAs(MISMATCH);
    const holder = await createHolder();
    const credentials = {};
    for (const role of ROLES) {
      credentials[role] = (await collect(role, session, holder)).credential;
    }

    const ids = ROLES.map((r) => disclosableValues(credentials[r]).learnerId);
    assert.equal(new Set(ids).size, 2, `expected two distinct learner ids, got ${ids.join(', ')}`);
    assert.notEqual(
      disclosableValues(credentials.college).learnerId,
      disclosableValues(credentials.school).learnerId,
      'the college fixture no longer disagrees, so this test proves nothing',
    );

    for (const policyName of ['masters', 'job']) {
      const policy = await educationPolicy(base, policyName);
      const vp = await startEducationVerification(base, policyName);
      const request = await fetchRequestObject({ requestUri: requestUriFromQr(vp.qrData) });
      const presentations = {};
      for (const role of ROLES) {
        presentations[ROLE_IDS[role]] = await presentSdJwt({
          credential: credentials[role],
          disclose: policy.requestedClaims[role],
          nonce: request.nonce,
          audience: request.client_id,
          holder,
        });
      }
      const submission = await submitMultiPresentation({
        base,
        responseUri: request.response_uri,
        state: request.state,
        presentations,
      });
      assert.equal(submission.status, 200, 'the presentation must be cryptographically valid');
      const result = (await readEducationVerification(base, policyName, vp.sessionId)).body;
      assert.equal(result.state, 'rejected', `${policyName} decided on a mismatched set`);
      assert.match(result.reason, /name different learners/);
      assert.equal(result.decision, undefined);
      // And it must not print either learner id on the screen.
      const text = JSON.stringify(result);
      for (const id of ids) assert.equal(text.includes(id), false, `the rejection printed ${id}`);
    }
  });

  test('two learners, one wallet, and both portals refuse the combination', async () => {
    guard();
    // ONE holder key, two different authenticated learners.
    const holder = await createHolder();
    const mismatchSession = await signInAs(MISMATCH);
    const otherSession = await signInAs(PRIYA);

    const credentials = {};
    // School and university from the mismatch fixture...
    for (const role of ['school', 'university']) {
      credentials[role] = (await collect(role, mismatchSession, holder)).credential;
    }
    // ...and the college diploma from a DIFFERENT learner's account.
    credentials.college = (await collect('college', otherSession, holder)).credential;

    assert.notEqual(
      disclosableValues(credentials.college).learnerId,
      disclosableValues(credentials.school).learnerId,
      'the fixtures no longer disagree, so this test proves nothing',
    );

    for (const policyName of ['masters', 'job']) {
      const policy = await educationPolicy(base, policyName);
      const session = await startEducationVerification(base, policyName);
      const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
      const presentations = {};
      for (const role of ROLES) {
        presentations[ROLE_IDS[role]] = await presentSdJwt({
          credential: credentials[role],
          disclose: policy.requestedClaims[role],
          nonce: request.nonce,
          audience: request.client_id,
          holder,
        });
      }
      const submission = await submitMultiPresentation({
        base,
        responseUri: request.response_uri,
        state: request.state,
        presentations,
      });
      // Cryptographically impeccable: three valid signatures, three trusted
      // issuers, one holder key. If this were a 4xx the test would be proving
      // something else.
      assert.equal(submission.status, 200, 'the presentation must be cryptographically valid');

      const result = (await readEducationVerification(base, policyName, session.sessionId)).body;
      assert.equal(result.state, 'rejected', `${policyName} decided on a mismatched set`);
      assert.match(result.reason, /name different learners/);
      assert.equal(result.decision, undefined, 'a rejection must carry no business answer');
    }
  });
});
