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
 * Why the purpose travels in `credential_sets` and not in `client_metadata`.
 *
 * A wallet has nowhere to display a reason unless the request carries one, and
 * OpenID4VP 1.0 puts that string on the credential set — §6.1's
 * `credential_sets[].purpose`. Without it Paradym shows "No information was
 * provided on the purpose of the data request. Be cautious" on every review
 * screen, which is accurate but tells the holder to distrust a request the
 * verifier could simply have explained. Both earlier iterations shipped with
 * that notice and narrated it aloud rather than hiding it; this closes it.
 *
 * `client_metadata` was the first guess and is the wrong place: it describes the
 * client, is not read for a purpose by the wallet SDK, and would have produced a
 * request that still warned. The field the wallet actually reads is
 * `credential_sets[].purpose` — packages/sdk/src/format/dcqlRequest.ts:131 takes
 * the first set whose purpose is a string.
 *
 * One set listing every credential id, `required: true`. That is the same
 * semantics the query already had — the wallet's own fallback when no set is
 * declared is exactly this shape — so declaring it adds the purpose without
 * making any credential optional. Splitting the ids across options would, and
 * would quietly turn a three-credential request into a one-of-three.
 */
function credentialSets(requests, purpose) {
  // Absent is a use case that declares no purpose — Age and Agriculture, whose
  // accepted requests must stay byte-identical. Present-but-blank is a bug in a
  // policy, and swallowing it would ship the "Be cautious" screen this exists to
  // remove while looking like it had been fixed.
  if (purpose === undefined || purpose === null) return {};
  if (typeof purpose !== 'string' || purpose.trim() === '') {
    throw new Error('a credential request purpose must be a non-empty string');
  }
  return {
    credential_sets: [
      {
        required: true,
        options: [requests.map((request) => request.id)],
        purpose,
      },
    ],
  };
}

/**
 * @param {CredentialRequest[]} requests
 * @param {{purpose?: string}} [options] Why the verifier is asking, shown to the
 *   holder by the wallet before they consent.
 * @returns {{credentials: object[], credential_sets?: object[]}}
 */
export function buildDcqlQuery(requests, { purpose } = {}) {
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error('at least one credential request is required');
  }
  return {
    ...credentialSets(requests, purpose),
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
