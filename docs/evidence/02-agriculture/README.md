# Agriculture — Authority-backed showcase

The same credential, accepted and refused as its source record changes.

## The film

[**Agriculture-Authority-Showcase-22Sep.mp4**](Agriculture-Authority-Showcase-22Sep.mp4)
— 4 min 17 s, 720×1600, −16.0 LUFS.

What it shows, in order:

1. **Two authorities that share no database.** A Farmer Registry and a Land Registry, each
   with its own tenant and its own `did:web`, both answering on a public trust route.
2. **The farmer collects both credentials** at each registry's own sign-in page. They are
   held on the phone, not in a portal.
3. **A bank asks, and the farmer consents.** One presentation from two cards, with the
   purpose named — *applying for crop credit* — and cultivated area disclosed while the
   national identifier, the name and the holding size are not.
4. **Eligible.** Wheat, two acres, ₹80,000.
5. **The source record is suspended**, and nothing is sent to the phone or to the bank.
6. **The same unchanged credential is refused.** Every cryptographic check still passes;
   the refusal names the *source record* as suspended.
7. **Reinstated, and accepted again** — no reissue, nothing done in the wallet.
8. **The credential is revoked** by an issuing officer, and refused — while its record
   stays ACTIVE. A healthy record cannot rescue a revoked credential.

The distinction the film exists to draw: a **record** is suspended or inactivated, a
**credential** is revoked, and the two vocabularies are not interchangeable.

## What it does not claim

- **Not that issuer deactivation propagates.** Credential status is live; issuer trust is
  read once at verifier startup. See
  [the integration notes](../../authority-service-integration.md).
- **Not that the identifiers are permanent.** They are publicly resolvable *sandbox*
  identifiers, valid while the sandbox holds its address.
- **Not that any of it is real.** Every farmer, parcel and identifier is synthetic.

## How it works

[`docs/authority-service-integration.md`](../../authority-service-integration.md) covers
the derived status, the trust boundary and the bring-up order.
[`docs/showcase/use-cases/agriculture-rural-credit.md`](../../showcase/use-cases/agriculture-rural-credit.md)
is the adopter-facing walkthrough.

Every beat above is exercised by `tests/e2e/agriculture-status.test.mjs`. If a shot did not
behave as described, that test would have failed first.

## Earlier film

[Agriculture-Rural-Credit-Showcase-31Aug.mp4](Agriculture-Rural-Credit-Showcase-31Aug.mp4)
predates the Authority Service: no status check, nothing suspended, no lifecycle linkage.
It remains accurate for what it covers.

## What was removed, and where it went

The raw evidence, the production script, the superseded 21 September cut and the
evidence-capture tooling were removed from this directory: they were internal working
material and were never intended to be published.

**They remain in this repository's history and can still be retrieved from it.** Removal
stops them being presented, not stored. Rewriting shared history was considered and
rejected — it is disruptive and does not reliably remove copies already fetched, and none
of this material is a secret.
