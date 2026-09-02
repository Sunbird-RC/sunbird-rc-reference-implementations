/**
 * The seed script's fixture table must still say what the decision rules do.
 *
 * scripts/seed-education.sh labels every row with the outcome it is there to
 * produce ("fails the master's college 60% rule"). Those labels are what the demo
 * script, the recordings and the evidence table are built on — and nothing else
 * checks them. Change a threshold in POLICIES, or a percentage in the table, and
 * every label silently becomes a claim the code no longer honours.
 *
 * So this suite parses the table out of the shell script and runs the real
 * decision function over it. It is deliberately the file itself, not a copy: a
 * copied table would drift, which is the failure it exists to catch.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { decideEducation } from '../../services/verifier/src/domains/education/index.mjs';

const SEED = fileURLToPath(new URL('../../scripts/seed-education.sh', import.meta.url));

/** Parses the `fixtures()` heredoc — the same rows the script pipes into seed(). */
function fixtureRows() {
  const script = readFileSync(SEED, 'utf8');
  const table = script.match(/fixtures\(\) \{\n\s*cat <<'ROWS'\n([\s\S]*?)\nROWS\n/);
  assert.ok(table, 'could not find the fixtures() heredoc in seed-education.sh');
  return table[1]
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [nationalId, learnerId, sPct, sSt, cPct, cSt, uPct, uSt, degreeLevel, fieldOfStudy, label] =
        line.split('|');
      return {
        nationalId,
        learnerId,
        label,
        school: { learnerId, completionStatus: sSt, percentage: Number(sPct) },
        college: { learnerId, completionStatus: cSt, percentage: Number(cPct) },
        university: {
          learnerId,
          completionStatus: uSt,
          percentage: Number(uPct),
          degreeLevel,
          fieldOfStudy,
        },
      };
    });
}

/**
 * What each row is FOR, keyed by learner. Written out longhand rather than
 * derived from the label, because deriving the expectation from the same string
 * the test is checking would prove nothing.
 */
const EXPECTED = {
  'EDU-L-004512': { masters: 'ELIGIBLE', job: 'ELIGIBLE' },
  'EDU-L-006733': { masters: 'NOT_ELIGIBLE', job: 'ELIGIBLE', mastersReason: /university percentage is below the 70%/ },
  'EDU-L-007841': { masters: 'ELIGIBLE', job: 'ELIGIBLE' },
  'EDU-L-008120': { masters: 'NOT_ELIGIBLE', job: 'ELIGIBLE', mastersReason: /school percentage is below the 60%/ },
  'EDU-L-009002': { masters: 'NOT_ELIGIBLE', job: 'ELIGIBLE', mastersReason: /college percentage is below the 60%/ },
  'EDU-L-009315': {
    masters: 'NOT_ELIGIBLE',
    job: 'NOT_ELIGIBLE',
    jobReason: /university percentage is below the 60%/,
  },
  'EDU-L-010447': {
    masters: 'NOT_ELIGIBLE',
    job: 'NOT_ELIGIBLE',
    mastersReason: /university qualification is not completed \(IN_PROGRESS\)/,
    jobReason: /university qualification is not completed \(IN_PROGRESS\)/,
  },
  'EDU-L-011238': {
    masters: 'NOT_ELIGIBLE',
    job: 'NOT_ELIGIBLE',
    mastersReason: /MECHANICAL is not an accepted field of study/,
    jobReason: /MECHANICAL is not an accepted field of study/,
  },
};

/**
 * The job policy never receives the School or College percentage — it does not
 * request the claim. Presenting them here would let a job-rule bug that reads
 * them pass unnoticed, so they are removed, exactly as the wallet's disclosure
 * would remove them.
 */
function jobClaims(row) {
  const strip = ({ percentage, ...rest }) => rest;
  return { school: strip(row.school), college: strip(row.college), university: row.university };
}

describe('the Education fixture table still produces the outcomes it claims', () => {
  const rows = fixtureRows();

  it('has a row for every learner the expectations name, and vice versa', () => {
    assert.deepEqual(
      rows.map((r) => r.learnerId).sort(),
      Object.keys(EXPECTED).sort(),
      'seed-education.sh and this test disagree about which fixtures exist',
    );
  });

  it('gives every fixture a distinct learner and National ID', () => {
    assert.equal(new Set(rows.map((r) => r.learnerId)).size, rows.length);
    assert.equal(new Set(rows.map((r) => r.nationalId)).size, rows.length);
  });

  for (const row of rows) {
    const want = EXPECTED[row.learnerId];
    if (!want) continue; // the row/expectation mismatch is reported by its own test

    it(`${row.learnerId} — ${row.label}`, () => {
      const masters = decideEducation(row, 'masters');
      assert.equal(masters.outcome, want.masters, `master's outcome for ${row.learnerId}`);
      if (want.mastersReason) assert.match(masters.reason, want.mastersReason);

      const job = decideEducation(jobClaims(row), 'job');
      assert.equal(job.outcome, want.job, `job outcome for ${row.learnerId}`);
      if (want.jobReason) assert.match(job.reason, want.jobReason);
    });
  }

  it('covers both answers for one learner, which is the point of the iteration', () => {
    const both = rows.filter(
      (r) => EXPECTED[r.learnerId].masters === 'NOT_ELIGIBLE' && EXPECTED[r.learnerId].job === 'ELIGIBLE',
    );
    assert.ok(both.length > 0, 'no fixture shows one learner getting two different answers');
  });

  it('puts at least one fixture exactly on every threshold', () => {
    const onBoundary = rows.find(
      (r) => r.school.percentage === 60 && r.college.percentage === 60 && r.university.percentage === 70,
    );
    assert.ok(onBoundary, 'no fixture sits on the 60/60/70 boundary');
    assert.equal(decideEducation(onBoundary, 'masters').outcome, 'ELIGIBLE', 'the boundary must be inclusive');
  });
});
