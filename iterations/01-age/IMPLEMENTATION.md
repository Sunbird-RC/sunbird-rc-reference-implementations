# Iteration 01 — Age Verification: implementation plan

**Status:** Approved scope, in progress. Flow 1 unblocked.
**Supersedes:** the plan of 24 August 2026, written while the Flow 1 gap was open
**Charter:** [`CHARTER.md`](CHARTER.md)
**Review:** [`../../docs/reviews/ITERATION-01-FEEDBACK.md`](../../docs/reviews/ITERATION-01-FEEDBACK.md)
**Questions and answers:** [`../../docs/reviews/QUESTIONS-01-age-for-anand.md`](../../docs/reviews/QUESTIONS-01-age-for-anand.md) · [`../../docs/reviews/ANSWERS-01-age-from-anand.md`](../../docs/reviews/ANSWERS-01-age-from-anand.md)
**Compatibility:** [`../../docs/design/COMPATIBILITY.md`](../../docs/design/COMPATIBILITY.md)

## Context

The first pass built a working Sunbird RC slice; the review returned **changes
required** because the *user journeys* were not demonstrated. Anand has now
answered the eleven open questions and amended PRODUCT, DESIGN and the charter to
match. Flow 1 is approved with controls, so the iteration is unblocked.

Three of his answers overturn work already committed here, and this plan starts by
correcting them rather than leaving them to be found at review:

| His decision | What it invalidates |
|---|---|
| One PostgreSQL database, separation by use-case tables | our dedicated `age` database and its isolation tests |
| No committed passwords or secrets | the planned realm export with fixed demo passwords |
| The mobile verifier must be an installed app | the mobile-web fallback we were holding |

## Decisions now settled

| # | Decision | Source |
|---|---|---|
| 1 | Keycloak-backed `authorization_code` added inside `oid4vc-service` on a pinned fork build; **optional and configurable**; pre-auth unchanged by default; both grants regression-covered; narrow scope; upstream contribution prepared | answer 1, DESIGN decision 6 |
| 2 | Issuer discovery via the wallet's companion configuration, limited to discovery only. Age lists **only** the National Identity Authority | answer 2, DESIGN "Issuer Discovery" |
| 3 | Demo starts from pre-created synthetic accounts. Enrolment out of scope. **No credentials committed** | answer 3 |
| 4 | Either Keycloak arrangement — wallet-to-Keycloak, or issuer redirects to Keycloak. Record which and why | answer 4 |
| 5 | Mobile verifier is a **separately installed app**; a web page is not sufficient | answer 5 |
| 6 | One continuous recording per journey, to a fixed shot list, with secrets redacted | answer 6 |
| 7 | Returning citizen: show **both** local persistence and survival of a fresh Keycloak session | answer 7 |
| 8 | Cross-citizen protection proven by an automated test, including absence from logs | answer 8 |
| 9 | Age wallet reassignment accepted; spike first, then record version/profile | answer 9 |
| 10 | **One PostgreSQL database**, independent non-overlapping tables per use case, no shared person table | answer 10, PRODUCT + DESIGN |
| 11 | Keep this branch and its history; squash merge only after demos, evidence, closure and sign-off | answer 11 |

### One interpretation recorded for acknowledgement

DESIGN lists "protocol transaction and non-domain configuration tables" among the
groups inside the one database. Read strictly that would move identity-service,
credentials-service and credential-schema into the domain database, which is not
safely possible: each is a separate Prisma service and each owns a
`_prisma_migrations` table, so they would share and overwrite one another's
migration state.

We therefore read the rule as governing **use-case/domain data** — every rule
written under it concerns domain data — and keep the protocol services' own stores
as internal implementation detail. Flagged for Anand's acknowledgement; the Age
migration below is identical either way, so nothing waits on it.

## Step A — Baseline documents *(his stated first task)*

This plan, plus `COMPATIBILITY.md` revised: Age wallet reassignment, the
installed-app requirement, the fork addition recorded as approved-but-not-released,
and the open nonce-sourcing finding. The escalation stays as the record of how
decision 1 was reached.

## Step B — One database, separation by tables

Reverses our earlier per-domain database. The original `?currentSchema=age` finding
still stands and now stops mattering: separation is by entity name, which the
registry does naturally (`V_AgeCitizen`).

- Registry JDBC back to the shared database; `CREATE DATABASE age` removed.
- `tests/e2e/data-isolation.test.mjs` rewritten to assert what is now required:
  Age entity tables present, **no shared cross-domain person table**, no overlap
  between use-case tables, correlation only in explicit fixtures. Stronger than
  before — these are the assertions that will matter when Agriculture lands.
- Verified on a clean stack so the old database is gone.

## Step C — The port, to his controls

Already true, and verified on the branch: opt-in by construction
(`KEYCLOAK_PUBLIC_URL` absent means off), issuer metadata advertises only itself
when the capability is off, and tests assert realm tokens are *not* trusted when
unconfigured.

Outstanding:

- Remove the per-format signing-algorithm change carried over from the older fork
  branch — a real improvement, but unrelated to `authorization_code`, and he said
  not to include unrelated changes.
- Keep the `/vp/status` algorithm reporting as its own change, justified by his own
  earlier review item ("enforce the approved algorithm policy"), since the policy
  cannot be enforced while the algorithm is unobservable. Raised explicitly rather
  than folded into the port.
- Add the dual-grant regression test: pre-authorised issuance still succeeds **with
  Keycloak enabled**. Existing coverage proves it with Keycloak off.
- Pin source commit and image digest; record the deviation and removal path;
  prepare the upstream contribution.

## Step D — Demo accounts without committed secrets

Passwords generated during bootstrap or read from gitignored local configuration,
printed once for the operator. The realm import carries users and the `citizenId`
attribute mapping, never credentials. Evidence shows the account-to-citizen mapping
with no passwords or tokens in it.

## Wallet: what the build needs

The wallet is `pallakartheekreddy/paradym-wallet@v1.0.3`, which already carries the
wallet half of Flow 1: an issuer directory, the browser sign-in step, and the
preview-then-approve screen before anything is stored. Nothing in the wallet needs
writing — only configuring.

**One build-time variable.** `apps/wallet/app.config.js` reads
`CREDENTIAL_ISSUER_URLS` (comma-separated) into `extra.credentialIssuerUrls`, and
the directory hides itself when the list is empty. So the build is pointed at our
stack by setting that to the stack's public base URL, with Kartheek's usual Expo
build command.

**No tunnel needed for the spike.** `apps/wallet/src/app/_layout.tsx` calls
`allowInsecureOpenId4VcUrlsForDevelopment()` under `if (__DEV__)`, which its own
comment describes as being for "a docker-compose stack on the LAN". A dev build can
therefore talk to `http://<lan-ip>` directly.

**The risk that flag may not cover.** Our issuer identity is a `did:web`, and that
method mandates https. The flag relaxes the OID4VC libraries' URL validation; it
may not extend to Credo's DID resolver, which would try
`https://<lan-ip>/<uuid>/did.json` and fail when the credential is verified. If
that happens, the fallback is the host already registered in the wallet's redirect
URIs (`98.70.36.106.sslip.io`), which implies HTTPS is already available there.
First thing to observe in the spike.

**Redirect URI must match.** The wallet sends `allowedRedirectBaseUrls[0]`, which
is `https://98.70.36.106.sslip.io/wallet/redirect` today. The Keycloak client in
`deploy/keycloak/realm-age.json` lists that plus the app-scheme form. If a
different host is used for the spike, its `/wallet/redirect` must be added there
too, or the sign-in completes and the wallet never receives the code.

## Step E — Wallet compatibility spike *(before building the journeys)*

Prove and record: sign-in inside the wallet; issuer list showing only the National
Identity Authority; direct fetch with no QR; credential rendering; cross-device QR
presentation; same-device deep link; and which metadata/compatibility mode the
wallet needs. First item is the nonce-sourcing finding in COMPATIBILITY, because it
decides the Keycloak arrangement.

## Step F — The three journeys

1. **Identity:** Keycloak in the stack, one demo account per synthetic citizen,
   `citizenId` exposed as a token claim, mapping enforced server-side.
2. **Flow 1:** wallet signs the citizen in, lists the issuer, fetches the
   credential. No QR, no issuer page. Negative paths as tests: wrong password,
   unmapped account, manipulated citizen identifier.
3. **Flow 2:** cross-device QR on a device. Pin the public HTTPS host *before*
   issuing anything demoable — it is baked into the issuer identifier and the
   credential type, so changing it invalidates credentials already issued.
4. **Flow 3:** installed Android app, built on `services/verifier`, displaying only
   what that service decides. Android because the wallet is Android — an
   engineering decision, recorded.

## Step G — Evidence

| Level | Proves | Artifacts |
|---|---|---|
| Automated | technical behaviour | unit + e2e suites, scripted-client protocol coverage |
| Real component | the stack integrates | Keycloak, companion config, Sunbird RC versions and digests |
| **Real device** | **the required journeys** | one continuous recording per journey, to his shot list |

Plus: exact versions including the fork build's commit and image digest; the
account-to-citizen mapping; a running decision and deviation log; sanitised
minimum-disclosure evidence per channel; and pass/fail traceability from every
charter checkbox to an artifact.

## Verification

```bash
./scripts/verify.sh                       # repo, stack and fork state, plus the suites
npm run test:unit && npm run test:e2e
cd ../sunbird-rc-core/services/oid4vc-service && npx jest
```

Then the spike, then the three journeys with recordings.

## Open with Anand

- Acknowledge the protocol-store interpretation above.
- The `/vp/status` algorithm reporting: confirm it is wanted as a separate change,
  since it is what makes the algorithm policy enforceable.
