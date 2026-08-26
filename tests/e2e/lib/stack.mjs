// Helpers for driving the running stack: read the deployment's configuration,
// ask the issuer counter for an offer, and drive a verifier session.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/**
 * Where the stack under test is, and who its issuers are.
 *
 * Reads deploy/.env by default, but every value can be overridden from the
 * environment — which is what makes it possible to drive a REMOTE deployment
 * from a developer machine without a checkout or Node on that host:
 *
 *   PUBLIC_URL=http://host AGE_ISSUER_DID=did:web:... ./scripts/demo.sh
 *
 * The DIDs are public identifiers, not secrets, so passing them this way is safe.
 */
export function deployEnv() {
  const fromEnvironment = {
    base: process.env.PUBLIC_URL,
    ageIssuerDid: process.env.AGE_ISSUER_DID,
    verifierDid: process.env.VERIFIER_DID,
    untrustedIssuerDid: process.env.UNTRUSTED_ISSUER_DID,
    // Generated at bootstrap, never committed. Absent means the Keycloak-backed
    // tests skip rather than guess.
    demoPassword: process.env.DEMO_CITIZEN_PASSWORD,
  };
  if (fromEnvironment.base && fromEnvironment.ageIssuerDid) {
    return {
      base: fromEnvironment.base.replace(/\/+$/, ''),
      ageIssuerDid: fromEnvironment.ageIssuerDid,
      verifierDid: fromEnvironment.verifierDid || '',
      untrustedIssuerDid: fromEnvironment.untrustedIssuerDid || '',
      demoPassword: fromEnvironment.demoPassword || '',
      opsBase: opsBase(),
    };
  }

  let text = '';
  try {
    text = readFileSync(join(ROOT, 'deploy', '.env'), 'utf8');
  } catch {
    throw new Error(
      'deploy/.env is missing and no PUBLIC_URL/AGE_ISSUER_DID in the environment — ' +
        'run: cd deploy && cp env.example .env && docker compose up -d',
    );
  }
  const env = {};
  for (const line of text.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return {
    base: (env.PUBLIC_URL || 'http://localhost').replace(/\/+$/, ''),
    ageIssuerDid: env.AGE_ISSUER_DID || '',
    verifierDid: env.VERIFIER_DID || '',
    untrustedIssuerDid: env.UNTRUSTED_ISSUER_DID || '',
    demoPassword: process.env.DEMO_CITIZEN_PASSWORD || env.DEMO_CITIZEN_PASSWORD || '',
    opsBase: opsBase(),
  };
}

/**
 * Where the OPERATOR endpoints are.
 *
 * Seeding, offer creation and schema listing are not citizen traffic, and the
 * gateway serves them only on a listener Docker publishes on 127.0.0.1 (see
 * deploy/nginx/routes-ops.conf). Locally that is simply reachable. Against a
 * remote deployment, forward the port first and point OPS_URL at the tunnel:
 *
 *   ssh -L 8088:127.0.0.1:8088 user@host
 *   PUBLIC_URL=https://host OPS_URL=http://127.0.0.1:8088 npm run test:e2e
 */
export function opsBase() {
  return (process.env.OPS_URL || `http://127.0.0.1:${process.env.OPS_PORT || 8088}`).replace(/\/+$/, '');
}

export async function json(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function ok(label, promise) {
  const res = await promise;
  if (res.status >= 400) {
    throw new Error(`${label} -> ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return res.body;
}

/** Skips the whole suite, with a usable message, when the stack is not up. */
export async function requireStack(base) {
  try {
    const res = await fetch(`${base}/gateway-health`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(String(res.status));
  } catch (err) {
    return `stack not reachable at ${base} (${err.message}) — run: cd deploy && docker compose up -d && ../scripts/bootstrap.sh`;
  }
  // Seeding, offer creation and schema listing all go through the operator
  // listener, so a suite that can reach only the public origin would fail deep
  // inside a test rather than saying what is actually missing.
  try {
    const res = await fetch(`${opsBase()}/api/v1/AgeCitizen/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 403) throw new Error('403: this is a public listener, not the operator one');
  } catch (err) {
    return `operator endpoints not reachable at ${opsBase()} (${err.message}) — locally they are published on 127.0.0.1:8088; against a remote deployment forward the port: ssh -L 8088:127.0.0.1:8088 user@host, then set OPS_URL`;
  }
  return null;
}

/** Asks the National Identity Authority's counter to issue for one citizen. */
export function issueOfferFor(base, citizenId) {
  return ok(
    `issue offer for ${citizenId}`,
    // The issuer counter is an operator endpoint: it mints a credential for a
    // named citizen with no authentication, so it is not on the public listener.
    json(`${opsBase()}/api/issuer/offers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ citizenId }),
    }),
  );
}

/**
 * Creates an offer directly against oid4vc-service for a named credential
 * configuration.
 *
 * Used only to impersonate a DIFFERENT issuer — the unlisted one — for the trust
 * test. It bypasses the issuer counter, not verification: the resulting
 * credential is genuinely signed, which is exactly what makes the test
 * meaningful.
 */
export async function issueAsIssuer({ base, issuerDid, credentialName, claims }) {
  const configs = await ok('list oid4vci configs', json(`${opsBase()}/credential-schema/oid4vci-configs`));
  const cfg = (configs || []).find((c) => c.name === credentialName && c.author === issuerDid);
  if (!cfg) throw new Error(`no ${credentialName} schema authored by ${issuerDid} — run scripts/bootstrap.sh`);
  const configurationId = (cfg.formats || []).length > 1 ? `${cfg.schemaId}_vc+sd-jwt` : cfg.schemaId;
  const offer = await ok(
    'create offer',
    json(`${opsBase()}/oid4vc/offer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        credential_configuration_id: configurationId,
        format: 'vc+sd-jwt',
        claims,
      }),
    }),
  );
  return { ...offer, credentialOfferUri: offer.credential_offer_uri, vct: cfg.vct };
}

/** Starts a verifier session: the QR the wallet would scan. */
export function startVerification(base) {
  return ok('start verification', json(`${base}/api/verifier/sessions`, { method: 'POST' }));
}

export function readVerification(base, sessionId) {
  return json(`${base}/api/verifier/sessions/${sessionId}`);
}

/** The claim names the verifier asks for, straight from the running service. */
export function verifierPolicy(base) {
  return ok('verifier policy', json(`${base}/api/verifier/policy`));
}

/** Decodes every disclosure in a presentation, to inspect what travelled. */
export function disclosedClaimNames(presentation) {
  const parts = presentation.split('~').slice(1).filter(Boolean);
  const names = [];
  for (const part of parts) {
    try {
      const decoded = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
      if (Array.isArray(decoded) && decoded.length === 3) names.push(decoded[1]);
    } catch {
      // The trailing segment is the KB-JWT, not a disclosure.
    }
  }
  return names.sort();
}
