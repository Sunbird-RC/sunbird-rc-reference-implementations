// Age domain module.
//
// The whole Age-specific surface of the verifier: which claim to ask for, and
// what decision a verified claim produces. Everything else in services/verifier
// is generic and is what iterations 2 and 3 build on.
//
// It receives only verified, allowlisted, minimum-disclosure claims. It never
// sees a raw presentation, an undisclosed claim, or an unverified credential.

/** Minimum disclosure for an age-restricted service: one derived assertion. */
export const AGE_CLAIM = 'ageOver18';

/**
 * @param {{vct: string}} config
 * @returns {{id: string, vct: string, claims: string[]}}
 */
export function ageCredentialRequest({ vct }) {
  return { id: 'age_cred', vct, claims: [AGE_CLAIM] };
}

/**
 * @param {Record<string, unknown>} claims verified, minimum-disclosure claims
 * @returns {{decision: 'APPROVED'|'DENIED', reason: string}}
 */
export function decideAge(claims) {
  const asserted = claims?.[AGE_CLAIM];

  // Strict boolean. A string "false" is truthy in JavaScript, and an age gate
  // that approves on the string "false" is the exact class of bug this
  // iteration exists to prove absent. A non-boolean means the credential did
  // not carry what the schema promised, which is a verification problem rather
  // than a business answer — so it is refused, not denied.
  if (typeof asserted !== 'boolean') {
    throw Object.assign(new Error(`${AGE_CLAIM} is not a boolean assertion`), { code: 'MALFORMED_CLAIM' });
  }

  return asserted
    ? { decision: 'APPROVED', reason: 'issuer asserts the holder is over 18' }
    : { decision: 'DENIED', reason: 'issuer asserts the holder is not over 18' };
}
