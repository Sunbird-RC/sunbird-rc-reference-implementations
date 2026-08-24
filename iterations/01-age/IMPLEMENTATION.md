# Iteration 01 — Age Verification: implementation plan (revised after review)

**Status:** In progress — Step 0 done, Flow 1 blocked on an open escalation
**Supersedes:** the pre-review plan of 21 August 2026
**Charter:** [`CHARTER.md`](CHARTER.md) (revised)
**Review:** [`../../docs/reviews/ITERATION-01-FEEDBACK.md`](../../docs/reviews/ITERATION-01-FEEDBACK.md)
**Escalation:** [`../../docs/reviews/ESCALATION-01-oid4vc-authorization-code.md`](../../docs/reviews/ESCALATION-01-oid4vc-authorization-code.md)
**Evidence:** [`../../docs/evidence/01-age/`](../../docs/evidence/01-age/)

## Context

The first pass built a working Sunbird RC slice — issuance, SD-JWT selective
disclosure, cross-device OpenID4VP, APPROVED/DENIED, 39 unit + 28 e2e tests — and
the review returned **changes required**, because the *user journeys* the charter
now mandates were not demonstrated: no Keycloak authentication in the wallet, no
issuer list, no wallet-driven issuance, an issuance QR that "does not meet
requirement", no same-device mobile verifier, and no real-wallet consent evidence.

Anand recorded that Keycloak-authenticated wallet-driven issuance and same-device
verification "were not explicit requirements of the original approved Age
charter… and must not be described as failures against the earlier baseline". This
is scope growth on top of accepted foundations, not rework of a botched build.

Three journeys now define the iteration, each traced to acceptance and evidence:

| # | Journey | State |
|---|---|---|
| 1 | Authenticated wallet-driven issuance, **no QR** | Blocked — see escalation |
| 2 | Cross-device web verification by QR | Protocol accepted; needs the device run |
| 3 | Same-device mobile verification by deep link | Not started |

## Step 0 — Baseline, branch hygiene, escalation *(done)*

- Revised baseline merged into this branch; `CLAUDE.md`, PRODUCT, DESIGN and the
  charter here are now the authoritative inputs.
- Handshake-only files (`docs/start/*`) deleted so the proposed merge into `main`
  carries no handshake material. The *history* still contains those three
  commits; a **squash merge** would resolve that completely — Anand's call.
- Rejected work removed: `services/issuer-web/` deleted, `age-issuer` no longer
  renders a QR or lists citizens, and the verifier page no longer prints the
  `scripts/wallet.sh` aid.
- Escalation raised for the Flow 1 protocol gap, with the Age-database deviation
  attached for acknowledgement.

## The Flow 1 blocker, in one paragraph

Released `v2.1.0` cannot do wallet-driven issuance, and no configuration changes
it: issuer metadata hardcodes itself as the authorization server
(`oid4vci.service.ts:129`), it offers only the pre-authorised grant
(`token.service.ts:86-90`), and `/credential` accepts only tokens it minted itself
(`token.service.ts:58-79`). Nor is there any path from an authenticated subject to
claims — claims live in an offer session keyed by a pre-authorised code. The fix
is three small edits that already exist on the fork's `oid4vc_issuer` branch;
the escalation asks to port them onto the `v2.1.0` tag and run one non-release
image. That port is prepared on fork branch `oid4vc-keycloak-as-v2.1.0`
(11 suites / 127 tests passing) but **not adopted**. **Phases 1-6 do not start until that is answered.**

## Phase 0 — Wallet compatibility spike *(next, runs in parallel)*

Two days, throwaway stack, no production code. The retrospective asks for exactly
this: validate wallet compatibility before implementation, not at the demo.

**Wallet: Inji.** The only candidate whose stock UX *is* Flow 1 — it ships
`screens/Issuers/IssuersScreen.tsx` and `CredentialTypeSelectionScreen.tsx`, the
charter's steps 3-5. Paradym cannot do Flow 1 at all: no issuer directory, no
Keycloak journey, it only consumes offers. PRODUCT also wants Inji to complete at
least one full use case. Inji discovers issuers through **Mimoto**, so the spike
stands Mimoto up with a National Identity Authority entry in
`mimoto-issuers-config.json`.

Record versions and the exact protocol exchange for each:

| Interaction | Needed by | Pass criterion |
|---|---|---|
| Keycloak login inside Inji | 1 | Wallet authenticates a demo user |
| Issuer list + credential-type selection | 1 | NIA appears and is selectable |
| `authorization_code` fetch, no QR | 1 | Credential stored in the wallet |
| `vc+sd-jwt` receipt and rendering | all | Credential recognisable in the wallet |
| Cross-device QR presentation | 2 | Consent screen, then verified |
| Same-device deep link | 3 | Wallet opens from another app and returns |
| Draft-13 vs final metadata | all | Which `DRAFT13_COMPAT_MODE` Inji needs |

**Gate:** if the issuer-list journey or the same-device deep link fails on Inji,
stop and escalate before building anything.

## Phase 1 — Identity and mapping

Keycloak returns to the stack (its removal is one of the rejected items), with a
realm import, one demo user per synthetic citizen, and a protocol mapper putting
`citizenId` into the access token. The mapping is enforced **server-side**:
`KEYCLOAK_SUBJECT_CLAIM=citizenId` → `REGISTRY_SUBJECT_ENTITY=AgeCitizen`. The
wallet never names a citizen.

Files: `deploy/docker-compose.yml`, `deploy/keycloak/realm-age.json`,
`scripts/bootstrap.sh`, `deploy/env.example`, plus a mapping table in the evidence
pack.

## Phase 2 — Flow 1: wallet-driven issuance

Run `oid4vc-service` from the ported build; publish `authorization_servers`
pointing at Keycloak. Claim derivation moves into `oid4vc-service`
(`REGISTRY_BIRTHDATE_FIELD`); `services/age-issuer/src/age-claims.mjs` and its
unit tests stay as the reference implementation of the boundary rules.

Negative paths, each with a test: wrong password, authenticated-but-unmapped
account, and a request naming another citizen — all must fail with no credential.

Files: `deploy/docker-compose.yml`, `tests/e2e/issuance-authz.test.mjs`.

## Phase 3 — Flow 2: cross-device, on a real device

Pin the public HTTPS host **before issuing anything demoable** — it is baked into
every `did:web`, the `vct`, `iss` and `aud`, so changing it invalidates every
credential already issued. `services/verifier` and `services/verifier-web` stay as
accepted. Set the OpenID4VP mode Inji needs from Phase 0 and record it. The
acceptance artifact is the wallet's own consent screen.

## Phase 4 — Flow 3: same-device mobile verifier

A small installable Android app (React Native/Expo) rather than a mobile web page:
PRODUCT would permit "a lightweight application", but the charter says "app" and
this review has already rejected one substitution. Mobile web plus `openid4vp://`
is the fallback if the toolchain proves disproportionate — decided at the end of
Phase 0, with evidence.

The app builds its request **through `services/verifier`** and displays only what
that service decides; DESIGN forbids an independent trust path in the mobile UI.
The wallet returns via `direct_post` to the verifier service and the app polls its
session. Cancellation discloses nothing and approves nothing.

Files: `apps/mobile-verifier/` (new).

## Phase 5 — Security, privacy, open items

- **Enforce the algorithm policy for real:** surface the presentation's JWS `alg`
  in `/vp/status` in the ported build and enforce the ES256 allowlist in
  `services/verifier/src/core/trust.mjs`. Closes the review item that currently
  stands as a documented gap.
- **Age-database deviation** recorded for acknowledgement (attached to the
  escalation).
- Negative matrix extended to the new journeys — authentication failure, unmapped
  account, cross-citizen issuance — with the existing tamper / wrong issuer /
  wrong holder key / nonce / audience / expiry / replay set staying green.

## Phase 6 — Evidence, in three separate levels

The retrospective asks for this split explicitly:

| Level | Proves | Artifacts |
|---|---|---|
| Automated | technical behaviour | unit + e2e runs, scripted-wallet protocol coverage |
| Real component | the stack integrates | Keycloak, Mimoto, Sunbird RC versions and digests |
| **Real device** | **the required journeys** | recordings of all three flows on Inji, consent screens, credential still present after reopen + re-authenticate |

Plus exact versions (including our `oid4vc-service` build SHA), the
identity-mapping document, a running decision/deviation log, sanitised
minimum-disclosure evidence per channel, and pass/fail traceability from every
charter checkbox to an artifact.

## Verification

```bash
cd deploy && cp env.example .env && docker compose up -d   # registry ~1-4 min
../scripts/bootstrap.sh          # + Keycloak realm, Mimoto issuer config
../scripts/seed-age-citizens.sh
cd .. && npm install
npm run test:unit                # 39 passing
npm run test:e2e                 # 28 passing

# journeys, on a device against the pinned HTTPS host
#  1. Inji: login -> issuers -> National Identity Authority -> fetch -> stored
#  2. web verifier: scan, consent -> APPROVED; ineligible citizen -> DENIED
#  3. mobile verifier app -> deep link -> consent -> APPROVED/DENIED
#  4. close/reopen Inji, re-authenticate -> credential still present
#  5. negative: wrong password, unmapped account, cross-citizen, cancellation
```

## Decision log

| # | Decision | Status |
|---|---|---|
| 1 | Port `authorization_code` onto `v2.1.0` in the fork; run one non-release image | **Open — Anand** |
| 2 | Inji + Mimoto as the Age wallet | Kartheek; confirmed by Phase 0 |
| 3 | Flow 3 as an installable Android app, mobile web as fallback | Kartheek; Anand to nod |
| 4 | Enforce the algorithm allowlist in the ported build | Kartheek — agreed |
| 5 | Stay on `iteration/age-01-verification`; recommend a squash merge | Kartheek — agreed |
| 6 | Age boundary is a dedicated database, not a schema | Recorded for acknowledgement |
