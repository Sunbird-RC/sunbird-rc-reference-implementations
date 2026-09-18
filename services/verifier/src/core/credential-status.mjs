// Does the issuing Authority still stand behind this credential?
//
// Sunbird RC v2.1.0's verifier proves a signature is valid. It does not answer whether the
// credential is still good: the `revocation` check in a v2.1.0 verification result reports OK
// without consulting anything, which is worse than no check because it reads like one.
//
// The Authority Service publishes a derived status — the credential's own state combined with
// the current lifecycle of the record it was issued from — so suspending a source record
// changes what a verifier is told without the credential being reissued or revoked.
//
// Deliberately NOT a general status-list client. This resolves one identifier against one
// configured Authority Service and returns a decision.

/** Statuses a business rule may proceed on. Everything else stops it. */
const USABLE = new Set(['ACTIVE']);

/**
 * @param {{fetchImpl?: typeof fetch, timeoutMs?: number}} [config]
 */
export function credentialStatusChecker({ fetchImpl = fetch, timeoutMs = 4000 } = {}) {
  return {
    /**
     * @param {unknown} credentialId The credential's own identifier at its Authority.
     * @param {string} baseUrl The Authority Service that vouched for the credential's
     *        ISSUER, taken from the trust policy. Never from the credential: a status
     *        endpoint a credential could choose is a status endpoint an attacker can choose.
     * @returns {Promise<{ok: true, status: string, effectiveAt?: string}
     *                  | {ok: false, reason: string, status?: string}>}
     */
    async check(credentialId, baseUrl) {
      if (typeof credentialId !== 'string' || credentialId.length === 0) {
        // Not "no identifier, therefore fine". A credential this verifier cannot look up is
        // one whose current standing is unknown, and unknown is not a pass.
        return { ok: false, reason: 'credential carried no identifier to check' };
      }
      if (!baseUrl) {
        return { ok: false, reason: 'no Authority Service configured to check status against' };
      }

      const url = `${baseUrl.replace(/\/$/, '')}/api/v1/trust/credentials/${encodeURIComponent(credentialId)}/status`;
      let response;
      try {
        response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      } catch (cause) {
        // Fail closed. An unreachable Authority is indistinguishable from one that would
        // have said REVOKED, and the difference matters too much to guess.
        return { ok: false, reason: `could not reach the issuing Authority: ${cause.message}` };
      }

      if (response.status === 404) {
        // The route answers 404 for both "no such credential" and "nothing published about
        // it", deliberately, so that it cannot be used to enumerate credential identifiers.
        return { ok: false, reason: 'the issuing Authority does not recognise this credential' };
      }
      if (!response.ok) {
        return { ok: false, reason: `the issuing Authority answered ${response.status}` };
      }

      let body;
      try {
        body = await response.json();
      } catch {
        return { ok: false, reason: 'the issuing Authority returned an unreadable status' };
      }

      const status = typeof body?.status === 'string' ? body.status : '';
      if (!status) return { ok: false, reason: 'the issuing Authority returned no status' };
      if (!USABLE.has(status)) {
        // Named rather than collapsed to "not valid": SUSPENDED and REVOKED mean different
        // things to a person reading a refusal, and one of them may be temporary.
        return { ok: false, reason: `the issuing Authority reports this credential ${status}`, status };
      }
      return { ok: true, status, effectiveAt: body?.effectiveAt };
    },
  };
}
