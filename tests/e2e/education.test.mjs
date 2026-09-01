// End-to-end evidence for Iteration 03, against the running stack.
//
// The journey under test is the one the showcase's central claim rests on: ONE
// wallet holding THREE credentials from THREE independent institutions, presented
// to TWO unrelated relying parties who ask different questions of the same cards
// and get different answers.
//
// Every test drives the real protocol. Credentials are really issued by the three
// issuers, really signed with their own DIDs, and really presented in one VP
// token with a Key Binding JWT per credential. Nothing here mocks a verification
// result, a percentage comparison or a verdict.
//
//   cd deploy && docker compose up -d && ../scripts/bootstrap.sh
//   ../scripts/seed-education.sh
//   npm run test:e2e
//
// Pre-authorised offers are used to get credentials into the scripted wallet.
// That is protocol evidence, not the customer journey: the charter requires
// authenticated wallet-driven issuance on a real device, and a scripted client
// may never stand in for it.

import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  deployEnv,
  requireStack,
  issueEducationCredential,
  startEducationVerification,
  educationPolicy,
  readEducationVerification,
  cancelEducationVerification,
  requestUriFromQr,
  ensureNegativeFixture,
  retireNegativeFixture,
  NEGATIVE_SCHOOL_FIXTURE,
  NEGATIVE_COLLEGE_FIXTURE,
  NEGATIVE_UNIVERSITY_FIXTURE,
  // Reads a PRESENTATION's disclosures. parseSdJwt/disclosableClaims in
  // lib/wallet.mjs read a CREDENTIAL, and choke on the trailing Key Binding JWT.
  disclosedClaimNames,
  json,
} from './lib/stack.mjs';
import {
  createHolder,
  collectCredential,
  presentSdJwt,
  forgeDisclosureValue,
  fetchRequestObject,
  submitMultiPresentation,
  declinePresentation,
} from './lib/wallet.mjs';

const { base, opsBase, untrustedIssuerDid } = deployEnv();
const SCHOOL_ID = 'school_cred';
const COLLEGE_ID = 'college_cred';
const UNIVERSITY_ID = 'university_cred';
const ROLE_IDS = { school: SCHOOL_ID, college: COLLEGE_ID, university: UNIVERSITY_ID };

/** What each portal discloses, per role. Mirrors the published policy. */
const DISCLOSE = {
  masters: {
    school: ['learnerId', 'completionStatus', 'percentage'],
    college: ['learnerId', 'completionStatus', 'percentage'],
    university: ['learnerId', 'completionStatus', 'degreeLevel', 'fieldOfStudy', 'percentage'],
  },
  job: {
    school: ['learnerId', 'completionStatus'],
    college: ['learnerId', 'completionStatus'],
    university: ['learnerId', 'completionStatus', 'degreeLevel', 'fieldOfStudy', 'percentage'],
  },
};

/**
 * The fixtures scripts/seed-education.sh seeds, by the case each exercises.
 *
 * Only the learnerId is named here. Every claim value is read back from the
 * seeded registry record, so editing a fixture moves the tests with it instead of
 * leaving them asserting stale numbers.
 */
const FIXTURES = {
  bothPolicies: 'EDU-L-004512',
  twoAnswers: 'EDU-L-006733',
  onTheBoundary: 'EDU-L-007841',
  schoolBelow: 'EDU-L-008120',
  collegeBelow: 'EDU-L-009002',
  universityBelowJob: 'EDU-L-009315',
  universityIncomplete: 'EDU-L-010447',
  unsupportedField: 'EDU-L-011238',
  mismatched: 'EDU-L-012550',
  mismatchedCollege: 'EDU-L-012551',
};

let skip = null;
const issuerDids = { school: null, college: null, university: null };
let untrustedDid = null;

before(async () => {
  skip = await requireStack(base);
  if (skip) return;
  // The issuer DIDs come from the deployment rather than the environment: these
  // tests must fail loudly if bootstrap has not minted THREE separate issuers,
  // because "three independent institutions" is the premise of the iteration.
  const configs = await json(`${opsBase}/credential-schema/oid4vci-configs`);
  const list = Array.isArray(configs.body) ? configs.body : [];
  issuerDids.school = list.find((c) => c.name === 'School Record Credential')?.author || null;
  issuerDids.college = list.find((c) => c.name === 'College Record Credential')?.author || null;
  issuerDids.university = list.find((c) => c.name === 'University Record Credential')?.author || null;
  untrustedDid = untrustedIssuerDid || null;

  const dids = Object.values(issuerDids);
  if (dids.some((d) => !d)) {
    skip = 'the Education credential schemas are not published — run scripts/bootstrap.sh';
  } else if (new Set(dids).size !== 3) {
    skip = 'the three Education issuers do not have three distinct DIDs, so they are not independent';
  }
});

const guard = () => {
  if (skip) throw new Error(skip);
};

/** Reads a learner's seeded registry record, so tests assert against source data. */
async function registryRecord(entity, learnerId) {
  const res = await json(`${opsBase}/api/v1/${entity}/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filters: { learnerId: { eq: learnerId } } }),
  });
  const rows = Array.isArray(res.body) ? res.body : res.body?.data || [];
  return rows[0] || null;
}

/** The claims each issuer puts in its credential, from its own record. */
function claimsFor(role, record) {
  if (role === 'school') {
    return {
      learnerId: record.learnerId,
      completionStatus: record.completionStatus,
      percentage: record.percentage,
      completionYear: record.completionYear,
    };
  }
  if (role === 'college') {
    return {
      learnerId: record.learnerId,
      completionStatus: record.completionStatus,
      percentage: record.percentage,
      qualification: record.qualification,
      specialization: record.specialization,
      completionYear: record.completionYear,
    };
  }
  return {
    learnerId: record.learnerId,
    completionStatus: record.completionStatus,
    degreeLevel: record.degreeLevel,
    fieldOfStudy: record.fieldOfStudy,
    percentage: record.percentage,
    graduationYear: record.graduationYear,
  };
}

const ENTITIES = { school: 'SchoolRecord', college: 'CollegeRecord', university: 'UniversityRecord' };

/**
 * Issues all three credentials for one seeded learner into ONE wallet.
 *
 * `overrides` lets a test replace one role's claims or issuer — which is how the
 * mismatched-learner, wrong-role and untrusted-issuer cases are built, without a
 * second copy of this function.
 */
async function walletWithThreeCredentials(learnerId, { holder: existing, overrides = {} } = {}) {
  const holder = existing || (await createHolder());
  const credentials = {};
  const records = {};
  const vcts = {};

  for (const role of ['school', 'college', 'university']) {
    const override = overrides[role] || {};
    if (override.omit) continue;
    const record = override.record || (await registryRecord(ENTITIES[role], override.learnerId || learnerId));
    if (!record) continue;
    records[role] = record;
    const offer = await issueEducationCredential({
      base,
      which: role,
      issuerDid: override.issuerDid || issuerDids[role],
      credentialName: override.credentialName,
      claims: override.claims || claimsFor(role, record),
    });
    const collected = await collectCredential({ base: offer.issuerBase, offer, holder });
    credentials[role] = collected.credential;
    vcts[role] = offer.vct;
  }

  return { holder, credentials, records, vcts };
}

/**
 * Runs one full three-credential presentation and returns the portal's answer.
 *
 * `holders` lets a test sign one credential with a DIFFERENT key, which is how
 * "credentials collected by different holders" (REQUIREMENTS §9) is exercised.
 */
async function presentTo(
  policy,
  { holder, credentials, disclose, holders = {}, omit = [], algs = {}, tamper = {} },
) {
  const session = await startEducationVerification(base, policy);
  const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });

  const presentations = {};
  for (const role of ['school', 'college', 'university']) {
    if (omit.includes(role) || !credentials[role]) continue;
    presentations[ROLE_IDS[role]] = await presentSdJwt({
      credential: credentials[role],
      disclose: (disclose && disclose[role]) || DISCLOSE[policy][role],
      nonce: request.nonce,
      audience: request.client_id,
      holder: holders[role] || holder,
      holderAlg: algs[role],
      // Per-role tamper hooks, so a test can break exactly one credential of the
      // three and the other two stay genuine — which is what makes a rejection
      // attributable to the tampering rather than to a broken presentation.
      tamperDisclosures: tamper[role]?.disclosures,
      tamperJws: tamper[role]?.jws,
    });
  }

  const submission = await submitMultiPresentation({
    base,
    responseUri: request.response_uri,
    state: request.state,
    presentations,
  });
  const result = await readEducationVerification(base, policy, session.sessionId);
  return { session, request, presentations, submission, result: result.body };
}

describe('what each portal asks for', () => {
  test('both portals pin three credential types to three different issuers', async () => {
    guard();
    for (const policy of ['masters', 'job']) {
      const published = await educationPolicy(base, policy);
      assert.match(published.credentialTypes.school, /\/school\/vct\/school-record-credential$/);
      assert.match(published.credentialTypes.college, /\/college\/vct\/college-record-credential$/);
      assert.match(published.credentialTypes.university, /\/university\/vct\/university-record-credential$/);
      const educationRoles = published.trustedIssuers
        .flatMap((i) => i.roles || [])
        .filter((r) => ['school', 'college', 'university'].includes(r));
      assert.deepEqual(
        educationRoles.sort(),
        ['college', 'school', 'university'],
        'exactly one trusted issuer per Education role',
      );
    }
  });

  test('the job portal does not ask for the school or college percentage', async () => {
    guard();
    const job = await educationPolicy(base, 'job');
    assert.equal(job.requestedClaims.school.includes('percentage'), false);
    assert.equal(job.requestedClaims.college.includes('percentage'), false);
    // It does need the university one: that is the threshold its rule applies.
    assert.equal(job.requestedClaims.university.includes('percentage'), true);
    assert.deepEqual(job.notRequested.school, ['percentage']);
    assert.deepEqual(job.notRequested.college, ['percentage']);
  });

  test("the master's portal asks for all three percentages, and neither asks for identity", async () => {
    guard();
    const masters = await educationPolicy(base, 'masters');
    for (const role of ['school', 'college', 'university']) {
      assert.equal(masters.requestedClaims[role].includes('percentage'), true, `${role} percentage`);
    }
    for (const policy of ['masters', 'job']) {
      const published = await educationPolicy(base, policy);
      const asked = Object.values(published.requestedClaims).flat();
      for (const forbidden of [
        'nationalId',
        'name',
        'schoolStudentId',
        'collegeStudentId',
        'universityStudentId',
        'completionYear',
        'graduationYear',
        'specialization',
      ]) {
        assert.equal(asked.includes(forbidden), false, `${policy} must not request ${forbidden}`);
      }
    }
  });

  test('both portals publish the committed thresholds, not something the page invented', async () => {
    guard();
    assert.deepEqual((await educationPolicy(base, 'masters')).thresholds, {
      school: 60,
      college: 60,
      university: 70,
    });
    assert.deepEqual((await educationPolicy(base, 'job')).thresholds, { university: 60 });
  });
});

describe('one learner, one wallet, two answers', () => {
  test("a 65% degree is shortlisted for interview but not eligible for the Master's", async () => {
    guard();
    // The single most important test in the iteration. ONE wallet, ONE set of
    // three credentials, presented to two parties in sequence — and the answers
    // differ because the two policies differ, not because anything about the
    // learner or the credentials changed between the two presentations.
    const wallet = await walletWithThreeCredentials(FIXTURES.twoAnswers);
    assert.equal(wallet.records.university.percentage, 65, 'fixture drifted away from the 65% case');

    const job = await presentTo('job', wallet);
    assert.equal(job.result.state, 'decided');
    assert.equal(job.result.decision, 'ELIGIBLE');
    assert.equal(job.result.headline, 'SELECTED FOR INTERVIEW — ROUND 1');

    const masters = await presentTo('masters', wallet);
    assert.equal(masters.result.state, 'decided');
    assert.equal(masters.result.decision, 'NOT_ELIGIBLE');
    assert.match(masters.result.reason, /university percentage is below the 70%/);
    assert.deepEqual(masters.result.shortfall, { role: 'university', required: 70, actual: '65%' });
    // And the two thresholds this learner DID clear, so the screen can say which
    // single number fell short. Without them the admissions page printed
    // "school — not reached" over a 72% school result that had passed.
    assert.equal(masters.result.verified.school.percentage, '72%');
    assert.equal(masters.result.verified.college.percentage, '68.4%');
    assert.equal(masters.result.verified.university.percentage, undefined);
  });

  test('a learner who meets both rules gets both answers, each in the right words', async () => {
    guard();
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies);

    const masters = await presentTo('masters', wallet);
    assert.equal(masters.result.decision, 'ELIGIBLE');
    assert.equal(masters.result.headline, "ELIGIBLE FOR MASTER'S APPLICATION");
    // PRODUCT forbids ever implying admission or employment. Asserted on the
    // wire, not only in the unit tests, because this is what a screen shows.
    const mastersText = JSON.stringify(masters.result).toUpperCase();
    for (const forbidden of ['ADMITTED', 'ADMISSION CONFIRMED', 'SEAT']) {
      assert.equal(mastersText.includes(forbidden), false, `must never say ${forbidden}`);
    }

    const job = await presentTo('job', wallet);
    assert.equal(job.result.decision, 'ELIGIBLE');
    assert.equal(job.result.headline, 'SELECTED FOR INTERVIEW — ROUND 1');
    const jobText = JSON.stringify(job.result).toUpperCase();
    for (const forbidden of ['HIRED', 'JOB OFFER', 'APPOINTED', 'EMPLOYED']) {
      assert.equal(jobText.includes(forbidden), false, `must never say ${forbidden}`);
    }
  });

  test('the two portals are two different parties to the wallet', async () => {
    guard();
    // A wallet names the requesting party from the key that SIGNED the request
    // object. If the two portals shared a signer, a learner presenting to both in
    // one sitting would see the wrong name on the second consent screen — the
    // exact defect Iteration 02 shipped and then fixed for the bank.
    const masters = await startEducationVerification(base, 'masters');
    const job = await startEducationVerification(base, 'job');
    const mastersRequest = await fetchRequestObject({ requestUri: requestUriFromQr(masters.qrData) });
    const jobRequest = await fetchRequestObject({ requestUri: requestUriFromQr(job.qrData) });
    assert.match(mastersRequest.client_id, /^did:web:/);
    assert.match(jobRequest.client_id, /^did:web:/);
    assert.notEqual(mastersRequest.client_id, jobRequest.client_id);
    await cancelEducationVerification(base, 'masters', masters.sessionId);
    await cancelEducationVerification(base, 'job', job.sessionId);
  });
});

describe('the thresholds, at and around the boundary', () => {
  test('exactly on 60.00 / 60.00 / 70.00 is eligible, because both rules are >=', async () => {
    guard();
    const wallet = await walletWithThreeCredentials(FIXTURES.onTheBoundary);
    assert.equal(wallet.records.school.percentage, 60);
    assert.equal(wallet.records.college.percentage, 60);
    assert.equal(wallet.records.university.percentage, 70);
    const masters = await presentTo('masters', wallet);
    assert.equal(masters.result.decision, 'ELIGIBLE');
    const job = await presentTo('job', wallet);
    assert.equal(job.result.decision, 'ELIGIBLE');
  });

  test('a school percentage below 60 is NOT ELIGIBLE, and names the one number', async () => {
    guard();
    const wallet = await walletWithThreeCredentials(FIXTURES.schoolBelow);
    const masters = await presentTo('masters', wallet);
    assert.equal(masters.result.decision, 'NOT_ELIGIBLE');
    assert.deepEqual(masters.result.shortfall, { role: 'school', required: 60, actual: '59.5%' });
    // The same learner still clears the job rule: the school percentage is not a
    // job threshold, and the job portal never even received it.
    const job = await presentTo('job', wallet);
    assert.equal(job.result.decision, 'ELIGIBLE');
  });

  test('a college percentage below 60 is NOT ELIGIBLE for the master\'s only', async () => {
    guard();
    const wallet = await walletWithThreeCredentials(FIXTURES.collegeBelow);
    assert.equal((await presentTo('masters', wallet)).result.decision, 'NOT_ELIGIBLE');
    assert.equal((await presentTo('job', wallet)).result.decision, 'ELIGIBLE');
  });

  test('a university percentage below 60 fails both rules', async () => {
    guard();
    const wallet = await walletWithThreeCredentials(FIXTURES.universityBelowJob);
    const job = await presentTo('job', wallet);
    assert.equal(job.result.decision, 'NOT_ELIGIBLE');
    assert.deepEqual(job.result.shortfall, { role: 'university', required: 60, actual: '55.25%' });
    assert.equal((await presentTo('masters', wallet)).result.decision, 'NOT_ELIGIBLE');
  });
});

describe('business answers that are not threshold failures', () => {
  test('an unfinished degree is NOT ELIGIBLE with the status named', async () => {
    guard();
    const wallet = await walletWithThreeCredentials(FIXTURES.universityIncomplete);
    for (const policy of ['masters', 'job']) {
      const result = (await presentTo(policy, wallet)).result;
      assert.equal(result.decision, 'NOT_ELIGIBLE');
      assert.match(result.reason, /university qualification is not completed \(IN_PROGRESS\)/);
    }
  });

  test('a field of study neither policy accepts is NOT ELIGIBLE, not a verification failure', async () => {
    guard();
    const wallet = await walletWithThreeCredentials(FIXTURES.unsupportedField);
    for (const policy of ['masters', 'job']) {
      const result = (await presentTo(policy, wallet)).result;
      assert.equal(result.state, 'decided', 'a policy answer, not a rejection');
      assert.equal(result.decision, 'NOT_ELIGIBLE');
      assert.match(result.reason, /MECHANICAL is not an accepted field of study/);
    }
  });
});

describe('what the portals must refuse', () => {
  test('three credentials naming different learners are REJECTED, not answered', async () => {
    guard();
    // The correlation case. All three credentials are validly signed by their own
    // trusted issuer and bound to one holder — the ONLY thing wrong is that the
    // college one names a different learner. That must be a rejection, never
    // ordinary ineligibility, and it must not print either learner's id.
    const wallet = await walletWithThreeCredentials(FIXTURES.mismatched, {
      overrides: { college: { learnerId: FIXTURES.mismatchedCollege } },
    });
    assert.notEqual(wallet.records.college.learnerId, wallet.records.school.learnerId);

    for (const policy of ['masters', 'job']) {
      const result = (await presentTo(policy, wallet)).result;
      assert.equal(result.state, 'rejected');
      assert.match(result.reason, /name different learners/);
      const text = JSON.stringify(result);
      assert.equal(text.includes(FIXTURES.mismatched), false, 'a rejection must not print a learner id');
      assert.equal(text.includes(FIXTURES.mismatchedCollege), false);
    }
  });

  test('a credential presented in the wrong role slot is REJECTED', async () => {
    guard();
    // The college's diploma, offered as the degree. Valid signature, trusted
    // issuer, same holder — refused only because the university slot is pinned to
    // the University's DID and to the university vct. This is what makes three
    // separate issuer identities load-bearing rather than decorative.
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies);
    const session = await startEducationVerification(base, 'masters');
    const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
    const presentations = {
      [SCHOOL_ID]: await presentSdJwt({
        credential: wallet.credentials.school,
        disclose: DISCLOSE.masters.school,
        nonce: request.nonce,
        audience: request.client_id,
        holder: wallet.holder,
      }),
      [COLLEGE_ID]: await presentSdJwt({
        credential: wallet.credentials.college,
        disclose: DISCLOSE.masters.college,
        nonce: request.nonce,
        audience: request.client_id,
        holder: wallet.holder,
      }),
      // The college credential again, this time in the university slot.
      [UNIVERSITY_ID]: await presentSdJwt({
        credential: wallet.credentials.college,
        disclose: DISCLOSE.masters.college,
        nonce: request.nonce,
        audience: request.client_id,
        holder: wallet.holder,
      }),
    };
    await submitMultiPresentation({
      base,
      responseUri: request.response_uri,
      state: request.state,
      presentations,
    });
    const result = (await readEducationVerification(base, 'masters', session.sessionId)).body;
    assert.notEqual(result.decision, 'ELIGIBLE', 'a diploma must never satisfy the degree slot');
    assert.equal(result.state, 'rejected');
  });

  test('a credential collected by a different holder is REJECTED', async () => {
    guard();
    // Three valid credentials from three trusted issuers, naming one learner —
    // but the university one is key-bound to a SECOND wallet. Matching learner
    // ids are not correlation if the credentials are not all held by one person,
    // which is why holder binding is checked before the business rule.
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies);
    const secondHolder = await createHolder();
    const result = (
      await presentTo('masters', { ...wallet, holders: { university: secondHolder } })
    ).result;
    assert.notEqual(result.decision, 'ELIGIBLE');
    assert.equal(result.state, 'rejected');
  });

  test('a presentation missing one of the three credentials is REJECTED', async () => {
    guard();
    // REQUIREMENTS §9's partial-issuance case: EDU-L-013001 has no university
    // record, so no university credential can exist. Both portals must refuse
    // rather than decide on two out of three.
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies);
    for (const policy of ['masters', 'job']) {
      const result = (await presentTo(policy, { ...wallet, omit: ['university'] })).result;
      assert.equal(result.state, 'rejected');
      assert.equal(result.decision, undefined, 'no decision may be reported for two of three');
      // The reason is upstream's: DCQL requires a match for every credential
      // query, so oid4vc-service refuses the response before the verifier's own
      // checks run. The verifier's 'did not carry all three' message is the
      // backstop for a submission that somehow gets past DCQL, and is covered by
      // the unit tests rather than here.
      assert.match(result.reason, /verification failed|no university credential|did not carry all three/);
    }
  });

  test('a claim the job portal never asked for does not reach it', async () => {
    guard();
    // A wallet that reveals MORE than the request asked for. The job portal did
    // not ask for the school percentage, and this presentation discloses it
    // anyway.
    //
    // What actually happens, verified here rather than assumed: DCQL claim
    // filtering in oid4vc-service drops the unrequested disclosure, so the
    // percentage never reaches the verifier service, its decision or its
    // response. The presentation is therefore DECIDED, not rejected.
    //
    // Stated plainly because it is a real limit on the guarantee: the extra
    // disclosure did travel from the wallet to the protocol façade. What this
    // test establishes is narrower and still worth having — the relying party
    // cannot learn it, and the decision cannot be influenced by it. The
    // verifier's own assertExactClaims (step 2) remains the backstop for
    // anything filtering lets through, and tests/unit covers it directly.
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies);
    const { result, presentations } = await presentTo('job', {
      ...wallet,
      disclose: { ...DISCLOSE.job, school: ['learnerId', 'completionStatus', 'percentage'] },
    });
    assert.equal(
      disclosedClaimNames(presentations[SCHOOL_ID]).includes('percentage'),
      true,
      'the wallet really did over-disclose, or this test proves nothing',
    );
    assert.equal(result.state, 'decided');
    assert.equal(result.disclosed.school.percentage, undefined, 'the portal must not receive it');
    assert.deepEqual(result.thresholds, { university: 60 }, 'and it cannot become a threshold');
  });

  test('a learner who declines discloses nothing and gets no decision', async () => {
    guard();
    const session = await startEducationVerification(base, 'masters');
    const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
    await declinePresentation({ base, state: request.state, responseUri: request.response_uri });
    const result = (await readEducationVerification(base, 'masters', session.sessionId)).body;
    assert.ok(['declined', 'waiting'].includes(result.state), `unexpected state ${result.state}`);
    assert.equal(result.decision, undefined);
    assert.equal(result.disclosed, undefined);
  });
});

describe('a valid credential from an issuer outside the allowlist', () => {
  const created = [];
  after(async () => {
    for (const schemaId of created) await retireNegativeFixture(schemaId);
  });

  for (const [role, fixture] of [
    ['school', NEGATIVE_SCHOOL_FIXTURE],
    ['college', NEGATIVE_COLLEGE_FIXTURE],
    ['university', NEGATIVE_UNIVERSITY_FIXTURE],
  ]) {
    test(`${role}: valid signature, correct vct, untrusted issuer — REJECTED`, async () => {
      guard();
      if (!untrustedDid) throw new Error('UNTRUSTED_ISSUER_DID is not in deploy/.env — run scripts/bootstrap.sh');
      const cfg = await ensureNegativeFixture(untrustedDid, fixture);
      created.push(cfg.registrySchemaId || cfg.schemaId);

      const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies, {
        overrides: { [role]: { issuerDid: untrustedDid, credentialName: fixture.name } },
      });
      const { result } = await presentTo('masters', wallet);
      // The signature is genuinely valid and the vct is genuinely the one the
      // query pins. The ONLY thing that refuses this is the trust allowlist,
      // which is the whole point of the fixture.
      assert.equal(result.state, 'rejected');
      assert.notEqual(result.decision, 'ELIGIBLE');
    });
  }
});

describe('what a portal never receives', () => {
  test('no National ID or Student ID reaches either verifier, in any outcome', async () => {
    guard();
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies);
    for (const policy of ['masters', 'job']) {
      const { result, presentations } = await presentTo(policy, wallet);
      const text = JSON.stringify(result);
      for (const forbidden of ['nationalId', 'NAT-', 'SCH-', 'COL-', 'UNI-']) {
        assert.equal(text.includes(forbidden), false, `${policy} response leaked ${forbidden}`);
      }
      // And not merely absent from the response: absent from the wire. The
      // presented SD-JWTs must not carry the disclosures at all.
      for (const [id, presentation] of Object.entries(presentations)) {
        const disclosed = disclosedClaimNames(presentation);
        for (const forbidden of ['nationalId', 'schoolStudentId', 'collegeStudentId', 'universityStudentId']) {
          assert.equal(disclosed.includes(forbidden), false, `${id} disclosed ${forbidden}`);
        }
      }
    }
  });

  test('the job portal never receives the school or college percentage on the wire', async () => {
    guard();
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies);
    const { presentations, result } = await presentTo('job', wallet);
    assert.equal(disclosedClaimNames(presentations[SCHOOL_ID]).includes('percentage'), false);
    assert.equal(disclosedClaimNames(presentations[COLLEGE_ID]).includes('percentage'), false);
    assert.equal(result.disclosed.school.percentage, undefined);
    assert.equal(result.disclosed.college.percentage, undefined);
    // The university one is requested, so it is there — and that asymmetry
    // between the two portals is the privacy claim made observable.
    assert.equal(disclosedClaimNames(presentations[UNIVERSITY_ID]).includes('percentage'), true);
  });
});

// REQUIREMENTS §8, the half that is about the protocol rather than the rule:
// tampering, replay, single-use state, and the approved-algorithm allowlist.
//
// These are not Education-specific controls — they are the shared verifier's, and
// Iterations 01 and 02 already prove them for one and two credentials. They are
// re-proved here because §8 and §10 ask for them for THIS iteration, and because
// three credentials is the first case where a control could pass on two of them
// and quietly not apply to the third.
describe('tampering and replay, over three credentials', () => {
  test('a forged percentage is refused outright, not merely found ineligible', async () => {
    guard();
    // The learner who falls short of the Master's 70%, with the university
    // percentage edited upward to clear it. The VALUE is not in the signed
    // payload — only its salted digest is — so re-encoding the disclosure breaks
    // the digest match and the stack refuses the presentation.
    //
    // The distinction this test protects is the one PRODUCT is most explicit
    // about: this must be REJECTED, never NOT ELIGIBLE and never ELIGIBLE.
    const wallet = await walletWithThreeCredentials(FIXTURES.twoAnswers);
    const { submission, result } = await presentTo('masters', {
      ...wallet,
      tamper: {
        university: {
          disclosures: (disclosures) =>
            disclosures.map((d) => (d.name === 'percentage' ? forgeDisclosureValue(d, 95) : d)),
        },
      },
    });
    assert.equal(submission.status, 403, 'the stack must refuse the presentation outright');
    assert.equal(result.state, 'rejected');
    assert.equal(result.decision, undefined, 'a tampered presentation gets no decision of any kind');
    assert.equal(result.disclosed, undefined);
  });

  test('a forged completion status on one credential of three is refused', async () => {
    guard();
    // The unfinished degree, edited to read COMPLETED. Tampering with the ONE
    // credential that fails, while the school and college credentials stay
    // genuine, is what proves the check applies per credential rather than to
    // the presentation as a whole.
    const wallet = await walletWithThreeCredentials(FIXTURES.universityIncomplete);
    const { submission, result } = await presentTo('job', {
      ...wallet,
      tamper: {
        university: {
          disclosures: (disclosures) =>
            disclosures.map((d) => (d.name === 'completionStatus' ? forgeDisclosureValue(d, 'COMPLETED') : d)),
        },
      },
    });
    assert.equal(submission.status, 403);
    assert.equal(result.state, 'rejected');
    assert.notEqual(result.decision, 'ELIGIBLE');
  });

  test("a tampered issuer signature on the school credential is refused", async () => {
    guard();
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies);
    const { submission, result } = await presentTo('masters', {
      ...wallet,
      tamper: {
        // Flip one character of the signed payload segment.
        school: {
          jws: (jws) => {
            const [header, payload, signature] = jws.split('.');
            const flipped = payload.slice(0, -1) + (payload.at(-1) === 'A' ? 'B' : 'A');
            return [header, flipped, signature].join('.');
          },
        },
      },
    });
    assert.equal(submission.status, 403);
    assert.equal(result.state, 'rejected');
  });

  test('a verified three-credential presentation cannot be replayed', async () => {
    guard();
    // Single-use transaction state. The second submission is byte-identical to
    // the first, which succeeded — so the only thing that can refuse it is the
    // state being consumed.
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies);
    const session = await startEducationVerification(base, 'masters');
    const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
    const presentations = {};
    for (const role of ['school', 'college', 'university']) {
      presentations[ROLE_IDS[role]] = await presentSdJwt({
        credential: wallet.credentials[role],
        disclose: DISCLOSE.masters[role],
        nonce: request.nonce,
        audience: request.client_id,
        holder: wallet.holder,
      });
    }

    const first = await submitMultiPresentation({
      base,
      responseUri: request.response_uri,
      state: request.state,
      presentations,
    });
    assert.equal(first.status, 200);
    assert.equal((await readEducationVerification(base, 'masters', session.sessionId)).body.decision, 'ELIGIBLE');

    const replay = await submitMultiPresentation({
      base,
      responseUri: request.response_uri,
      state: request.state,
      presentations,
    });
    assert.equal(replay.status, 400, 'the transaction is single-use');
    assert.match(JSON.stringify(replay.body), /not pending/);
  });

  test('a presentation made to the other portal is not accepted here', async () => {
    guard();
    // The two portals are two parties with two DIDs, so a presentation whose Key
    // Binding JWT names the employer as its audience must not satisfy the
    // university's request. Cross-verifier replay, which three credentials make
    // more tempting: the learner really does present the same cards to both.
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies);
    const employer = await startEducationVerification(base, 'job');
    const employerRequest = await fetchRequestObject({ requestUri: requestUriFromQr(employer.qrData) });
    const admissions = await startEducationVerification(base, 'masters');
    const admissionsRequest = await fetchRequestObject({ requestUri: requestUriFromQr(admissions.qrData) });

    const presentations = {};
    for (const role of ['school', 'college', 'university']) {
      presentations[ROLE_IDS[role]] = await presentSdJwt({
        credential: wallet.credentials[role],
        disclose: DISCLOSE.masters[role],
        // Bound to the EMPLOYER's nonce and audience...
        nonce: employerRequest.nonce,
        audience: employerRequest.client_id,
        holder: wallet.holder,
      });
    }
    // ...and submitted to the UNIVERSITY's transaction.
    const submission = await submitMultiPresentation({
      base,
      responseUri: admissionsRequest.response_uri,
      state: admissionsRequest.state,
      presentations,
    });
    assert.equal(submission.status, 403, 'a presentation made to another party must not be accepted');
    const result = (await readEducationVerification(base, 'masters', admissions.sessionId)).body;
    assert.equal(result.state, 'rejected');
    assert.equal(result.decision, undefined);
  });
});

describe('the approved-algorithm policy, on both Education portals', () => {
  test('both portals publish which algorithms they approve', async () => {
    guard();
    for (const policy of ['masters', 'job']) {
      assert.deepEqual((await educationPolicy(base, policy)).approvedAlgorithms, ['ES256']);
    }
  });

  test('an ES256 presentation is accepted and the check is reported', async () => {
    guard();
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies);
    const { submission, result } = await presentTo('masters', wallet);
    assert.equal(submission.status, 200);
    assert.equal(result.decision, 'ELIGIBLE');
    // The pill exists so the enforcement is visible on the portal screen, not
    // only in the verifier's source.
    assert.equal(result.checks.algorithm, 'OK');
  });

  test('an unapproved algorithm is rejected, though every signature verifies', async () => {
    guard();
    // ES384 key binding on all three credentials. Genuine keys, genuine
    // signatures, nothing tampered with — which is why the submission must be
    // ACCEPTED upstream. If this were a 4xx the test would be proving something
    // else entirely.
    const holder = await createHolder({ alg: 'ES384' });
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies, { holder });
    const { submission, result } = await presentTo('masters', {
      ...wallet,
      algs: { school: 'ES384', college: 'ES384', university: 'ES384' },
    });
    assert.equal(submission.status, 200, 'the presentation must be cryptographically valid');

    assert.equal(result.state, 'rejected');
    assert.equal(result.failedCheck, 'algorithm');
    assert.match(result.reason, /algorithm is not approved/);
    assert.match(result.diagnostic, /ES384/);

    // A rejection is not a business answer, and must never carry one.
    assert.equal(result.decision, undefined);
    assert.equal(result.disclosed, undefined, 'no claims may be reported for a refused presentation');
    assert.equal(result.learnerId, undefined, 'and no correlated learner id either');
  });

  test('an algorithm rejection is distinguishable from every other refusal', async () => {
    guard();
    // Both are "we could not trust what we were shown", and the evidence has to
    // be able to say which control fired.
    const holder = await createHolder({ alg: 'ES384' });
    const wallet = await walletWithThreeCredentials(FIXTURES.bothPolicies, { holder });
    const { result } = await presentTo('job', {
      ...wallet,
      algs: { school: 'ES384', college: 'ES384', university: 'ES384' },
    });
    assert.equal(result.failedCheck, 'algorithm');
    assert.doesNotMatch(result.reason, /issuer|learner/);
  });
});
