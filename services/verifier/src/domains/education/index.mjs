// Education domain module.
//
// The whole Education-specific surface of the verifier: which claims each portal
// asks for from which credential, and what a verified set of three credentials
// means for two different purposes. Everything else in services/verifier stays
// generic — DESIGN §3 limits Education code to entities, issuer configuration,
// schemas, the two portals, fixtures and this module, and holding to that is the
// point. Three iterations sharing one verifier is the showcase's central claim.
//
// It receives only verified, allowlisted, minimum-disclosure claims from
// credentials already proven to be signed by the right issuer for their role,
// signed with an approved algorithm, and bound to the same holder. It never sees
// a raw presentation, an undisclosed claim, a National ID, a Student ID, or an
// unverified credential.
//
// Two distinctions this module exists to keep straight:
//
//   * A VERIFICATION problem — correlation broken, a claim that is not what the
//     schema promised — is REJECTED / UNABLE TO VERIFY. A BUSINESS answer — a
//     percentage below a threshold, an unfinished qualification, a field this
//     policy does not accept — is NOT ELIGIBLE. PRODUCT is explicit that the
//     first must never be dressed up as the second.
//   * Eligibility is NOT the outcome. "Eligible for a Master's application" is
//     not admission and "selected for interview round one" is not employment.
//     PRODUCT forbids ever displaying ADMITTED or implying a job offer, so the
//     exact wording lives here beside the rule that produces it and is asserted
//     by tests.

import { meetsThreshold, percentageToHundredths, formatPercentage } from './percentage.mjs';

/** DCQL query ids. These key the claims in the multi-credential VP response. */
export const SCHOOL_REQUEST_ID = 'school_cred';
export const COLLEGE_REQUEST_ID = 'college_cred';
export const UNIVERSITY_REQUEST_ID = 'university_cred';

/**
 * Minimum disclosure, per REQUIREMENTS §7.
 *
 * Read the three lists together. Every credential discloses `learnerId` — that
 * repetition is the whole point, since correlation is only meaningful if all
 * three credentials say it — plus exactly the fields a policy consumes.
 *
 * The two policies deliberately ask for DIFFERENT sets. The job portal never
 * asks for the School or College percentage, because its rule does not use them,
 * and asking anyway would disclose more than the purpose requires. That
 * difference is the clearest evidence in the iteration that disclosure follows
 * purpose rather than convenience.
 *
 * Never requested by either portal: National ID (which never leaves an issuer at
 * all), any Student ID, name, address, date of birth, contact details,
 * transcripts, subjects, individual marks, the College specialization, and the
 * completion years.
 */
export const MASTERS_CLAIMS = {
  school: ['learnerId', 'completionStatus', 'percentage'],
  college: ['learnerId', 'completionStatus', 'percentage'],
  university: ['learnerId', 'completionStatus', 'degreeLevel', 'fieldOfStudy', 'percentage'],
};

export const JOB_CLAIMS = {
  school: ['learnerId', 'completionStatus'],
  college: ['learnerId', 'completionStatus'],
  university: ['learnerId', 'completionStatus', 'degreeLevel', 'fieldOfStudy', 'percentage'],
};

/**
 * Claims neither policy ever requests, named so the portals can PUBLISH the list
 * rather than hardcode it.
 *
 * The Agriculture page hardcoded its withheld list in the browser, which meant a
 * page could claim a privacy guarantee the request did not actually make. Here
 * the list is version-controlled beside the requests it is the complement of, is
 * served from /policy, and is asserted by a test against the registry schemas —
 * so if a future request started asking for one of these, the claim breaks
 * loudly instead of quietly becoming false.
 */
export const NEVER_REQUESTED = [
  'National ID',
  'name',
  'School Student ID',
  'College Student ID',
  'University Student ID',
  'date of birth',
  'address',
  'contact details',
  'subjects and individual marks',
  'transcripts',
  'college qualification and specialization',
  'completion and graduation years',
];

/** Vocabularies the registry schemas permit. Kept here so a claim outside them is malformed. */
const COMPLETION_STATUSES = ['COMPLETED', 'IN_PROGRESS', 'DISCONTINUED', 'FAILED'];
const DEGREE_LEVELS = ['BACHELOR', 'MASTER', 'DOCTORATE', 'INTEGRATED'];
const FIELDS_OF_STUDY = [
  'COMPUTER_SCIENCE', 'INFORMATION_TECHNOLOGY', 'SOFTWARE_ENGINEERING',
  'ELECTRONICS', 'MECHANICAL', 'CIVIL', 'COMMERCE', 'BIOTECHNOLOGY',
];

/** The fields both policies accept for a Computer Science Master's or a Software Engineer role. */
export const ACCEPTED_FIELDS = ['COMPUTER_SCIENCE', 'INFORMATION_TECHNOLOGY', 'SOFTWARE_ENGINEERING'];

/**
 * The two committed policies, as data rather than as code.
 *
 * Version-controlled thresholds are what let the portals publish what they
 * require and let a test assert the boundary, instead of a rule being an
 * implementation detail buried in a branch. The wording is here too, because
 * PRODUCT specifies it exactly and a paraphrase would be a product change.
 */
export const POLICIES = {
  masters: {
    id: 'masters',
    purpose: "Master's admission eligibility (Computer Science)",
    claims: MASTERS_CLAIMS,
    thresholds: { school: 60, college: 60, university: 70 },
    eligible: {
      headline: "ELIGIBLE FOR MASTER'S APPLICATION",
      detail: 'Application accepted for consideration. Await the admission list.',
    },
    // Stated so the constraint is enforceable rather than remembered: ranking and
    // the admission list depend on the whole applicant pool and are out of scope.
    mustNeverSay: ['ADMITTED', 'ADMISSION CONFIRMED', 'SEAT'],
  },
  job: {
    id: 'job',
    purpose: 'Software Engineer interview eligibility (round one)',
    claims: JOB_CLAIMS,
    // School and College need only be COMPLETED; their percentages are not job
    // thresholds and are not even requested.
    thresholds: { university: 60 },
    eligible: {
      headline: 'SELECTED FOR INTERVIEW — ROUND 1',
      detail: 'This is not an employment offer or a final selection.',
    },
    mustNeverSay: ['HIRED', 'JOB OFFER', 'APPOINTED', 'EMPLOYED'],
  },
};

function rejected(message) {
  return Object.assign(new Error(message), { code: 'CORRELATION_FAILED' });
}
function malformed(message) {
  return Object.assign(new Error(message), { code: 'MALFORMED_CLAIM' });
}

/**
 * The three credential requests for a policy, in the order a portal presents them.
 *
 * Each names the credential type it will accept and the role it must satisfy; the
 * generic verifier pins the trusted issuer per role, so a College diploma cannot
 * arrive in the University slot even though all three issuers are trusted
 * (REQUIREMENTS §3, §8).
 *
 * @param {{policy: string, schoolVct: string, collegeVct: string, universityVct: string}} config
 */
export function educationCredentialRequests({ policy, schoolVct, collegeVct, universityVct }) {
  const chosen = POLICIES[policy];
  if (!chosen) throw new Error(`unknown education policy ${policy}`);
  if (!schoolVct || !collegeVct || !universityVct) {
    throw new Error('schoolVct, collegeVct and universityVct are all required');
  }
  return [
    { id: SCHOOL_REQUEST_ID, vct: schoolVct, claims: chosen.claims.school, role: 'school' },
    { id: COLLEGE_REQUEST_ID, vct: collegeVct, claims: chosen.claims.college, role: 'college' },
    { id: UNIVERSITY_REQUEST_ID, vct: universityVct, claims: chosen.claims.university, role: 'university' },
  ];
}

/** Asserts a claim is one of a controlled vocabulary, or the credential is malformed. */
function vocabulary(value, allowed, label) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw malformed(`${label} is not one of ${allowed.join(', ')}`);
  }
  return value;
}

/**
 * Correlation across all three credentials.
 *
 * Only meaningful because the generic verifier has already proven all three are
 * bound to the same presenting holder; matching strings alone would be satisfied
 * by three credentials collected from three different people (REQUIREMENTS §8).
 */
function correlatedLearnerId({ school, college, university }) {
  const ids = [
    ['school', school.learnerId],
    ['college', college.learnerId],
    ['university', university.learnerId],
  ];
  for (const [role, id] of ids) {
    if (typeof id !== 'string' || id.length === 0) {
      throw malformed(`the ${role} credential carried no learnerId`);
    }
  }
  const distinct = [...new Set(ids.map(([, id]) => id))];
  if (distinct.length !== 1) {
    // Deliberately does not name the values: they identify a learner, and a
    // rejection reason is shown on a portal screen.
    throw rejected('the three credentials name different learners');
  }
  return distinct[0];
}

/**
 * Applies one policy to three verified credential claim sets.
 *
 * @param {{school: object, college: object, university: object}} claims
 * @param {string} policyId 'masters' or 'job'
 */
export function decideEducation({ school, college, university }, policyId) {
  const policy = POLICIES[policyId];
  if (!policy) throw new Error(`unknown education policy ${policyId}`);
  if (!school || !college || !university) {
    throw rejected('the presentation did not carry all three education credentials');
  }

  // 1. Correlation, before any business rule.
  const learnerId = correlatedLearnerId({ school, college, university });

  // 2. Completion. Every credential must be COMPLETED under both policies, so an
  //    unfinished qualification is a business answer with a stated reason rather
  //    than a silent failure.
  const completion = {
    school: vocabulary(school.completionStatus, COMPLETION_STATUSES, 'school completionStatus'),
    college: vocabulary(college.completionStatus, COMPLETION_STATUSES, 'college completionStatus'),
    university: vocabulary(university.completionStatus, COMPLETION_STATUSES, 'university completionStatus'),
  };
  for (const [role, status] of Object.entries(completion)) {
    if (status !== 'COMPLETED') {
      return {
        outcome: 'NOT_ELIGIBLE',
        reason: `the ${role} qualification is not completed (${status})`,
      };
    }
  }

  // 3. The degree itself. Both policies require a completed Bachelor's in an
  //    accepted field; the vocabularies deliberately contain values that fail,
  //    so both paths are exercised by real fixtures.
  const degreeLevel = vocabulary(university.degreeLevel, DEGREE_LEVELS, 'degreeLevel');
  if (degreeLevel !== 'BACHELOR') {
    return { outcome: 'NOT_ELIGIBLE', reason: `a bachelor's degree is required (this is ${degreeLevel})` };
  }
  const fieldOfStudy = vocabulary(university.fieldOfStudy, FIELDS_OF_STUDY, 'fieldOfStudy');
  if (!ACCEPTED_FIELDS.includes(fieldOfStudy)) {
    return { outcome: 'NOT_ELIGIBLE', reason: `${fieldOfStudy} is not an accepted field of study for this policy` };
  }

  // 4. Thresholds. Only the ones this policy declares, and only over claims it
  //    actually requested — the job policy never receives the School or College
  //    percentage, so it cannot accidentally gate on one.
  const verified = { school: {}, college: {}, university: {} };
  for (const [role, threshold] of Object.entries(policy.thresholds)) {
    const source = { school, college, university }[role];
    const label = `${role} percentage`;
    if (!meetsThreshold(source.percentage, threshold, label)) {
      return {
        outcome: 'NOT_ELIGIBLE',
        reason: `the ${role} percentage is below the ${threshold}% this policy requires`,
        // Echoed so a portal can show its working, exactly as the bank does.
        shortfall: { role, required: threshold, actual: formatPercentage(source.percentage) },
        // The thresholds already CLEARED before this one, so a portal can say
        // which single number fell short instead of implying none was checked.
        // Without this the admissions screen read "school — not reached" over a
        // 72% school result that had in fact passed — technically the loop's
        // state, but a false statement to the learner reading it.
        thresholds: policy.thresholds,
        verified,
      };
    }
    verified[role].percentage = formatPercentage(source.percentage);
    // Kept as hundredths too, so nothing downstream re-parses a decimal.
    verified[role].percentageHundredths = percentageToHundredths(source.percentage, label);
  }

  return {
    outcome: 'ELIGIBLE',
    policy: policy.id,
    purpose: policy.purpose,
    headline: policy.eligible.headline,
    detail: policy.eligible.detail,
    learnerId,
    degreeLevel,
    fieldOfStudy,
    thresholds: policy.thresholds,
    verified,
  };
}
