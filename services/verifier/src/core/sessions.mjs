// Verifier-side transaction state.
//
// Short-lived and in-memory on purpose: DESIGN requires that presentation
// transactions not accumulate into a durable central history of holder activity.
// Nothing here is written to disk, and the record is dropped when it expires.
//
// Single-use is enforced upstream — oid4vc-service rejects a second response for
// the same transaction with 'transaction not pending' — so this store only has
// to stop serving a session once it has expired.

export function sessionStore({ ttlSeconds = 300, now = () => Date.now() } = {}) {
  /** @type {Map<string, {id: string, requestId: string, expectedClaims: string[], expiresAt: number, qrData: string}>} */
  const sessions = new Map();

  function sweep() {
    const cutoff = now();
    for (const [id, session] of sessions) {
      if (session.expiresAt <= cutoff) sessions.delete(id);
    }
  }

  return {
    create(session) {
      sweep();
      const record = { ...session, expiresAt: now() + ttlSeconds * 1000 };
      sessions.set(session.id, record);
      return record;
    },
    get(id) {
      sweep();
      return sessions.get(id);
    },
    get size() {
      sweep();
      return sessions.size;
    },
    ttlSeconds,
  };
}
