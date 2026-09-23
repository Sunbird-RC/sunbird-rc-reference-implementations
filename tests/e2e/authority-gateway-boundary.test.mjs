import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { deployEnv } from './lib/stack.mjs';
import { authorityHeaders } from './lib/authority-auth.mjs';

/**
 * What the Authority Service exposes through the PUBLIC gateway, and what it does not.
 *
 * The trust routes have to be reachable without authentication: a verifier holding a
 * credential has no tenant and no membership, so "who is this issuer" and "is this
 * credential still good" cannot require a token. Publishing them means putting a route to
 * the Authority Service into an internet-facing listener, and the risk of that is not the
 * two routes — it is the third one nobody meant to publish.
 *
 * So this file asserts BOTH halves. The trust routes answer, and the administrative API
 * does not exist through the same listener. A single `location /api/v1/` in the gateway
 * would satisfy the first half and quietly destroy the second, and nothing else in the
 * suite would notice.
 */

const { base, opsBase } = deployEnv();

/** The public origin. Everything here goes through the gateway, never to port 3334. */
const PUBLIC = base;
/** Loopback only. Used to discover real ids, and to show the contrast. */
const AUTHORITY = process.env.AUTHORITY_URL || 'http://127.0.0.1:3334';

let issuerId = null;
let credentialId = null;
let reachable = false;

async function json(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

before(async () => {
  try {
    const admin = await authorityHeaders('BOOTSTRAP', { authorityBase: AUTHORITY, opsBase });
    const authorities = await json(`${AUTHORITY}/api/v1/authorities`, { headers: admin });
    const list = Array.isArray(authorities) ? authorities : authorities?.items || [];
    for (const a of list) {
      const issuers = await json(`${AUTHORITY}/api/v1/authorities/${a.id}/issuers`, {
        headers: admin,
      });
      const rows = Array.isArray(issuers) ? issuers : issuers?.items || [];
      const withDid = rows.find((i) => i.did);
      if (withDid) {
        issuerId = withDid.id;
        break;
      }
    }
    reachable = Boolean(issuerId);
  } catch {
    reachable = false;
  }
});

const unless = (t) => {
  if (!reachable) {
    t.skip('the Authority Service has no configured issuer on this deployment');
    return true;
  }
  return false;
};

describe('the Authority Service through the public gateway', () => {
  test('publishes issuer trust metadata, unauthenticated', async (t) => {
    if (unless(t)) return;
    const response = await fetch(`${PUBLIC}/trust/issuers/${issuerId}`);
    assert.equal(response.status, 200, 'the issuer trust route must answer through the gateway');

    const body = await response.json();
    assert.ok(body.issuer?.startsWith('did:'), 'it returns the issuer DID');

    // Anand's disclosure rule, checked against the actual payload rather than against the
    // intent of the code that produced it.
    //
    // The issuer DID and its verification method ids are EXCLUDED from the scan, and must
    // be: a did:web necessarily spells the deployment's public host into itself, so on a
    // localhost deployment the DID legitimately contains "localhost". Forbidding the
    // public host would forbid the one thing this route exists to return. What must not
    // appear is an INTERNAL location — a container name, a database, a key store.
    const scanned = JSON.stringify(body)
      .split(body.issuer)
      .join('')
      .toLowerCase();
    for (const forbidden of [
      'tenant',
      'authorityid',
      'registrybinding',
      'profile',
      'osid',
      'kms',
      'vault',
      'authority-service',
      ':3334',
      'postgres',
      '.internal',
      '.svc',
    ]) {
      assert.ok(!scanned.includes(forbidden), `public trust metadata must not mention "${forbidden}"`);
    }

    // And the positive form of the same property: the DID is under the deployment's own
    // public host, so it is resolvable by whoever just received it.
    const host = new URL(PUBLIC).hostname;
    assert.ok(
      body.issuer.startsWith(`did:web:${host}`),
      `the issuer DID should be under ${host}, got ${body.issuer}`,
    );
  });

  test('answers credential status, unauthenticated, with three fields and no more', async (t) => {
    if (unless(t)) return;
    // Any id is enough for the shape: a credential this Authority did not issue gets the
    // same answer as one it did, which is itself the point — the route is not an oracle
    // for which credentials exist.
    const probe = credentialId || 'did:rcw:00000000-0000-0000-0000-000000000000';
    const response = await fetch(
      `${PUBLIC}/trust/credentials/${encodeURIComponent(probe)}/status`,
    );
    assert.ok(
      [200, 404].includes(response.status),
      `the status route must be routed, got ${response.status}`,
    );
    if (response.status === 200) {
      const body = await response.json();
      assert.deepEqual(
        Object.keys(body).sort(),
        ['credentialId', 'effectiveAt', 'status'],
        'the status response carries exactly these three fields',
      );
    }
  });

  test('does not expose the administrative API on the same listener', async (t) => {
    if (unless(t)) return;
    // Every one of these answers on 127.0.0.1:3334 with a valid principal. None may be
    // routed from the internet, with or without one.
    const administrative = [
      '/api/v1/tenants',
      '/api/v1/authorities',
      '/api/v1/credential-profiles',
      '/api/v1/configuration-history',
      '/api/v1/record-history',
      `/api/v1/authorities/${issuerId}/issuers`,
      `/api/v1/issuers/${issuerId}`,
      `/api/v1/issuers/${issuerId}/keys`,
    ];
    for (const path of administrative) {
      const response = await fetch(`${PUBLIC}${path}`);
      assert.ok(
        response.status === 404 || response.status === 403,
        `${path} must not be served by the public gateway (got ${response.status})`,
      );
      const body = await response.text();
      assert.ok(
        !body.includes('"code"') || !body.includes('UNAUTHORIZED'),
        `${path} must not reach the Authority Service at all — a 401 from it means it did`,
      );
    }
  });

  test('does not expose issuance or revocation', async (t) => {
    if (unless(t)) return;
    // The routes that MINT and KILL credentials. A 401 here would still be a failure: it
    // would mean the gateway forwarded the request and only the service refused it.
    const dangerous = [
      ['POST', `/api/v1/credential-profiles/${issuerId}/issue`],
      ['POST', '/api/v1/credentials/did%3Arcw%3Aabc/revoke'],
      ['GET', '/api/v1/credentials/did%3Arcw%3Aabc'],
      ['GET', '/api/v1/credentials/did%3Arcw%3Aabc/record'],
    ];
    for (const [method, path] of dangerous) {
      const response = await fetch(`${PUBLIC}${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'POST' ? '{}' : undefined,
      });
      assert.ok(
        response.status === 404 || response.status === 403 || response.status === 405,
        `${method} ${path} must not be routed publicly (got ${response.status})`,
      );
    }
  });

  test('the trust prefix cannot be walked into the administrative API', async (t) => {
    if (unless(t)) return;
    // The location is a single anchored regex for exactly two shapes. These are the
    // attempts that would defeat a prefix match.
    const traversals = [
      `/trust/issuers/${issuerId}/../../api/v1/tenants`,
      `/trust/issuers/${issuerId}/keys`,
      '/trust/tenants',
      '/trust/credentials/x/status/../../../../api/v1/tenants',
      '/trust/../api/v1/tenants',
      `/trust/issuers/${issuerId}%2F..%2F..%2Fapi%2Fv1%2Ftenants`,
    ];
    for (const path of traversals) {
      const response = await fetch(`${PUBLIC}${path}`);
      assert.ok(
        response.status === 404 || response.status === 403 || response.status === 301,
        `${path} must not reach anything (got ${response.status})`,
      );
      const body = await response.text().catch(() => '');
      assert.ok(
        !body.includes('"items"') && !body.includes('"code":"T-'),
        `${path} returned what looks like administrative data`,
      );
    }
  });

  test('the trust routes are read-only', async (t) => {
    if (unless(t)) return;
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await fetch(`${PUBLIC}/trust/issuers/${issuerId}`, { method });
      assert.ok(
        response.status >= 400,
        `${method} on a trust route must be refused (got ${response.status})`,
      );
    }
  });
});
