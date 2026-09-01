// The approved-algorithm policy (REQUIREMENTS §8), enforced rather than recorded.
//
// Iteration 01 shipped this as a documented deviation: `alg` lives in a JWS
// protected header, never reaches the claim set, and was not reported by
// /vp/status — so a policy field for it would have been a control that did
// nothing, and saying otherwise would have been worse than saying nothing.
//
// oid4vc-service now reports the algorithms it observed on each presentation as
// `algs` (fork commit 1583b7bd, in the pinned build). So the control is real, and
// this module is what makes it bite.
//
// Two properties matter more than the allowlist itself:
//
//   * A MISSING algorithm is a rejection, not a pass. The upstream helper
//     deliberately omits an alg it could not parse rather than guessing, so
//     `algs: []` means "we could not observe one" — and accepting that would
//     reduce the control to "reject only algorithms we happen to recognise".
//   * A rejection here is NOT a business answer. Like an untrusted issuer, it
//     means we could not trust what we were shown, so it must never reach the
//     lending rule.

import { readFileSync } from 'node:fs';

/** RFC 7518 / RFC 8037 `alg` names are short, uppercase-ish tokens. */
const WELL_FORMED = /^[A-Za-z0-9_-]{2,16}$/;

/**
 * @param {{file: string}} config
 */
export function loadAlgorithmPolicy({ file }) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const approved = Array.isArray(raw.approved) ? raw.approved.map(String) : [];
  if (approved.length === 0) {
    // An empty allowlist would refuse every presentation, which looks identical
    // to the stack being broken. Refusing to start says why.
    throw new Error(`algorithm policy ${file} approves no algorithms`);
  }
  for (const alg of approved) {
    if (!WELL_FORMED.test(alg)) {
      throw new Error(`algorithm policy ${file} lists a malformed algorithm: ${JSON.stringify(alg)}`);
    }
  }
  const allowed = new Set(approved);

  return {
    approved,

    /**
     * Checks the algorithms observed on a presentation against the policy.
     *
     * @param {unknown} algs The `algs` array from /vp/status.
     * @returns {{ok: true, algorithms: string[]} | {ok: false, reason: string, diagnostic: string}}
     */
    check(algs) {
      if (!Array.isArray(algs) || algs.length === 0) {
        // Either the presentation carried no readable `alg`, or this deployment
        // is running a build that does not report it. Both are "we cannot
        // enforce the policy", and the policy is not optional.
        return {
          ok: false,
          reason: 'the signature algorithm could not be determined',
          diagnostic: 'no algorithm was reported for the presentation',
        };
      }

      const seen = [];
      for (const value of algs) {
        if (typeof value !== 'string' || !WELL_FORMED.test(value)) {
          return {
            ok: false,
            reason: 'the signature algorithm is malformed',
            // The value is bounded and quoted: it is attacker-influenced input,
            // so it is neither interpolated bare nor allowed to run long.
            diagnostic: `malformed algorithm ${JSON.stringify(String(value).slice(0, 24))}`,
          };
        }
        seen.push(value);
      }

      // EVERY algorithm has to be approved, not merely one of them: a
      // presentation is a credential signature plus a holder binding signature,
      // and accepting the pair because one half is ES256 would let the other be
      // anything at all.
      const rejected = seen.filter((alg) => !allowed.has(alg));
      if (rejected.length) {
        return {
          ok: false,
          reason: 'the signature algorithm is not approved',
          diagnostic: `${rejected.join(', ')} is not in the approved list (${approved.join(', ')})`,
        };
      }

      return { ok: true, algorithms: seen };
    },
  };
}
