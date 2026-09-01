// The two Education policies over one set of three credentials.
//
// The claim this iteration makes is that the SAME three credentials serve two
// different verified decisions with two different rules and two different
// disclosure policies. These tests are where that is proven cheaply, before any
// protocol work: one learner, two answers.
//
// The distinctions asserted throughout, because PRODUCT is explicit about them:
//
//   * a verification problem (correlation, malformed claim) is REJECTED, never
//     NOT ELIGIBLE;
//   * eligibility is not the outcome — "eligible for a Master's application" is
//     not admission, and "selected for interview round one" is not employment.

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideEducation,
  educationCredentialRequests,
  POLICIES,
  MASTERS_CLAIMS,
  JOB_CLAIMS,
  ACCEPTED_FIELDS,
  SCHOOL_REQUEST_ID,
  COLLEGE_REQUEST_ID,
  UNIVERSITY_REQUEST_ID,
} from '../../services/verifier/src/domains/education/index.mjs';

const LEARNER = 'EDU-L-004512';

/** A learner who satisfies both policies. Overrides are shallow, per credential. */
function learner(overrides = {}) {
  return {
    school: { learnerId: LEARNER, completionStatus: 'COMPLETED', percentage: 78.5, ...(overrides.school || {}) },
    college: { learnerId: LEARNER, completionStatus: 'COMPLETED', percentage: 71.2, ...(overrides.college || {}) },
    university: {
      learnerId: LEARNER,
      completionStatus: 'COMPLETED',
      degreeLevel: 'BACHELOR',
      fieldOfStudy: 'COMPUTER_SCIENCE',
      percentage: 74,
      ...(overrides.university || {}),
    },
  };
}

describe('what each portal asks for', () => {
  test('every credential discloses learnerId, because correlation needs all three to say it', () => {
    for (const claims of [MASTERS_CLAIMS, JOB_CLAIMS]) {
      for (const role of ['school', 'college', 'university']) {
        assert.ok(claims[role].includes('learnerId'), `${role} must disclose learnerId`);
      }
    }
  });

  test('the job portal asks for LESS than the Master\'s portal', () => {
    // The clearest evidence in the iteration that disclosure follows purpose
    // rather than convenience: the job rule does not use the School or College
    // percentage, so it does not ask for it.
    assert.ok(MASTERS_CLAIMS.school.includes('percentage'));
    assert.ok(MASTERS_CLAIMS.college.includes('percentage'));
    assert.equal(JOB_CLAIMS.school.includes('percentage'), false);
    assert.equal(JOB_CLAIMS.college.includes('percentage'), false);
    // Both need the university percentage — at different thresholds.
    assert.ok(JOB_CLAIMS.university.includes('percentage'));
  });

  test('neither portal asks for anything REQUIREMENTS §7 forbids', () => {
    const forbidden = [
      'nationalId', 'schoolStudentId', 'collegeStudentId', 'universityStudentId',
      'name', 'address', 'dateOfBirth', 'contact', 'transcript', 'subjects', 'marks',
      'specialization', 'completionYear', 'graduationYear', 'qualification',
    ];
    for (const [name, claims] of [['masters', MASTERS_CLAIMS], ['job', JOB_CLAIMS]]) {
      const asked = [...claims.school, ...claims.college, ...claims.university];
      for (const bad of forbidden) {
        assert.equal(asked.includes(bad), false, `${name} must not request ${bad}`);
      }
    }
  });

  test('each request pins a credential type to a role', () => {
    const requests = educationCredentialRequests({
      policy: 'masters', schoolVct: 'v-s', collegeVct: 'v-c', universityVct: 'v-u',
    });
    assert.deepEqual(requests.map((r) => r.id), [SCHOOL_REQUEST_ID, COLLEGE_REQUEST_ID, UNIVERSITY_REQUEST_ID]);
    assert.deepEqual(requests.map((r) => r.role), ['school', 'college', 'university']);
    assert.deepEqual(requests.map((r) => r.vct), ['v-s', 'v-c', 'v-u']);
  });

  test('a request for an unknown policy is refused at construction', () => {
    assert.throws(() => educationCredentialRequests({ policy: 'phd', schoolVct: 'a', collegeVct: 'b', universityVct: 'c' }),
      /unknown education policy/);
  });
});

describe("the Master's policy", () => {
  test('a qualifying learner is eligible, with the exact product wording', () => {
    const result = decideEducation(learner(), 'masters');
    assert.equal(result.outcome, 'ELIGIBLE');
    assert.equal(result.headline, "ELIGIBLE FOR MASTER'S APPLICATION");
    assert.match(result.detail, /accepted for consideration/);
    assert.match(result.detail, /admission list/);
    assert.equal(result.learnerId, LEARNER);
  });

  test('it never says ADMITTED, in any field', () => {
    // PRODUCT: "The demo must never display ADMITTED."
    const result = decideEducation(learner(), 'masters');
    const serialised = JSON.stringify(result).toUpperCase();
    for (const forbidden of POLICIES.masters.mustNeverSay) {
      assert.equal(serialised.includes(forbidden), false, `must never say ${forbidden}`);
    }
  });

  test('it requires 70% at university, and 60% at school and college', () => {
    assert.deepEqual(POLICIES.masters.thresholds, { school: 60, college: 60, university: 70 });
  });

  test('the university boundary is exact', () => {
    assert.equal(decideEducation(learner({ university: { percentage: 70 } }), 'masters').outcome, 'ELIGIBLE');
    const below = decideEducation(learner({ university: { percentage: 69.99 } }), 'masters');
    assert.equal(below.outcome, 'NOT_ELIGIBLE');
    assert.match(below.reason, /university percentage is below the 70%/);
    assert.deepEqual(below.shortfall, { role: 'university', required: 70, actual: '69.99%' });
  });

  test('the school and college boundaries are exact', () => {
    assert.equal(decideEducation(learner({ school: { percentage: 60 } }), 'masters').outcome, 'ELIGIBLE');
    assert.equal(decideEducation(learner({ college: { percentage: 60 } }), 'masters').outcome, 'ELIGIBLE');
    assert.match(decideEducation(learner({ school: { percentage: 59.99 } }), 'masters').reason, /school percentage is below the 60%/);
    assert.match(decideEducation(learner({ college: { percentage: 59.99 } }), 'masters').reason, /college percentage is below the 60%/);
  });
});

describe('the job policy', () => {
  test('a qualifying candidate is selected for round one, with the exact wording', () => {
    const result = decideEducation(learner(), 'job');
    assert.equal(result.outcome, 'ELIGIBLE');
    assert.equal(result.headline, 'SELECTED FOR INTERVIEW — ROUND 1');
    assert.match(result.detail, /not an employment offer/);
  });

  test('it never implies employment, in any field', () => {
    const serialised = JSON.stringify(decideEducation(learner(), 'job')).toUpperCase();
    for (const forbidden of POLICIES.job.mustNeverSay) {
      assert.equal(serialised.includes(forbidden), false, `must never say ${forbidden}`);
    }
  });

  test('it gates on the university percentage at 60, and on nothing else numeric', () => {
    assert.deepEqual(POLICIES.job.thresholds, { university: 60 });
    assert.equal(decideEducation(learner({ university: { percentage: 60 } }), 'job').outcome, 'ELIGIBLE');
    assert.match(decideEducation(learner({ university: { percentage: 59.99 } }), 'job').reason, /below the 60%/);
  });

  test('it cannot gate on a school or college percentage it never received', () => {
    // The job portal does not request those claims, so they are absent from the
    // verified set. A rule that reached for them would throw or, worse, treat
    // undefined as failing.
    const claims = learner();
    delete claims.school.percentage;
    delete claims.college.percentage;
    const result = decideEducation(claims, 'job');
    assert.equal(result.outcome, 'ELIGIBLE');
  });
});

describe('one learner, two answers — the point of the iteration', () => {
  test('a 65% degree is enough for the interview and not for the Master\'s', () => {
    const claims = learner({ university: { percentage: 65 } });
    const job = decideEducation(claims, 'job');
    const masters = decideEducation(claims, 'masters');
    assert.equal(job.outcome, 'ELIGIBLE');
    assert.equal(masters.outcome, 'NOT_ELIGIBLE');
    assert.match(masters.reason, /below the 70%/);
  });

  test('a low school percentage stops the Master\'s and not the interview', () => {
    const claims = learner({ school: { percentage: 55 } });
    assert.equal(decideEducation(claims, 'job').outcome, 'ELIGIBLE');
    assert.equal(decideEducation(claims, 'masters').outcome, 'NOT_ELIGIBLE');
  });
});

describe('rules both policies share', () => {
  test('an unfinished qualification is NOT ELIGIBLE, with the role named', () => {
    for (const role of ['school', 'college', 'university']) {
      for (const policy of ['masters', 'job']) {
        const result = decideEducation(learner({ [role]: { completionStatus: 'IN_PROGRESS' } }), policy);
        assert.equal(result.outcome, 'NOT_ELIGIBLE');
        assert.match(result.reason, new RegExp(`${role} qualification is not completed`));
        assert.match(result.reason, /IN_PROGRESS/);
      }
    }
  });

  test('a degree that is not a bachelor\'s is NOT ELIGIBLE', () => {
    for (const level of ['MASTER', 'DOCTORATE', 'INTEGRATED']) {
      const result = decideEducation(learner({ university: { degreeLevel: level } }), 'masters');
      assert.equal(result.outcome, 'NOT_ELIGIBLE');
      assert.match(result.reason, /bachelor/i);
    }
  });

  test('an unsupported field of study is NOT ELIGIBLE', () => {
    for (const field of ['MECHANICAL', 'CIVIL', 'COMMERCE', 'BIOTECHNOLOGY', 'ELECTRONICS']) {
      const result = decideEducation(learner({ university: { fieldOfStudy: field } }), 'job');
      assert.equal(result.outcome, 'NOT_ELIGIBLE');
      assert.match(result.reason, new RegExp(field));
    }
  });

  test('every accepted field is actually accepted', () => {
    for (const field of ACCEPTED_FIELDS) {
      assert.equal(decideEducation(learner({ university: { fieldOfStudy: field } }), 'masters').outcome, 'ELIGIBLE');
    }
  });
});

describe('verification failures are not business answers', () => {
  test('three credentials naming different learners are REJECTED', () => {
    const claims = learner({ college: { learnerId: 'EDU-L-009999' } });
    assert.throws(() => decideEducation(claims, 'masters'), (err) => err.code === 'CORRELATION_FAILED');
  });

  test('the rejection reason does not name the learner ids', () => {
    // It is shown on a portal screen, and the values identify a person.
    try {
      decideEducation(learner({ university: { learnerId: 'EDU-L-000001' } }), 'job');
      assert.fail('should have thrown');
    } catch (err) {
      assert.equal(err.code, 'CORRELATION_FAILED');
      assert.equal(err.message.includes('EDU-L-'), false);
    }
  });

  test('correlation is checked BEFORE any business rule', () => {
    // A learner who is both mismatched and ineligible must be rejected, not
    // reported ineligible — otherwise a forged pairing hides behind a business no.
    const claims = learner({
      college: { learnerId: 'EDU-L-009999' },
      university: { percentage: 10, completionStatus: 'FAILED' },
    });
    assert.throws(() => decideEducation(claims, 'masters'), (err) => err.code === 'CORRELATION_FAILED');
  });

  test('a missing credential is REJECTED, not treated as a failed rule', () => {
    for (const role of ['school', 'college', 'university']) {
      const claims = learner();
      delete claims[role];
      assert.throws(() => decideEducation(claims, 'masters'), (err) => err.code === 'CORRELATION_FAILED');
    }
  });

  test('a claim outside its controlled vocabulary is MALFORMED', () => {
    const cases = [
      { university: { degreeLevel: 'HONORARY' } },
      { university: { fieldOfStudy: 'ASTROLOGY' } },
      { school: { completionStatus: 'MAYBE' } },
      { university: { completionStatus: true } },
    ];
    for (const override of cases) {
      assert.throws(() => decideEducation(learner(override), 'masters'), (err) => err.code === 'MALFORMED_CLAIM');
    }
  });

  test('a malformed percentage is MALFORMED, not a failed threshold', () => {
    for (const value of ['74', 74.001, null, 101]) {
      assert.throws(() => decideEducation(learner({ university: { percentage: value } }), 'masters'),
        (err) => err.code === 'MALFORMED_CLAIM', `${JSON.stringify(value)} must be malformed`);
    }
  });

  test('a missing learnerId is MALFORMED, with the role named', () => {
    assert.throws(() => decideEducation(learner({ school: { learnerId: '' } }), 'job'),
      (err) => err.code === 'MALFORMED_CLAIM' && /school credential carried no learnerId/.test(err.message));
  });

  test('an unknown policy is a programming error, not a decision', () => {
    assert.throws(() => decideEducation(learner(), 'phd'), /unknown education policy/);
  });
});


describe('a threshold failure reports the thresholds it already cleared', () => {
  // The failure branch used to return only `shortfall`, so the admissions screen
  // printed "school — not reached" over a 72% school result that had in fact
  // passed. Technically it was reporting the loop's state; to the learner reading
  // it, it was false. Asserted here because it is a claim on a screen, and the
  // only thing that made it visible was looking at the screen.
  const claims = {
    school: { learnerId: 'EDU-L-000001', completionStatus: 'COMPLETED', percentage: 72 },
    college: { learnerId: 'EDU-L-000001', completionStatus: 'COMPLETED', percentage: 68.4 },
    university: {
      learnerId: 'EDU-L-000001',
      completionStatus: 'COMPLETED',
      degreeLevel: 'BACHELOR',
      fieldOfStudy: 'COMPUTER_SCIENCE',
      percentage: 65,
    },
  };

  test('names the one that fell short and the ones that did not', () => {
    const result = decideEducation(claims, 'masters');
    assert.equal(result.outcome, 'NOT_ELIGIBLE');
    assert.deepEqual(result.shortfall, { role: 'university', required: 70, actual: '65%' });
    assert.equal(result.verified.school.percentage, '72%');
    assert.equal(result.verified.college.percentage, '68.4%');
    // The failing role carries no verified percentage: it did not pass, and
    // presenting it beside the two that did would blur exactly the distinction
    // this return exists to make.
    assert.equal(result.verified.university.percentage, undefined);
    assert.deepEqual(result.thresholds, { school: 60, college: 60, university: 70 });
  });

  test('reports nothing verified when the failure comes before any threshold', () => {
    // An unfinished qualification or an unaccepted field fails BEFORE the
    // threshold loop, so there is genuinely nothing cleared to report — and a
    // portal showing '72% — met' there would be inventing a comparison the
    // decision never made.
    const notCompleted = {
      ...claims,
      university: { ...claims.university, completionStatus: 'IN_PROGRESS' },
    };
    const result = decideEducation(notCompleted, 'masters');
    assert.equal(result.outcome, 'NOT_ELIGIBLE');
    assert.equal(result.verified, undefined);
    assert.equal(result.shortfall, undefined);
  });
});
