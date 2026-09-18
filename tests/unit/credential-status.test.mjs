// The status check, and specifically what it does when it cannot get an answer.
//
// The failure that matters is not "REVOKED was reported and we proceeded". It is a status
// that could not be retrieved being treated as satisfactory, which is how a check becomes
// decoration.

import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialStatusChecker } from '../../services/verifier/src/core/credential-status.mjs';

const BASE = 'http://authority.test:3334';
const ID = 'did:rcw:046a5fe1-32f2-4e43-8537-8d7177fc2269';

const authority = (reply) => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (typeof reply === 'function') return reply(url);
    return reply;
  };
  return { fetchImpl, calls };
};
const ok = (body) => ({ ok: true, status: 200, json: async () => body });

test('an ACTIVE credential passes, and the identifier is escaped into the path', async () => {
  const { fetchImpl, calls } = authority(ok({ credentialId: ID, status: 'ACTIVE', effectiveAt: '2026-09-18T10:21:58.323Z' }));
  const result = await credentialStatusChecker({ baseUrl: BASE, fetchImpl }).check(ID);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'ACTIVE');
  assert.equal(calls[0], `${BASE}/api/v1/trust/credentials/${encodeURIComponent(ID)}/status`);
  assert.ok(!calls[0].includes('did:rcw:'), 'the colon-bearing id must not sit raw in the path');
});

test('SUSPENDED, REVOKED and INACTIVE each stop the decision, and are named', async () => {
  for (const status of ['SUSPENDED', 'REVOKED', 'INACTIVE']) {
    const { fetchImpl } = authority(ok({ status }));
    const result = await credentialStatusChecker({ baseUrl: BASE, fetchImpl }).check(ID);
    assert.equal(result.ok, false, `${status} must not pass`);
    assert.equal(result.status, status);
    assert.match(result.reason, new RegExp(status));
  }
});

test('an unreachable Authority fails closed', async () => {
  // Indistinguishable from one that would have said REVOKED.
  const { fetchImpl } = authority(() => { throw new Error('connect ECONNREFUSED'); });
  const result = await credentialStatusChecker({ baseUrl: BASE, fetchImpl }).check(ID);
  assert.equal(result.ok, false);
  assert.match(result.reason, /could not reach the issuing Authority/);
});

test('a credential the Authority does not recognise fails closed', async () => {
  const { fetchImpl } = authority({ ok: false, status: 404, json: async () => ({}) });
  const result = await credentialStatusChecker({ baseUrl: BASE, fetchImpl }).check(ID);
  assert.equal(result.ok, false);
  assert.match(result.reason, /does not recognise/);
});

test('a server error fails closed rather than being read as absence', async () => {
  const { fetchImpl } = authority({ ok: false, status: 500, json: async () => ({}) });
  const result = await credentialStatusChecker({ baseUrl: BASE, fetchImpl }).check(ID);
  assert.equal(result.ok, false);
  assert.match(result.reason, /answered 500/);
});

test('an unreadable or statusless response fails closed', async () => {
  const unreadable = authority({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } });
  assert.equal((await credentialStatusChecker({ baseUrl: BASE, fetchImpl: unreadable.fetchImpl }).check(ID)).ok, false);
  const statusless = authority(ok({ credentialId: ID }));
  assert.equal((await credentialStatusChecker({ baseUrl: BASE, fetchImpl: statusless.fetchImpl }).check(ID)).ok, false);
});

test('a credential with no identifier is refused, not waved through', async () => {
  // The important one. "No id, so nothing to check, so fine" is how this check would become
  // decoration — a credential whose standing cannot be looked up has unknown standing.
  const { fetchImpl, calls } = authority(ok({ status: 'ACTIVE' }));
  const checker = credentialStatusChecker({ baseUrl: BASE, fetchImpl });
  for (const value of [undefined, null, '', 42, {}]) {
    const result = await checker.check(value);
    assert.equal(result.ok, false, `should refuse ${JSON.stringify(value)}`);
    assert.match(result.reason, /no identifier/);
  }
  assert.equal(calls.length, 0, 'nothing should have been requested');
});

test('no configured Authority is refused rather than skipped', async () => {
  const { fetchImpl } = authority(ok({ status: 'ACTIVE' }));
  const result = await credentialStatusChecker({ baseUrl: '', fetchImpl }).check(ID);
  assert.equal(result.ok, false);
  assert.match(result.reason, /no Authority Service configured/);
});
