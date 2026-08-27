// DCQL query construction (OpenID4VP 1.0, Digital Credentials Query Language).
//
// Generic: a domain module declares WHAT it needs as a credential request
// descriptor, and this builds the query. Iterations 2 and 3 add descriptors —
// multiple entries here become a multi-credential presentation — without
// touching protocol code.

/**
 * The issuer identifier claim, always requested alongside the domain claims.
 *
 * Requesting it is what makes the trust allowlist possible at all: v2.1.0
 * returns only DCQL-MATCHED claims from /vp/status, so an unrequested `iss`
 * would simply be absent and there would be nothing to check the issuer
 * against. It is a protocol claim, not holder identity data — asking for it
 * discloses nothing about the person.
 */
export const ISSUER_CLAIM = 'iss';

/**
 * DCQL spells the SD-JWT VC format `dc+sd-jwt`, while the OpenID4VCI credential
 * format is `vc+sd-jwt`. Both spellings are correct in their own place and
 * oid4vc-service treats them as aliases when matching; Credo-based wallets are
 * strict about the DCQL one. This is not a typo.
 */
export const SD_JWT_DCQL_FORMAT = 'dc+sd-jwt';

/**
 * @typedef {object} CredentialRequest
 * @property {string} id          Query id; keys the claims in the VP response.
 * @property {string} vct         Credential type URI to accept.
 * @property {string[]} claims    Domain claims to request. Minimum set only.
 * @property {string} [format]
 */

/**
 * @param {CredentialRequest[]} requests
 * @returns {{credentials: object[]}}
 */
export function buildDcqlQuery(requests) {
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error('at least one credential request is required');
  }
  return {
    credentials: requests.map((request) => {
      if (!request.vct) throw new Error(`credential request ${request.id} has no vct`);
      if (!Array.isArray(request.claims) || request.claims.length === 0) {
        // A DCQL entry with no claims means "disclose everything" in
        // oid4vc-service's evaluator. For a data-minimisation showcase that is
        // the one thing this must never accidentally send.
        throw new Error(`credential request ${request.id} must name the claims it needs`);
      }
      return {
        id: request.id,
        format: request.format || SD_JWT_DCQL_FORMAT,
        // Mandatory for SD-JWT DCQL: without `meta` the query fails validation
        // with 'Invalid key: Expected "meta"'. It also pins the credential type,
        // so an unrelated credential cannot satisfy the query.
        meta: { vct_values: [request.vct] },
        // Deliberately no `values` constraint on the domain claims. Constraining
        // ageOver18 to true would turn a legitimate minor into a VERIFICATION
        // FAILURE instead of a verified DENIED decision, which is a different
        // (and wrong) answer to the question the verifier asked.
        claims: [...request.claims, ISSUER_CLAIM].map((path) => ({ path: [path] })),
      };
    }),
  };
}

/**
 * The claim names a response for this request is expected to carry.
 * @param {CredentialRequest} request
 */
export function expectedClaimNames(request) {
  return [...request.claims, ISSUER_CLAIM].sort();
}
