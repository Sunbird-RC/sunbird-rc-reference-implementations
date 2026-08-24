// Helpers for driving the running stack: read the deployment's configuration,
// ask the issuer counter for an offer, and drive a verifier session.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** Reads deploy/.env, which bootstrap.sh fills in with the minted DIDs. */
export function deployEnv() {
  let text = '';
  try {
    text = readFileSync(join(ROOT, 'deploy', '.env'), 'utf8');
  } catch {
    throw new Error('deploy/.env is missing — run: cd deploy && cp env.example .env && docker compose up -d');
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
  };
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
  return null;
}

/** Asks the National Identity Authority's counter to issue for one citizen. */
export function issueOfferFor(base, citizenId) {
  return ok(
    `issue offer for ${citizenId}`,
    json(`${base}/api/issuer/offers`, {
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
  const configs = await ok('list oid4vci configs', json(`${base}/credential-schema/oid4vci-configs`));
  const cfg = (configs || []).find((c) => c.name === credentialName && c.author === issuerDid);
  if (!cfg) throw new Error(`no ${credentialName} schema authored by ${issuerDid} — run scripts/bootstrap.sh`);
  const configurationId = (cfg.formats || []).length > 1 ? `${cfg.schemaId}_vc+sd-jwt` : cfg.schemaId;
  const offer = await ok(
    'create offer',
    json(`${base}/oid4vc/offer`, {
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
