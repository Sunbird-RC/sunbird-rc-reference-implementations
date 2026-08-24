// The Age business rule. Small on purpose — it is the only Age-specific logic in
// the verifier, and it must never be the thing that decides whether a
// presentation was genuine.

import test from 'node:test';
import assert from 'node:assert/strict';
import { decideAge, ageCredentialRequest, AGE_CLAIM } from '../../services/verifier/src/domains/age/index.mjs';

test('APPROVED only for a boolean true', () => {
  assert.deepEqual(decideAge({ ageOver18: true }).decision, 'APPROVED');
});

test('DENIED for a boolean false — a verified answer, not a failure', () => {
  const outcome = decideAge({ ageOver18: false });
  assert.equal(outcome.decision, 'DENIED');
  assert.match(outcome.reason, /not over 18/);
});

test('a non-boolean assertion is refused, not silently approved', () => {
  // "false" is a truthy string in JavaScript. An age gate that approves on it is
  // exactly the class of bug this iteration has to prove absent.
  for (const value of ['true', 'false', 1, 0, null, undefined, {}, []]) {
    assert.throws(() => decideAge({ ageOver18: value }), /not a boolean/, `should refuse ${JSON.stringify(value)}`);
  }
});

test('an empty claim set is refused', () => {
  assert.throws(() => decideAge({}), /not a boolean/);
  assert.throws(() => decideAge(undefined), /not a boolean/);
});

test('the credential request asks for one claim and pins the credential type', () => {
  const request = ageCredentialRequest({ vct: 'http://localhost/vct/age-verification-credential' });
  assert.deepEqual(request.claims, [AGE_CLAIM]);
  assert.equal(request.claims.length, 1, 'minimum disclosure means exactly one domain claim');
  assert.equal(request.vct, 'http://localhost/vct/age-verification-credential');
});
