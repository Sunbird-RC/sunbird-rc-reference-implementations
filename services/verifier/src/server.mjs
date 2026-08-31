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
import {
  agricultureCredentialRequests,
  decideFarmCredit,
  loadCropPolicy,
  FARMER_CLAIMS,
  LAND_CLAIMS,
} from './domains/agriculture/index.mjs';
import { formatIndianRupees } from './domains/agriculture/money.mjs';
import QRCode from 'qrcode-svg';

const PORT = Number(process.env.PORT || 4300);
const PUBLIC_URL = (process.env.PUBLIC_URL || 'http://localhost').replace(/\/+$/, '');
const AGE_VCT = process.env.AGE_VCT || `${PUBLIC_URL}/vct/age-verification-credential`;
const FARMER_VCT = process.env.FARMER_VCT || `${PUBLIC_URL}/vct/farmer-identity-credential`;
const LAND_VCT = process.env.LAND_VCT || `${PUBLIC_URL}/vct/land-ownership-credential`;
const TRUST_POLICY_FILE = process.env.TRUST_POLICY_FILE || '/app/config/trust/issuers.json';
const CROP_POLICY_FILE = process.env.CROP_POLICY_FILE || '/app/config/policy/crop-rates.json';
// Mirrors oid4vc-service's VP_TXN_TTL default. A verifier session outliving the
// protocol transaction would show a QR that can no longer be answered.
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 300);

/**
 * The OID4VP signers, one per requesting PARTY.
 *
 * A wallet names the requesting party from the key that signed the request
 * object, so two verifiers sharing one signer are one party as far as any wallet
 * can tell — the farmer's consent screen read "Do you trust Age Check?" while
 * applying for crop credit. Separate identities for separate parties is the rule
 * bootstrap.sh already applies between the issuer and the verifier; this is the
 * same rule between the two verifiers.
 *
 * Falls back to the age signer when no bank instance is configured, so a
 * deployment that has not been re-bootstrapped still works — it just names the
 * wrong party, which is a demo defect and not an outage.
 */
const signers = {
  age: oid4vcClient({ baseUrl: process.env.OID4VC_BASE_URL || 'http://oid4vc-service:3400' }),
  bank: oid4vcClient({
    baseUrl:
      process.env.OID4VC_BANK_BASE_URL || process.env.OID4VC_BASE_URL || 'http://oid4vc-service:3400',
  }),
};
// Health and readiness stay the age instance's: it is the one every deployment
// has, and the readiness probe must not start failing on an optional service.
const oid4vc = signers.age;
const sessions = sessionStore({ ttlSeconds: SESSION_TTL_SECONDS });

// Loaded once, at boot, and deliberately allowed to throw: a verifier that
// cannot tell which issuers it trusts must not start and accept presentations.
const trust = loadTrustPolicy({ file: TRUST_POLICY_FILE });

// Same rule as the trust allowlist: a verifier that cannot read the lending
// policy must not start and then quote a rupee figure it made up.
const cropPolicy = loadCropPolicy({ file: CROP_POLICY_FILE });

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

/**
 * The use cases this verifier serves.
 *
 * A use case declares which credentials it asks for and what the verified
 * claims mean. Everything between the request and the decision — verification,
 * disclosure policy, issuer trust — is shared, which is the entire reason this
 * service is reusable rather than copied.
 */
const USE_CASES = {
  age: {
    signer: 'age',
    requests: () => [ageCredentialRequest({ vct: AGE_VCT })],
    describe: () => `requesting ${AGE_CLAIM} only`,
  },
  agriculture: {
    // The bank is a different party from the age-restricted service, so it signs
    // with its own DID and the wallet names it correctly.
    signer: 'bank',
    requests: () => agricultureCredentialRequests({ farmerVct: FARMER_VCT, landVct: LAND_VCT }),
    describe: () => 'requesting the farmer and land credentials',
  },
};

/**
 * The optional use-case prefix a front end may address its own namespace by.
 *
 * Reading and cancelling are use-case agnostic — the session itself records
 * which use case it belongs to — but a page that POSTs to
 * /api/verifier/agriculture/sessions reasonably expects to GET the result back
 * from the same place. Without this, the bank page's poll landed on no route at
 * all, the 404 was rendered as "the request expired", and the application it
 * described as unanswered had in fact been decided ELIGIBLE. Built from the map
 * so a third use case cannot be added and silently left un-pollable.
 */
const USE_CASE_PREFIX = `(?:/(?:${Object.keys(USE_CASES).join('|')}))?`;
const CANCEL_PATH = new RegExp(`^${USE_CASE_PREFIX}/sessions/([A-Za-z0-9_-]+)/cancel$`);
const READ_PATH = new RegExp(`^${USE_CASE_PREFIX}/sessions/([A-Za-z0-9_-]+)$`);

async function createSession(useCaseName = 'age') {
  const useCase = USE_CASES[useCaseName];
  if (!useCase) throw new Error(`unknown use case ${useCaseName}`);

  const requests = useCase.requests();
  const query = buildDcqlQuery(requests);
  const vp = await signers[useCase.signer].createRequest(query);

  const session = sessions.create({
    id: vp.transaction_id,
    useCase: useCaseName,
    // Recorded, not re-derived: the status of a transaction lives in the
    // instance that created it, so reading it from the other one is a 404 the
    // page would render as "expired".
    signer: useCase.signer,
    // One entry per credential the request asks for. Age has exactly one, which
    // is why its behaviour is unchanged by this becoming a list.
    requests: requests.map((request) => ({
      id: request.id,
      role: request.role,
      expectedClaims: expectedClaimNames(request),
    })),
    qrData: vp.qr_data,
  });

  console.log(`[verifier] session ${session.id} created (${useCaseName}); ${useCase.describe()}`);

  const requestedClaims =
    useCaseName === 'age' ? [AGE_CLAIM] : { farmer: FARMER_CLAIMS, land: LAND_CLAIMS };

  return {
    status: 201,
    body: {
      sessionId: session.id,
      useCase: useCaseName,
      // The deep link, and a rendering of it. The wallet gets everything it
      // needs from the QR; nothing about the holder is in it.
      qrData: vp.qr_data,
      // Sized and quiet-zoned for a PHONE CAMERA pointed at a laptop screen,
      // which is the actual demo. The payload is ~200 characters (a did:web
      // client_id plus an https request_uri), so the symbol is dense; at 320px
      // with a 2-module quiet zone a Galaxy A05 could not lock onto it. 480px
      // and the spec's 4-module quiet zone fixes it, and 'L' error correction
      // drops a version — fewer, larger modules — which matters far more here
      // than resilience to a smudged print.
      qrSvg: new QRCode({ content: vp.qr_data, padding: 4, width: 480, height: 480, ecl: 'L' }).svg(),
      requestedClaims,
      expiresInSeconds: SESSION_TTL_SECONDS,
    },
  };
}

/**
 * Sessions the verifier has given up on.
 *
 * Needed because a wallet that declines tells us NOTHING: Paradym posts no
 * response at all on refusal (observed 27 August 2026), so a declined request is
 * indistinguishable from one the holder simply ignored, and the only terminal
 * signal would be the TTL — minutes of an empty screen.
 *
 * Cancelling is therefore the verifier's own decision: it stops waiting, and it
 * will not report a decision for that request afterwards even if a presentation
 * turns up late. That last part is why this is enforced here rather than by a
 * timer in the UI: a client-side "cancelled" label over a session still capable
 * of returning APPROVED would be a lie.
 */
const abandoned = new Set();

async function readSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return { status: 404, body: { state: 'expired' } };
  if (abandoned.has(sessionId)) {
    return {
      status: 200,
      body: { state: 'cancelled', reason: 'the check was cancelled before a presentation arrived' },
    };
  }

  let status;
  try {
    status = await signers[session.signer || 'age'].getStatus(sessionId);
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
      // qrData travels with the waiting state so a client that has only a
      // session id can still find the request — a page reloaded mid-session, or
      // the hand-driven wallet in scripts/. It is the transaction the page is
      // already displaying, it names the signer that holds it, and it contains
      // nothing about the holder. Rebuilding that URL from PUBLIC_URL instead
      // would guess a path prefix and reach the wrong signer.
      return { status: 200, body: { state: 'waiting', qrData: session.qrData } };
    }
    // A refusal is not a failure. It gets its own state so the page can say
    // "nothing was shared" instead of showing a red verification error, and so
    // no claim values or checks are reported for a presentation that never
    // legitimately arrived.
    if (verification.declined) {
      console.log(`[verifier] session ${sessionId} declined by the holder`);
      return { status: 200, body: { state: 'declined', reason: verification.reason } };
    }
    console.log(`[verifier] session ${sessionId} rejected: ${verification.reason}`);
    return reject(verification.reason, {
      failedCheck: verification.failedCheck,
      diagnostic: sanitiseDiagnostic(status.error),
    });
  }

  // Steps 2-4, once per credential the request asked for. Age passes through
  // this with a single entry; Agriculture with two. The loop is what makes a
  // multi-credential presentation safe: every credential is disclosure-checked
  // and trust-checked on its own, and one trusted issuer cannot stand in for
  // another's role.
  const verified = {};
  const issuerNames = [];
  for (const request of session.requests) {
    const claims = status.claims?.[request.id];
    if (!claims || typeof claims !== 'object') {
      return reject(
        session.requests.length > 1
          ? `presentation matched no ${request.role || request.id} credential for this request`
          : 'presentation matched no credential for this request',
      );
    }

    // 2. Disclosure policy: exactly what was asked for, nothing more.
    const policy = assertExactClaims(request.expectedClaims, claims);
    if (!policy.ok) {
      console.log(`[verifier] session ${sessionId} rejected: ${policy.reason}`);
      return reject(policy.reason);
    }

    // 3. Issuer trust, pinned to this credential's role. Sunbird RC proved the
    //    signature is valid; this proves it belongs to an issuer this verifier
    //    accepts FOR THIS SLOT.
    const trusted = trust.check(claims[ISSUER_CLAIM], { role: request.role });
    if (!trusted.ok) {
      console.log(`[verifier] session ${sessionId} rejected: ${trusted.reason}`);
      return reject(trusted.reason);
    }

    verified[request.role || request.id] = claims;
    issuerNames.push(trusted.issuer.name);
  }

  // 4. Business rule, on verified claims only.
  //
  //    Holder binding across the whole presentation is proven upstream and
  //    asserted in step 1: oid4vc-service checks the Key Binding JWT for the
  //    presentation, so two credentials arriving in one VP token are held by one
  //    wallet key. That is what lets the Agriculture module treat matching
  //    farmerId as correlation rather than coincidence.
  let outcome;
  try {
    outcome = session.useCase === 'agriculture'
      ? decideFarmCredit({ farmer: verified.farmer, land: verified.land }, cropPolicy)
      : decideAge(verified[session.requests[0].id]);
  } catch (err) {
    // A malformed claim or broken correlation is a verification problem, not a
    // business answer. PRODUCT is explicit that it must not be presented as
    // ordinary ineligibility.
    console.log(`[verifier] session ${sessionId} rejected: ${err.message}`);
    return reject(err.message);
  }

  const issuer = issuerNames.length === 1 ? issuerNames[0] : issuerNames;

  if (session.useCase === 'agriculture') {
    console.log(`[verifier] session ${sessionId} ${outcome.outcome} (issuers ${issuerNames.join(', ')})`);
    return {
      status: 200,
      body: {
        state: 'decided',
        decision: outcome.outcome,
        reason: outcome.reason,
        checks: status.checks,
        issuer,
        // EVERYTHING the farmer disclosed, not merely the inputs the policy
        // happened to use. The page prints this under "Shared with us" next to
        // the list of claims that were withheld, so a short list here does not
        // read as brevity — it reads as a stronger privacy guarantee than the
        // request actually made. It listed three claims of the five distinct
        // ones that arrived until this was fixed.
        //
        // farmerId is taken from the FARMER credential specifically, and the
        // land credential's copy is not spread over it: when the two disagree
        // the decision is CORRELATION_FAILED, and a merge would quietly display
        // one farmer id for a presentation that carried two.
        disclosed: {
          farmerId: verified.farmer.farmerId,
          registeredFarmer: verified.farmer.registeredFarmer,
          ...(verified.land
            ? {
                ownershipStatus: verified.land.ownershipStatus,
                cropType: verified.land.cropType,
                cultivatedAreaAcres: verified.land.cultivatedAreaAcres,
              }
            : {}),
        },
        loan:
          outcome.outcome === 'ELIGIBLE'
            ? {
                ratePerAcre: outcome.ratePerAcre,
                // Formatted here as well as the total, because the mobile
                // verifier runs on Hermes, where Intl is not guaranteed and
                // Number.toLocaleString('en-IN') silently falls back to plain
                // grouping — so the phone would print a different figure from the
                // web page for the same decision. Money is formatted in one
                // place, by the service that owns the policy.
                ratePerAcreFormatted: formatIndianRupees(outcome.ratePerAcre),
                maximumLoan: outcome.maximumLoan,
                maximumLoanFormatted: formatIndianRupees(outcome.maximumLoan),
                currency: cropPolicy.currency,
              }
            : undefined,
      },
    };
  }

  console.log(`[verifier] session ${sessionId} ${outcome.decision} (issuer ${issuer})`);

  return {
    status: 200,
    body: {
      state: 'decided',
      decision: outcome.decision,
      reason: outcome.reason,
      checks: status.checks,
      issuer,
      // The claim the holder chose to disclose, and nothing else. holderDid is
      // available upstream and deliberately not surfaced or logged.
      disclosed: { [AGE_CLAIM]: verified[session.requests[0].id][AGE_CLAIM] },
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
    if (req.method === 'GET' && path === '/agriculture/policy') {
      // The bank's request and the lending policy behind the figure it will
      // show, published so the demo can prove both are minimal and fixed rather
      // than asserted by the page.
      return send(200, {
        credentialTypes: { farmer: FARMER_VCT, land: LAND_VCT },
        requestedClaims: { farmer: FARMER_CLAIMS, land: LAND_CLAIMS },
        protocolClaims: [ISSUER_CLAIM],
        cropRates: Object.fromEntries(cropPolicy.crops.map((crop) => [crop, cropPolicy.rate(crop)])),
        maxRatePerAcre: cropPolicy.maxRatePerAcre,
        currency: cropPolicy.currency,
        trustedIssuers: trust.issuers.map((i) => ({ name: i.name, roles: i.roles })),
      });
    }
    if (req.method === 'POST' && path === '/sessions') {
      const result = await createSession('age');
      return send(result.status, result.body);
    }
    if (req.method === 'POST' && path === '/agriculture/sessions') {
      const result = await createSession('agriculture');
      return send(result.status, result.body);
    }
    const cancelMatch = CANCEL_PATH.exec(path);
    if (req.method === 'POST' && cancelMatch) {
      const id = cancelMatch[1];
      if (!sessions.get(id)) return send(404, { state: 'expired' });
      abandoned.add(id);
      console.log(`[verifier] session ${id} cancelled by the verifier; no decision will be reported`);
      return send(200, { state: 'cancelled' });
    }
    const match = READ_PATH.exec(path);
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
    `[verifier] listening on ${PORT}; trusting ${trust.issuers.length} issuer(s); ` +
      `age vct=${AGE_VCT}; agriculture vcts=${FARMER_VCT}, ${LAND_VCT}; ` +
      `crops=${cropPolicy.crops.join(',')}`,
  );
});
