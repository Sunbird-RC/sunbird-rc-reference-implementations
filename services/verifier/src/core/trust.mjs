// Demo trust model: a version-controlled allowlist of issuer identifiers
// (DESIGN §6). Not a trust registry — building one is explicitly out of scope.
//
// This exists because Sunbird RC v2.1.0's OID4VP verifier answers "is this
// signature valid?" but never "is this issuer one we accept?". Both questions
// have to be answered before a business rule runs, or any party able to mint the
// same credential type would be believed.

import { readFileSync } from 'node:fs';

/**
 * Expands ${VAR} references from the environment.
 *
 * An unset or still-unexpanded variable is a hard failure. The alternative —
 * treating it as empty — would silently widen the allowlist to "an issuer whose
 * DID is the empty string", and the negative tests would start passing for the
 * wrong reason.
 *
 * @param {string} value
 * @param {Record<string, string|undefined>} env
 */
function expand(value, env) {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
    const resolved = env[name];
    if (!resolved) {
      throw new Error(
        `trust policy references ${name}, which is not set. Run scripts/bootstrap.sh, ` +
          'then recreate the verifier so it picks the value up.',
      );
    }
    return resolved;
  });
}

/**
 * @param {{file: string, env?: Record<string, string|undefined>}} config
 */
export function loadTrustPolicy({ file, env = process.env }) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const issuers = (raw.issuers || []).map((issuer) => ({
    name: issuer.name,
    did: expand(String(issuer.did || ''), env),
    credentials: issuer.credentials || [],
  }));
  if (issuers.length === 0) throw new Error(`trust policy ${file} allowlists no issuers`);

  const byDid = new Map(issuers.map((issuer) => [issuer.did, issuer]));

  return {
    issuers,

    /**
     * @param {unknown} iss The `iss` claim as presented.
     * @returns {{ok: true, issuer: {name: string, did: string}} | {ok: false, reason: string}}
     */
    check(iss) {
      if (typeof iss !== 'string' || iss.length === 0) {
        // The DCQL query always requests `iss`, so an absent one means the
        // presentation did not carry an issuer identifier at all.
        return { ok: false, reason: 'presentation carried no issuer identifier' };
      }
      const issuer = byDid.get(iss);
      if (!issuer) return { ok: false, reason: 'issuer is not in the demo trust allowlist' };
      return { ok: true, issuer: { name: issuer.name, did: issuer.did } };
    },
  };
}
