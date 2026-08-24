// The reusable verifier service.
//
// Everything here is generic except one import: the Age domain module. The order
// of operations is the point of the whole component —
//
//   1. cryptographic verification passed (all checks OK, upstream);
//   2. the disclosure is exactly what was requested;
//   3. the issuer is on the demo trust allowlist;
//   4. only then, a domain decision.
//
// Iterations 2 and 3 add domain modules and credential requests. They must not
// need to touch steps 1-3.

import { createServer } from 'node:http';
import { oid4vcClient } from './core/oid4vc-client.mjs';
import { buildDcqlQuery, expectedClaimNames, ISSUER_CLAIM } from './core/dcql.mjs';
import { evaluateChecks } from './core/checks.mjs';
import { loadTrustPolicy } from './core/trust.mjs';
import { assertExactClaims } from './core/claim-policy.mjs';
import { sessionStore } from './core/sessions.mjs';
import { ageCredentialRequest, decideAge, AGE_CLAIM } from './domains/age/index.mjs';
import QRCode from 'qrcode-svg';

const PORT = Number(process.env.PORT || 4300);
const PUBLIC_URL = (process.env.PUBLIC_URL || 'http://localhost').replace(/\/+$/, '');
const AGE_VCT = process.env.AGE_VCT || `${PUBLIC_URL}/vct/age-verification-credential`;
const TRUST_POLICY_FILE = process.env.TRUST_POLICY_FILE || '/app/config/trust/issuers.json';
// Mirrors oid4vc-service's VP_TXN_TTL default. A verifier session outliving the
// protocol transaction would show a QR that can no longer be answered.
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 300);

const oid4vc = oid4vcClient({ baseUrl: process.env.OID4VC_BASE_URL || 'http://oid4vc-service:3400' });
const sessions = sessionStore({ ttlSeconds: SESSION_TTL_SECONDS });

// Loaded once, at boot, and deliberately allowed to throw: a verifier that
// cannot tell which issuers it trusts must not start and accept presentations.
const trust = loadTrustPolicy({ file: TRUST_POLICY_FILE });

/**
 * Strips anything that looks like a token, credential or disclosure out of an
 * upstream diagnostic before it reaches a browser or a log.
 *
 * Upstream messages are short and structural ('nonce mismatch'), but they are
 * built by interpolating an error, so a future one could carry a JWT or a claim
 * value. Long base64url runs are the giveaway.
 */
function sanitiseDiagnostic(message) {
  if (typeof message !== 'string') return undefined;
  return message
    .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{8,}[.~][A-Za-z0-9_.~-]*/g, '[redacted]')
    .replace(/[A-Za-z0-9_-]{40,}/g, '[redacted]')
    .slice(0, 200);
}

async function createSession() {
  const request = ageCredentialRequest({ vct: AGE_VCT });
  const query = buildDcqlQuery([request]);
  const vp = await oid4vc.createRequest(query);

  const session = sessions.create({
    id: vp.transaction_id,
    requestId: request.id,
    expectedClaims: expectedClaimNames(request),
    qrData: vp.qr_data,
  });

  console.log(`[verifier] session ${session.id} created; requesting ${AGE_CLAIM} only`);

  return {
    status: 201,
    body: {
      sessionId: session.id,
      // The deep link, and a rendering of it. The wallet gets everything it
      // needs from the QR; nothing about the holder is in it.
      qrData: vp.qr_data,
      qrSvg: new QRCode({ content: vp.qr_data, padding: 2, width: 320, height: 320, ecl: 'M' }).svg(),
      requestedClaims: [AGE_CLAIM],
      expiresInSeconds: SESSION_TTL_SECONDS,
    },
  };
}

async function readSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return { status: 404, body: { state: 'expired' } };

  let status;
  try {
    status = await oid4vc.getStatus(sessionId);
  } catch (err) {
    if (err.status === 404) return { status: 404, body: { state: 'expired' } };
    throw err;
  }

  const reject = (reason, extra = {}) => ({
    status: 200,
    body: { state: 'rejected', reason, checks: status.checks || {}, ...extra },
  });

  // 1. Cryptographic verification, upstream. Nothing below runs until this
  //    passes — including, and especially, the domain decision.
  const verification = evaluateChecks(status);
  if (!verification.ok) {
    if (verification.reason === 'pending') {
      return { status: 200, body: { state: 'waiting' } };
    }
    console.log(`[verifier] session ${sessionId} rejected: ${verification.reason}`);
    return reject(verification.reason, {
      failedCheck: verification.failedCheck,
      diagnostic: sanitiseDiagnostic(status.error),
    });
  }

  const claims = status.claims?.[session.requestId];
  if (!claims || typeof claims !== 'object') {
    return reject('presentation matched no credential for this request');
  }

  // 2. Disclosure policy: exactly what was asked for, nothing more.
  const policy = assertExactClaims(session.expectedClaims, claims);
  if (!policy.ok) {
    console.log(`[verifier] session ${sessionId} rejected: ${policy.reason}`);
    return reject(policy.reason);
  }

  // 3. Issuer trust. Sunbird RC proved the signature is valid; this is what
  //    proves it belongs to an issuer this verifier accepts.
  const trusted = trust.check(claims[ISSUER_CLAIM]);
  if (!trusted.ok) {
    console.log(`[verifier] session ${sessionId} rejected: ${trusted.reason}`);
    return reject(trusted.reason);
  }

  // 4. Business rule, on verified claims only.
  let outcome;
  try {
    outcome = decideAge(claims);
  } catch (err) {
    console.log(`[verifier] session ${sessionId} rejected: ${err.message}`);
    return reject(err.message);
  }

  console.log(`[verifier] session ${sessionId} ${outcome.decision} (issuer ${trusted.issuer.name})`);

  return {
    status: 200,
    body: {
      state: 'decided',
      decision: outcome.decision,
      reason: outcome.reason,
      checks: status.checks,
      issuer: trusted.issuer.name,
      // The claim the holder chose to disclose, and nothing else. holderDid is
      // available upstream and deliberately not surfaced or logged.
      disclosed: { [AGE_CLAIM]: claims[AGE_CLAIM] },
    },
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  const send = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body ?? {}));
  };

  try {
    if (req.method === 'GET' && path === '/healthz') {
      return send(200, {
        status: 'UP',
        service: 'verifier',
        trustedIssuers: trust.issuers.length,
        activeSessions: sessions.size,
      });
    }
    if (req.method === 'GET' && path === '/readyz') {
      await oid4vc.health();
      return send(200, { status: 'UP', oid4vc: 'UP' });
    }
    if (req.method === 'GET' && path === '/policy') {
      // What this verifier asks for, so the demo can show the request is
      // minimal without taking the UI's word for it.
      return send(200, {
        credentialType: AGE_VCT,
        requestedClaims: [AGE_CLAIM],
        protocolClaims: [ISSUER_CLAIM],
        trustedIssuers: trust.issuers.map((i) => i.name),
      });
    }
    if (req.method === 'POST' && path === '/sessions') {
      const result = await createSession();
      return send(result.status, result.body);
    }
    const match = /^\/sessions\/([A-Za-z0-9_-]+)$/.exec(path);
    if (req.method === 'GET' && match) {
      const result = await readSession(match[1]);
      return send(result.status, result.body);
    }
    return send(404, { error: 'not_found' });
  } catch (err) {
    console.error(`[verifier] ${req.method} ${path} failed: ${sanitiseDiagnostic(err.message)}`);
    return send(500, { error: 'verifier_error' });
  }
});

server.listen(PORT, () => {
  console.log(
    `[verifier] listening on ${PORT}; vct=${AGE_VCT}; trusting ${trust.issuers.length} issuer(s)`,
  );
});
