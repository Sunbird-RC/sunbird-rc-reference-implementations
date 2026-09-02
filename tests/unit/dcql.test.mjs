// The presentation request. Two properties matter more than the rest: it asks
// for the minimum, and it does not constrain the answer.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDcqlQuery,
  expectedClaimNames,
  ISSUER_CLAIM,
  SD_JWT_DCQL_FORMAT,
} from '../../services/verifier/src/core/dcql.mjs';

const VCT = 'http://localhost/vct/age-verification-credential';
const ageRequest = { id: 'age_cred', vct: VCT, claims: ['ageOver18'] };

test('requests exactly the domain claim plus the issuer identifier', () => {
  const query = buildDcqlQuery([ageRequest]);
  const paths = query.credentials[0].claims.map((c) => c.path.join('.'));
  assert.deepEqual(paths.sort(), ['ageOver18', 'iss']);
  // Nothing else. Date of birth and name exist in the credential and must not
  // appear here.
  assert.equal(paths.length, 2);
});

test('uses the DCQL spelling of the SD-JWT format, not the OID4VCI one', () => {
  // DCQL says dc+sd-jwt; the issuance format is vc+sd-jwt. Credo-based wallets
  // are strict about the DCQL one.
  assert.equal(buildDcqlQuery([ageRequest]).credentials[0].format, 'dc+sd-jwt');
  assert.equal(SD_JWT_DCQL_FORMAT, 'dc+sd-jwt');
});

test('pins the credential type through meta.vct_values', () => {
  // Mandatory for SD-JWT DCQL — without `meta` the query fails validation with
  // 'Invalid key: Expected "meta"'. It also stops an unrelated credential from
  // satisfying the query.
  assert.deepEqual(buildDcqlQuery([ageRequest]).credentials[0].meta, { vct_values: [VCT] });
});

test('does NOT constrain the value of the age claim', () => {
  // A `values: [true]` constraint would turn a legitimate minor into a
  // VERIFICATION FAILURE rather than a verified DENIED — a different, and
  // wrong, answer to the question the verifier asked.
  for (const claim of buildDcqlQuery([ageRequest]).credentials[0].claims) {
    assert.equal('values' in claim, false, `${claim.path.join('.')} must not be value-constrained`);
  }
});

test('refuses a request that would disclose everything', () => {
  // An entry with no `claims` means "disclose all claims" in oid4vc-service's
  // evaluator. For a data-minimisation showcase that is the one mistake that
  // must not be possible to make by omission.
  assert.throws(() => buildDcqlQuery([{ id: 'x', vct: VCT, claims: [] }]), /must name the claims/);
  assert.throws(() => buildDcqlQuery([{ id: 'x', vct: VCT }]), /must name the claims/);
});

test('refuses a request with no credential type', () => {
  assert.throws(() => buildDcqlQuery([{ id: 'x', claims: ['ageOver18'] }]), /no vct/);
});

test('refuses an empty query', () => {
  assert.throws(() => buildDcqlQuery([]), /at least one credential request/);
});

test('supports several credentials in one request, for later iterations', () => {
  const query = buildDcqlQuery([
    ageRequest,
    { id: 'land_cred', vct: 'http://localhost/vct/land', claims: ['landAreaAcres'] },
  ]);
  assert.equal(query.credentials.length, 2);
  assert.deepEqual(query.credentials.map((c) => c.id), ['age_cred', 'land_cred']);
});

test('expectedClaimNames matches what the query asks for', () => {
  assert.deepEqual(expectedClaimNames(ageRequest), ['ageOver18', ISSUER_CLAIM].sort());
});

// The request purpose. A wallet cannot show the holder why their data is wanted
// unless the request says so, and OpenID4VP 1.0 puts that string on the
// credential set. Both earlier iterations shipped with the wallet's "no
// information was provided on the purpose of the data request" notice.

const PURPOSE = "Master's admission eligibility (Computer Science)";

test('carries the purpose where the wallet reads it', () => {
  const query = buildDcqlQuery([ageRequest], { purpose: PURPOSE });
  assert.equal(query.credential_sets.length, 1);
  assert.equal(query.credential_sets[0].purpose, PURPOSE);
});

test('one set, required, listing every credential the request asks for', () => {
  // Not one set per credential and not one option per credential: either would
  // make a three-credential request satisfiable by fewer than three, which is a
  // change to what the verifier asked for and not a change to how it explains
  // itself.
  const query = buildDcqlQuery(
    [
      { id: 'school_cred', vct: 'http://localhost/vct/school', claims: ['percentage'] },
      { id: 'college_cred', vct: 'http://localhost/vct/college', claims: ['percentage'] },
      { id: 'university_cred', vct: 'http://localhost/vct/university', claims: ['percentage'] },
    ],
    { purpose: PURPOSE },
  );
  assert.equal(query.credential_sets.length, 1);
  assert.equal(query.credential_sets[0].required, true);
  assert.deepEqual(query.credential_sets[0].options, [
    ['school_cred', 'college_cred', 'university_cred'],
  ]);
});

test('omits the credential set entirely when no purpose is given', () => {
  // Age and Agriculture pass no purpose, so their requests are byte-identical to
  // the accepted ones. An empty or absent set is not the same as a set with no
  // purpose: the second is a query the wallet would read and find nothing in.
  const query = buildDcqlQuery([ageRequest]);
  assert.equal('credential_sets' in query, false);
});

test('refuses a purpose that would display as nothing', () => {
  assert.throws(() => buildDcqlQuery([ageRequest], { purpose: '' }), /non-empty string/);
  assert.throws(() => buildDcqlQuery([ageRequest], { purpose: '   ' }), /non-empty string/);
  assert.throws(() => buildDcqlQuery([ageRequest], { purpose: 42 }), /non-empty string/);
});

test('the purpose does not disturb the claims the query asks for', () => {
  const withPurpose = buildDcqlQuery([ageRequest], { purpose: PURPOSE });
  const without = buildDcqlQuery([ageRequest]);
  assert.deepEqual(withPurpose.credentials, without.credentials);
});
