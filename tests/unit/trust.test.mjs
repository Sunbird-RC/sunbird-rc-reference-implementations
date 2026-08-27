// The issuer allowlist. This is the check Sunbird RC v2.1.0 does not perform:
// its verifier proves a signature is valid, never that the signer is one we
// accept. Without this, any issuer minting the same vct would be believed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadTrustPolicy } from '../../services/verifier/src/core/trust.mjs';

const TRUSTED = 'did:web:localhost:11111111-1111-1111-1111-111111111111';
const UNLISTED = 'did:web:localhost:22222222-2222-2222-2222-222222222222';

function policyFile(contents) {
  const dir = mkdtempSync(join(tmpdir(), 'trust-'));
  const file = join(dir, 'issuers.json');
  writeFileSync(file, JSON.stringify(contents));
  return file;
}

const validPolicy = {
  issuers: [{ name: 'National Identity Authority', did: '${AGE_ISSUER_DID}', credentials: ['Age Verification Credential'] }],
};

test('an allowlisted issuer is accepted, and named', () => {
  const trust = loadTrustPolicy({ file: policyFile(validPolicy), env: { AGE_ISSUER_DID: TRUSTED } });
  const result = trust.check(TRUSTED);
  assert.equal(result.ok, true);
  assert.equal(result.issuer.name, 'National Identity Authority');
});

test('a valid credential from an unlisted issuer is rejected', () => {
  const trust = loadTrustPolicy({ file: policyFile(validPolicy), env: { AGE_ISSUER_DID: TRUSTED } });
  const result = trust.check(UNLISTED);
  assert.equal(result.ok, false);
  assert.match(result.reason, /not in the demo trust allowlist/);
});

test('a missing or non-string issuer identifier is rejected, never treated as absent-therefore-fine', () => {
  const trust = loadTrustPolicy({ file: policyFile(validPolicy), env: { AGE_ISSUER_DID: TRUSTED } });
  for (const value of [undefined, null, '', 42, {}]) {
    const result = trust.check(value);
    assert.equal(result.ok, false, `should reject ${JSON.stringify(value)}`);
  }
});

test('an unresolved ${VAR} is a startup failure, not an empty allowlist entry', () => {
  // Treating it as empty would allowlist "the issuer whose DID is the empty
  // string" and make the negative tests pass for the wrong reason.
  assert.throws(
    () => loadTrustPolicy({ file: policyFile(validPolicy), env: {} }),
    /AGE_ISSUER_DID, which is not set/,
  );
});

test('a policy that allowlists nobody is a startup failure', () => {
  assert.throws(() => loadTrustPolicy({ file: policyFile({ issuers: [] }), env: {} }), /allowlists no issuers/);
});
