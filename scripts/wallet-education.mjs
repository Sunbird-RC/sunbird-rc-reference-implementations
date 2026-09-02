// A learner's wallet you drive by hand, so the two Education portals can be
// checked on a laptop with no phone in the loop.
//
// The Education counterpart of scripts/wallet-agriculture.mjs, and it differs in
// the way the use case does: THREE credentials from THREE institutions that have
// never heard of each other, collected into ONE holder key, and presented to
// EITHER of two relying parties who ask different questions of the same three
// cards. Collect once, present twice, and watch the answers differ.
//
// It is the SAME wallet the e2e suite uses (tests/e2e/lib/wallet.mjs): real ES256
// keys, a real proof of possession, real SD-JWT presentations with a Key Binding
// JWT per credential. Nothing here is stubbed.
//
//   ./scripts/wallet-education.sh twoAnswers                          collect only
//   ./scripts/wallet-education.sh twoAnswers masters <sessionId>      collect, then apply
//   ./scripts/wallet-education.sh twoAnswers job     <sessionId>
//   ./scripts/wallet-education.sh EDU-L-006733 job   <sessionId>      by learner id
//
// A MISMATCHED SET — the college card of a different learner, which both portals
// must refuse with REJECTED / UNABLE TO VERIFY rather than NOT ELIGIBLE:
//
//   ./scripts/wallet-education.sh mismatch masters <sessionId> --college EDU-L-012551
//
// All three credentials in that set are genuinely issued, genuinely signed by
// their own institution, and genuinely held by this one wallet key. Nothing is
// tampered with. Only the learnerId disagrees, which is the whole point: it is the
// COMBINATION that is wrong, not any one card.
//
// The session id is shown under the QR on either portal.
//
// Pre-authorised offers are used to get the credentials in. That is supporting
// protocol evidence, NOT the customer journey: the charter requires authenticated
// wallet-driven issuance on a real device, and this may never stand in for it.

import {
  deployEnv,
  requireStack,
  issueEducationCredential,
  educationPolicy,
  requestUriFromQr,
  json,
} from '../tests/e2e/lib/stack.mjs';
import {
  createHolder,
  collectCredential,
  presentSdJwt,
  fetchRequestObject,
  submitMultiPresentation,
} from '../tests/e2e/lib/wallet.mjs';

// The fixtures scripts/seed-education.sh seeds, named by the outcome they
// produce, so a demo can pick an outcome rather than remember an id.
const FIXTURES = {
  bothPolicies: 'EDU-L-004512',
  twoAnswers: 'EDU-L-006733',
  onTheBoundary: 'EDU-L-007841',
  schoolBelow: 'EDU-L-008120',
  collegeBelow: 'EDU-L-009002',
  universityBelow: 'EDU-L-009315',
  notCompleted: 'EDU-L-010447',
  wrongField: 'EDU-L-011238',
  mismatch: 'EDU-L-012550',
  noUniversity: 'EDU-L-013001',
};

const ROLES = ['school', 'college', 'university'];
const REQUEST_IDS = { school: 'school_cred', college: 'college_cred', university: 'university_cred' };
const ENTITIES = { school: 'SchoolRecord', college: 'CollegeRecord', university: 'UniversityRecord' };
const CREDENTIALS = {
  school: 'School Record Credential',
  college: 'College Record Credential',
  university: 'University Record Credential',
};

const argv = process.argv.slice(2);
// --<role> <learnerId> takes ONE credential from a different learner. Parsed out
// before the positionals so the plain three-argument form is untouched.
const from = {};
for (const role of ROLES) {
  const at = argv.indexOf(`--${role}`);
  if (at !== -1) {
    from[role] = argv[at + 1];
    argv.splice(at, 2);
  }
}
const [which, policyName, sessionId] = argv;
if (!which) {
  console.error('usage: ./scripts/wallet-education.sh <fixture|learnerId> [masters|job] [sessionId]');
  console.error(`\nfixtures: ${Object.entries(FIXTURES).map(([k, v]) => `${k} (${v})`).join(', ')}\n`);
  process.exit(2);
}
if (policyName && policyName !== 'masters' && policyName !== 'job') {
  console.error(`\n  unknown policy '${policyName}' — expected 'masters' or 'job'\n`);
  process.exit(2);
}
const learnerId = FIXTURES[which] || which;

const { base, opsBase } = deployEnv();
const problem = await requireStack(base);
if (problem) {
  console.error(`\n  ${problem}\n`);
  process.exit(1);
}

/** The issuer DIDs come from the deployment, not from the environment. */
const configs = await json(`${opsBase}/credential-schema/oid4vci-configs`);
const published = Array.isArray(configs.body) ? configs.body : [];
const issuerDids = {};
for (const role of ROLES) {
  issuerDids[role] = published.find((c) => c.name === CREDENTIALS[role])?.author;
}
if (ROLES.some((role) => !issuerDids[role])) {
  console.error('\n  the Education schemas are not published — run ./scripts/bootstrap.sh\n');
  process.exit(1);
}
if (new Set(ROLES.map((r) => issuerDids[r])).size !== 3) {
  console.error('\n  the three institutions share an issuer DID, so they are not independent\n');
  process.exit(1);
}

async function record(entity, id) {
  const res = await json(`${opsBase}/api/v1/${entity}/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filters: { learnerId: { eq: id } } }),
  });
  const rows = Array.isArray(res.body) ? res.body : res.body?.data || [];
  return rows[0] || null;
}

/** The claims each institution puts in its own credential, from its own record. */
function claimsFor(role, r) {
  if (role === 'school') {
    return {
      learnerId: r.learnerId,
      completionStatus: r.completionStatus,
      percentage: r.percentage,
      completionYear: r.completionYear,
    };
  }
  if (role === 'college') {
    return {
      learnerId: r.learnerId,
      completionStatus: r.completionStatus,
      percentage: r.percentage,
      qualification: r.qualification,
      specialization: r.specialization,
      completionYear: r.completionYear,
    };
  }
  return {
    learnerId: r.learnerId,
    completionStatus: r.completionStatus,
    degreeLevel: r.degreeLevel,
    fieldOfStudy: r.fieldOfStudy,
    percentage: r.percentage,
    graduationYear: r.graduationYear,
  };
}

const mismatched = Object.keys(from);
if (mismatched.length) {
  console.log(`\nMISMATCHED SET: ${mismatched.map((r) => `${r} card ${from[r]}`).join(', ')}`);
}

const holder = await createHolder();
console.log('\nwallet: fresh ES256 holder key (ONE key, all three credentials)');

// Claims are copied from the seeded registry records, so this driver cannot
// present a value the registry does not hold.
const credentials = {};
for (const role of ROLES) {
  const id = from[role] || learnerId;
  const r = await record(ENTITIES[role], id);
  if (!r) {
    // A real case, not an error: EDU-L-013001 is seeded with no university record
    // so the "unable to verify" path can be demonstrated from a partial wallet.
    console.log(`stored: no ${role} credential — ${id} has no ${ENTITIES[role]}, on purpose`);
    continue;
  }
  const offer = await issueEducationCredential({
    base,
    which: role,
    issuerDid: issuerDids[role],
    claims: claimsFor(role, r),
  });
  credentials[role] = (await collectCredential({ base: offer.issuerBase, offer, holder })).credential;
  console.log(`stored: ${CREDENTIALS[role].padEnd(30)} from ${issuerDids[role]}`);
}

if (!policyName || !sessionId) {
  console.log('\nNo policy and session id given, so nothing was presented.');
  console.log('Open a portal — /admissions/ or /employer/ — press Start, and re-run with');
  console.log('  ./scripts/wallet-education.sh <fixture> <masters|job> <sessionId>');
  console.log('using the session id printed under the QR.\n');
  process.exit(0);
}

// What travels is the portal's own published policy, read from the service rather
// than restated here — so this driver cannot over-disclose relative to the ask,
// and the difference between the two portals' requests is the service's, not this
// file's.
const policy = await educationPolicy(base, policyName);
// The request object comes from the URL the QR carries, not from one rebuilt out
// of PUBLIC_URL: each portal signs with its own identity from its own instance,
// published under its own path prefix, so a guessed URL reaches the wrong signer
// and 404s.
const session = await json(`${base}/api/verifier/education/${policyName}/sessions/${sessionId}`);
const qrData = session.body?.qrData;
const request = await fetchRequestObject(
  qrData ? { requestUri: requestUriFromQr(qrData) } : { base, transactionId: sessionId },
);

const presentations = {};
for (const role of ROLES) {
  if (!credentials[role]) continue;
  presentations[REQUEST_IDS[role]] = await presentSdJwt({
    credential: credentials[role],
    disclose: policy.requestedClaims[role],
    nonce: request.nonce,
    audience: request.client_id,
    holder,
  });
}

const res = await submitMultiPresentation({
  base,
  responseUri: request.response_uri,
  state: request.state,
  presentations,
});
for (const role of ROLES) {
  if (!credentials[role]) continue;
  console.log(`\nshared: ${role.padEnd(10)} -> ${policy.requestedClaims[role].join(', ')}`);
}
console.log(`\nsent:   HTTP ${res.status}${res.status === 200 ? '' : ' — the stack refused it'}`);

// Printed here as well as on the page, because the point of the driver is
// checking that the two agree: whatever the page shows must be what the service
// decided. Reading is idempotent, so this does not take the answer away from the
// page.
//
// It reads through the PORTAL's own prefixed URL rather than a shorter one on
// purpose. Iteration 02's suite used only the Age path while the page used the
// agriculture path, and a missing route went unnoticed: the page reported "the
// request expired" over applications the verifier had decided ELIGIBLE. A driver
// that avoided the page's URL would have hidden that too.
const answer = await json(`${base}/api/verifier/education/${policyName}/sessions/${sessionId}`);
const body = answer.body || {};
console.log(`\nportal: ${body.headline || body.decision || body.state || 'no decision'}`);
if (body.reason) console.log(`        ${body.reason}`);
if (body.detail) console.log(`        ${body.detail}`);
if (body.shortfall) {
  console.log(`        short: ${body.shortfall.role} ${body.shortfall.actual} < ${body.shortfall.required}%`);
}
console.log('\nThe portal page updates within a second or two.\n');
