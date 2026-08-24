// Data-minimisation guard.
//
// The verifier must receive exactly the claims it asked for. In v2.1.0 the
// /vp/status response already contains only DCQL-matched claims, so this cannot
// catch a wallet over-sharing (that is proven in the e2e suite, against the raw
// presentation). What it does catch is this service asking for too much: a DCQL
// entry with no `claims` means "disclose everything", and a wildcard request
// that silently started returning name and date of birth would otherwise reach
// a domain module and a screen.

/**
 * @param {string[]} expected sorted claim names
 * @param {Record<string, unknown>} received
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function assertExactClaims(expected, received) {
  const got = Object.keys(received || {}).sort();
  const want = [...expected].sort();

  const unexpected = got.filter((name) => !want.includes(name));
  if (unexpected.length > 0) {
    return { ok: false, reason: `presentation disclosed unrequested claims: ${unexpected.join(', ')}` };
  }
  const missing = want.filter((name) => !got.includes(name));
  if (missing.length > 0) {
    return { ok: false, reason: `presentation is missing requested claims: ${missing.join(', ')}` };
  }
  return { ok: true };
}
