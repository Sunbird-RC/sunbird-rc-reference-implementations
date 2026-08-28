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
/** The negative fixture's name and schema id, shared by the suite and demo.sh. */
export const NEGATIVE_FIXTURE = {
  name: 'Age Verification Credential (unlisted issuer)',
  schemaId: 'AgeVerificationCredentialUnlisted',
  vctSlug: 'age-verification-credential',
};

/**
 * Creates the "valid credential from an untrusted issuer" fixture if it is not
 * already there, and returns its oid4vci config.
 *
 * Bootstrap deliberately does NOT create this. Issuer metadata is built from
 * every published schema with no filter, so a fixture created at setup time
 * appears in the wallet's issuer directory beside the real credential — which is
 * exactly the thing a customer-facing stack must not show. Provisioning it here
 * keeps the fixture inside the test that needs it.
 *
 * Four details are load-bearing and were each found the hard way:
 *   - `status: 'PUBLISHED'` — a draft schema is invisible to oid4vci-configs.
 *   - `oid4vciEnabled` / `oid4vciFormats` — a plausible `enabled`/`formats` is
 *     silently ignored and the credential never becomes issuable.
 *   - `vct` must be the bare slug; an absolute URL makes /vct/<slug> 404, and
 *     Credo fetches that document to render the credential.
 *   - every display entry needs a `locale`, or a wallet fetching the type
 *     metadata fails with nothing more useful than "something went wrong".
 *
 * Deprecating rather than deleting means each run that finds none creates a new
 * schema row (the registry assigns its own `did:schema:` id, so the authored
 * `$id` is not a unique key). Deprecated rows are invisible to
 * `oid4vci-configs` and to issuer metadata, which is the property that matters.
 *
 * The vct is deliberately IDENTICAL to the real credential's: that is what makes
 * the trust test real. DCQL matches on vct, upstream verification finds a
 * genuinely valid signature, and the only thing that rejects the presentation is
 * the verifier's trust allowlist.
 */
export async function ensureNegativeFixture(issuerDid) {
  if (!issuerDid) throw new Error('ensureNegativeFixture needs the untrusted issuer DID');
  const listed = await ok('list oid4vci configs', json(`${opsBase()}/credential-schema/oid4vci-configs`));
  const existing = (listed || []).find((c) => c.name === NEGATIVE_FIXTURE.name && c.author === issuerDid);
  if (existing) return existing;

  await ok(
    'create negative fixture schema',
    json(`${opsBase()}/credential-schema`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schema: {
          type: 'https://w3c-ccg.github.io/vc-json-schemas/',
          version: '1.0.0',
          id: NEGATIVE_FIXTURE.schemaId,
          name: NEGATIVE_FIXTURE.name,
          author: issuerDid,
          authored: '2026-01-01T00:00:00.000Z',
          schema: {
            $id: NEGATIVE_FIXTURE.schemaId,
            $schema: 'https://json-schema.org/draft/2019-09/schema',
            description: 'Test fixture: a well-formed age credential from an issuer outside the trust allowlist.',
            type: 'object',
            properties: {
              ageOver18: { type: 'boolean' },
              ageOver21: { type: 'boolean' },
              name: { type: 'string' },
              dateOfBirth: { type: 'string', format: 'date' },
            },
            required: ['ageOver18'],
            // Issuance always adds credentialSubject.id, which is not a schema
            // claim; false here makes every issuance fail with an opaque 500.
            additionalProperties: true,
          },
        },
        tags: ['age', 'test-fixture'],
        status: 'PUBLISHED',
        oid4vciConfig: {
          oid4vciEnabled: true,
          oid4vciFormats: ['vc+sd-jwt'],
          vct: NEGATIVE_FIXTURE.vctSlug,
          display: [{ name: NEGATIVE_FIXTURE.name, locale: 'en-US' }],
        },
      }),
    }),
  );

  const after = await ok('re-list oid4vci configs', json(`${opsBase()}/credential-schema/oid4vci-configs`));
  const created = (after || []).find((c) => c.name === NEGATIVE_FIXTURE.name && c.author === issuerDid);
  if (!created) throw new Error('created the negative fixture but it is not in oid4vci-configs');
  return created;
}

/**
 * Takes the fixture back out of the issuer's advertised credentials.
 *
 * Takes the registry's own id — `did:schema:<uuid>`, as returned in
 * `oid4vci-configs[].schemaId` — NOT the authored `$id`. Passing the authored id
 * answers 500 "Error fetching schema for update from db", which is how this was
 * found.
 *
 * Best-effort on purpose: a suite that fails should not also fail its cleanup,
 * but leaving it advertised would put it back in the wallet's issuer directory.
 */
export async function retireNegativeFixture(registrySchemaId) {
  if (!registrySchemaId) return;
  try {
    await json(`${opsBase()}/credential-schema/deprecate/${registrySchemaId}/1.0.0`, { method: 'PUT' });
  } catch {
    // Nothing to do: ensureNegativeFixture creates a fresh one next run.
  }
}

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

/**
 * Creates a pre-authorised offer on ONE of the Agriculture issuers.
 *
 * Each registry is its own oid4vc-service instance published under its own path
 * prefix, so the offer is created on that instance and the wallet then collects
 * from that instance's token and credential endpoints. Using the Age instance
 * would sign with the right schema author but would exercise the wrong issuer,
 * and "two independent issuers" is the thing under test.
 *
 * Pre-authorised, not wallet-driven: this is the scripted protocol evidence. The
 * customer journey is authenticated wallet-driven issuance, which the charter says
 * a scripted client may never stand in for.
 *
 * @param {{base: string, which: 'farmer'|'land', issuerDid: string, claims: object}} args
 */
export async function issueAgricultureCredential({ base, which, issuerDid, claims }) {
  const name = which === 'farmer' ? 'Farmer Identity Credential' : 'Land Ownership Credential';
  const configs = await ok('list oid4vci configs', json(`${opsBase()}/credential-schema/oid4vci-configs`));
  const cfg = (configs || []).find((c) => c.name === name && c.author === issuerDid);
  if (!cfg) throw new Error(`no ${name} schema authored by ${issuerDid} — run scripts/bootstrap.sh`);
  const configurationId = (cfg.formats || []).length > 1 ? `${cfg.schemaId}_vc+sd-jwt` : cfg.schemaId;
  const offer = await ok(
    `create ${which} offer`,
    json(`${opsBase()}/${which}/oid4vc/offer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential_configuration_id: configurationId, format: 'vc+sd-jwt', claims }),
    }),
  );
  return { ...offer, credentialOfferUri: offer.credential_offer_uri, vct: cfg.vct, issuerBase: `${base}/${which}` };
}

/** Starts the bank's farm-credit session: the QR the farmer's wallet scans. */
export function startFarmCreditVerification(base) {
  return ok('start farm credit check', json(`${base}/api/verifier/agriculture/sessions`, { method: 'POST' }));
}

/** What the bank asks for and lends at, straight from the service. */
export function farmCreditPolicy(base) {
  return ok('farm credit policy', json(`${base}/api/verifier/agriculture/policy`));
}

/** Starts a verifier session: the QR the wallet would scan. */
export function startVerification(base) {
  return ok('start verification', json(`${base}/api/verifier/sessions`, { method: 'POST' }));
}

export function readVerification(base, sessionId) {
  return json(`${base}/api/verifier/sessions/${sessionId}`);
}

/**
 * Abandons a session the way the verifier UI does when the operator gives up.
 *
 * The point of the endpoint is that the refusal is enforced server side: once a
 * session is abandoned the verifier must not report a decision for it even if a
 * valid presentation turns up afterwards.
 */
export function cancelVerification(base, sessionId) {
  return json(`${base}/api/verifier/sessions/${sessionId}/cancel`, { method: 'POST' });
}

/** Everything the issuer advertises to a wallet, straight from the metadata. */
export async function issuerMetadata(base) {
  return ok('issuer metadata', json(`${base}/.well-known/openid-credential-issuer`));
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
