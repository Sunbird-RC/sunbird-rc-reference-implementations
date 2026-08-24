# Iteration 01 — Age Verification: Implementation Plan

**Status:** Proposed — awaiting Kartheek's go-ahead
**Charter:** [`CHARTER.md`](CHARTER.md)
**Baselines:** [`PRODUCT.md`](../../docs/project/PRODUCT.md) · [`DESIGN.md`](../../docs/design/DESIGN.md) · [`COMPATIBILITY.md`](../../docs/design/COMPATIBILITY.md) · [`CLAUDE.md`](../../CLAUDE.md)

## Context

This repository is currently docs-only; no implementation exists. PRODUCT and DESIGN are approved and
Iteration 01 is the active charter.

**Product goal** (PRODUCT.md): demonstrate the full verifiable-credential lifecycle —
*Issue → Store → Request → Consent → Present → Verify → Decide* — proving that one reusable,
standards-aligned, privacy-preserving Sunbird RC foundation can serve independent domains, issuers,
wallets and verifier channels without rebuilding the platform per use case. Age is the first and
foundational vehicle: it establishes the issuer→wallet→verifier vertical slice that Agriculture
(multi-issuer, correlation) and Education (discovery/filtering, mobile verifier) later extend.

**Iteration 01 outcome:** a synthetic citizen receives an `AgeVerificationCredential` (SD-JWT VC) in
a real mobile wallet; a web verifier shows a QR; the wallet consents to disclosing **only
`ageOver18`**; the presentation is cryptographically verified; the page shows **APPROVED / DENIED** —
with the negative and privacy cases proven by automated tests.

### Grounding (verified, not assumed)

Checked against the local `v2.1.0` checkout at `../sunbird-rc-core` (tag `v2.1.0`, `2ade66c`) and the
existing stack at `../demo-oid4vc`:

| Need | Status in v2.1.0 native `oid4vc-service` |
|---|---|
| OpenID4VCI pre-authorised issuance | Available — `POST /oid4vc/offer` → `/token` → `/credential` (`services/oid4vc-service/README.md` §6.4) |
| `vc+sd-jwt` + selective disclosure | Available — `disclosable` defaults to all subject claims except `id` (`credentials-service/src/credentials/utils/credential-format.service.ts:106`) |
| Holder binding | Available — `cnf.jwk` from the wallet PoP, re-checked at presentation |
| OID4VP + QR + DCQL + `direct_post` | Available — `POST /vp/request` returns `qr_data` (`openid4vp://…`) |
| Signature / nonce / audience / holder-binding / revocation / DCQL checks | Available — `oid4vp.service.ts` returns a six-check map |
| Replay rejection | Available — `txn.status !== 'pending'` → `400 transaction not pending` (`oid4vp.service.ts:198`) |
| Official images | Available — `ghcr.io/sunbird-rc/{sunbird-rc-core,identity-service,credential-schema,credentials-service,oid4vc-service}:v2.1.0` |
| **Issuer trust allowlist** | **Missing** — `oid4vp.service.ts` verifies signatures but never *who* signed. We enforce it. |
| **Domain decision** | **By design ours** — `demo-oid4vc/verifier-app` calls `oid4vc-service` from the browser; deciding there would be a UI-only simulation, which CLAUDE.md forbids. |

**No standards adapter is required.** The only new code is the thin issuer-side and verifier-side
glue DESIGN §4 already specifies.

### Decisions confirmed with Kartheek

1. **Wallet:** **Paradym Wallet** for the device demo — already exercised against these APIs in the
   `../demo-oid4vc` stack for both credential collection (`issuer-portal/README.md:318,325`) and
   presentation (`oid4vc-service/README.md` §9.2: `vc+sd-jwt`, all six checks OK) — plus a
   `jose`-based scripted holder for automated evidence. EUDI Android is **not** needed. Inji remains
   for Agriculture.

   Paradym is Credo-based, which fixes three settings (see Step 1 and Step 3):
   `OID4VP_SIGN_REQUEST=true` (it requests the JAR as `application/oauth-authz-req+jwt`; an unsigned
   request answers **406**), a wallet-resolvable `did:web` verifier DID, and the DCQL format spelled
   `dc+sd-jwt`.
2. **Data layout:** registry runs against `jdbc:…/registry?currentSchema=age`, so `AgeCitizen` tables
   land literally in `age.*` per DESIGN §7.
3. **Scaffolding:** adapt `../demo-oid4vc` (compose topology, bootstrap/seed scripts, verifier UI
   patterns), stripped to Age and retargeted at **official ghcr `v2.1.0` images** — not the interim
   personal-Docker-Hub pins that repo warns about.
4. **Public exposure:** deferred to dev-deploy time. Everything derives from a single `PUBLIC_URL` in
   `.env`, so the stack is tunnel-agnostic; local automated tests run over http.

---

## Step 0 — Branch

Currently on `docs/first-handshake`. Create `iteration/age-01-verification` from the latest `main`
(per [`CLAUDE-START.md`](../../docs/start/CLAUDE-START.md) and GIT-WORKING-MODEL). No commits on
`main`.

## Target layout

```text
deploy/
  docker-compose.yml          # db, vault, redis, registry, identity, credential-schema,
                              # credential, oid4vc-service, age-issuer, verifier, verifier-web, nginx
  .env.example                # PUBLIC_URL drives issuer/aud/did:web everywhere
  registry.env                # adapted from ../demo-oid4vc/scripts/local-registry.env
  nginx/nginx.conf            # single origin :80 → /oid4vc /vp /registry /verifier /vct /contexts
  init-db/01-schemas.sql      # CREATE SCHEMA age, platform
registry-schemas/AgeCitizen.json
scripts/
  bootstrap.sh                # vault kv, did:web issuer, AgeVerificationCredential schema (idempotent)
  seed-age-citizens.sh        # deterministic synthetic citizens
  demo.sh                     # issue → QR → verify walkthrough
services/
  age-issuer/                 # reads AgeCitizen via registry API, derives ageOver18, creates offer
  verifier/                   # REUSABLE verifier service (iterations 2-3 extend this)
    src/core/                 # session, oid4vc client, trust allowlist, claim policy, normalisation
    src/domains/age/          # ageOver18 → APPROVED | DENIED  (the only Age logic in the tree)
  verifier-web/               # React QR page; talks ONLY to services/verifier
config/
  trust/issuers.json          # demo allowlist: issuer DID + algorithms (DESIGN §6)
tests/
  unit/                       # decision module, trust allowlist, claim policy
  e2e/                        # scripted holder wallet: positive + all negative/privacy cases
docs/evidence/01-age/         # versions, results, demo steps (no secrets)
```

Node/TypeScript for both new services, matching `demo-oid4vc` so its patterns port directly.

## Step 1 — Stack on official v2.1.0 images

Adapt `../demo-oid4vc/docker-compose.yml`, keeping its operational notes and dropping Keycloak, the
issuer portal, and the Agriculture/Education assets.

- **Registry:** `ghcr.io/sunbird-rc/sunbird-rc-core:v2.1.0`, `platform: linux/amd64`,
  `authentication_enabled=false`, `search_providerName=…NativeSearchService` (no Elasticsearch),
  `signature_enabled=false`, `oid4vc_enabled=false` — `age-issuer` calls `/oid4vc/offer` directly, so
  the registry's offer hook (and its documented missing-bearer-token gap) is never used.
  `connectionInfo_uri=jdbc:postgresql://db:5432/registry?currentSchema=age`. Keep the 240 s
  healthcheck `start_period`: a slow start under emulation is not a hang. Reuse
  `../demo-oid4vc/scripts/local-registry.env` — the registry resolves all ~84 placeholders before
  reading any feature flag, so an incomplete set aborts startup.
- **`oid4vc-service`:** `SESSION_STORE=redis`, `PUBLIC_URL=${PUBLIC_URL}`, and — required by Paradym —
  `OID4VP_SIGN_REQUEST=true` with `VERIFIER_DID` set to the bootstrapped `did:web`. Signing
  deliberately refuses a `did:rcw`, so the `did:web` is not optional here. Note this differs from
  `../demo-oid4vc`, whose compose defaults `OID4VP_SIGN_REQUEST=false`; do not copy that default.
- **nginx binds port 80 on purpose:** a port in `PUBLIC_URL` yields `did:web:localhost%3A8080:…` and
  silently breaks credential-type resolution.
- `STATUS_LIST_ENABLED=false` locally (revocation is out of scope) — recorded as a known limitation.

## Step 2 — Age issuer, schema and synthetic data

- `registry-schemas/AgeCitizen.json` — National Identity Authority source entity:
  `citizenId, name, dateOfBirth, gender, district, state`. Modelled on
  `../demo-oid4vc/registry-schemas/Farmer.json`.
- `scripts/bootstrap.sh`, adapting `../demo-oid4vc/scripts/bootstrap-local.sh` (which already encodes
  every footgun): Vault kv engine → mint the issuer **`did:web`** via
  `POST /did/generate {"method":"web"}` → create the credential schema with `status: PUBLISHED`,
  `additionalProperties: true`, `oid4vciConfig.oid4vciEnabled`, `oid4vciFormats: ["vc+sd-jwt"]`,
  `vct: ${PUBLIC_URL}/vct/age-verification-credential`, and a `display[].locale`. All four are
  non-obvious hard requirements; each fails opaquely if omitted.

  `AgeVerificationCredential` claims — all selectively disclosable, only `ageOver18` ever requested:

  | Claim | Purpose |
  |---|---|
  | `ageOver18` (bool) | the only claim the verifier requests; **derived at issuance** |
  | `ageOver21` (bool) | second derived assertion; makes the disclosure choice real |
  | `dateOfBirth` (string) | in the credential, **never disclosed** — this is what makes "no DOB" demonstrable |
  | `name` (string) | unrelated identity claim, never disclosed |

- `services/age-issuer`: `POST /issue-offer {citizenId}` → fetch the `AgeCitizen` through the
  **registry API** (never the tables — DESIGN §7) → derive `ageOver18`/`ageOver21` calendar-correctly
  → `POST /oid4vc/offer` with `credential_configuration_id` + claims → return the offer deep link and
  QR. Port the derivation from `../demo-oid4vc/issuer-portal/bff/claim-mapping.mjs`, whose `AGE_OVER`
  logic compares calendar dates rather than elapsed milliseconds (leap-year correct).
- `scripts/seed-age-citizens.sh`: deterministic synthetic citizens with fixed dates of birth,
  including an adult, a **minor on purpose** (the `DENIED` fixture), and a just-turned-18 boundary
  case.

## Step 3 — Reusable verifier service (`services/verifier`)

Server-side, generic, with Age isolated in one module. This is the component iterations 2–3 extend.

- `POST /api/sessions` → build the DCQL query → `POST /vp/request` → return `{sessionId, qr_data}`.
- `GET /api/sessions/:id` → `GET /vp/status/:id`, then, **in this order**:
  1. all six checks `OK` and `verified: true`, else reject;
  2. **trust allowlist** (`config/trust/issuers.json`): the presented `iss` must be an allowlisted
     issuer DID and the algorithm must be in the allowed set — this closes the gap v2.1.0 leaves;
  3. **claim policy:** the matched claim set must be exactly what was requested;
  4. only then call the domain module.
- `src/domains/age/decision.ts`: `ageOver18 === true → APPROVED`, else `DENIED`. It receives only
  verified, normalised claims — no raw presentation, no undisclosed claims.

DCQL request. Deliberately **no** `values` constraint on `ageOver18`: constraining it would turn a
legitimate minor into a *verification failure* instead of the charter's required `DENIED` decision.

```json
{"credentials":[{"id":"age_cred","format":"dc+sd-jwt",
  "meta":{"vct_values":["${PUBLIC_URL}/vct/age-verification-credential"]},
  "claims":[{"path":["ageOver18"]},{"path":["iss"]}]}]}
```

Three spellings that look like typos and are not: DCQL says **`dc+sd-jwt`** while the OID4VCI
credential format stays **`vc+sd-jwt`** (`dcql.service.ts` treats them as aliases, and Credo wallets
are strict about the DCQL one); `meta.vct_values` is **mandatory** for SD-JWT DCQL, without it the
query fails validation with `Invalid key: Expected "meta"`; and the request must be signed for
Paradym.

> **Spike to confirm first (~30 min).** `/vp/status` returns only DCQL-*matched* claims
> (`dcql.service.ts` → `matched`), so `iss` must arrive via that `["iss"]` claim path.
> `extractCredentials()` merges the SD-JWT JWS payload (which carries `iss`) with the disclosures, so
> it should resolve. If it does not, enforce trust by having `services/verifier` re-verify the
> presented credential against the allowlisted issuer DID before deciding — **never** by trusting
> `vct` alone, since any issuer can mint the same `vct`.

## Step 4 — Web verifier UI (`services/verifier-web`)

Adapt `../demo-oid4vc/verifier-app` (QR panel, stepper, countdown, status pill, result panel — about
1,000 lines of working UI). Two changes: it talks only to `services/verifier`, and it renders
**APPROVED/DENIED** with the check map and the disclosed-claim list — no DOB, no name, no raw
presentation.

## Step 5 — Tests, each mapped to a charter criterion

A scripted holder wallet (`jose`, mirroring the `oid4vc-service` README §9.1 harness) drives issuance
and presentation, so tests are wallet-independent and CI-able. It is also the **only** way to prove
minimum disclosure: `/vp/status` shows only matched claims, so the assertion must be made against the
raw presentation the harness builds.

| Test | Charter criterion |
|---|---|
| Adult → issue → present → `APPROVED`, all six checks OK | positive flow |
| Presentation carries **exactly one** disclosure (`ageOver18`); no DOB/name/gender bytes present | minimum disclosure / no undisclosed claims |
| Minor (`ageOver18=false`) → verified but `DENIED` | valid false → DENIED |
| Holder never responds / session expires → no claims, no approval | denial does not approve |
| Tampered SD-JWT payload; tampered disclosure value | tampering rejected |
| Credential from a non-allowlisted issuer DID (a second `did:web`) | wrong issuer / allowlist |
| VP signed by a key other than `cnf.jwk` | wrong holder key |
| Wrong `nonce`; wrong `aud`/`client_id` | nonce / audience |
| Expired transaction (`VP_TXN_TTL`); replay of a verified `state` | expiry / replay |
| Reused `pre-authorized_code` | single-use offer |
| Unit: decision truth table, allowlist, claim policy | decision-logic coverage |
| Only `age.*` exists and holds `AgeCitizen` | data isolation |

Also run `../sunbird-rc-core/services/oid4vc-service/oid4vc-service.postman_collection.json` through
`newman` against our stack as an upstream conformance signal.

## Step 6 — Device run and evidence

Local automated suite first; then the Paradym run against the dev deployment once the public HTTPS
host is chosen. `PUBLIC_URL` is the only thing that changes — but note that changing the host
invalidates every `did:web` and every already-issued credential, so pin it before issuing demo
credentials. Paradym makes the HTTPS host load-bearing twice over: it must resolve the issuer
`did:web` to accept the credential, and the verifier `did:web` to accept the signed request object.
Capture the consent screen and the APPROVED page; never log raw credentials, presentations, codes,
tokens or holder identifiers.

`docs/evidence/01-age/` records image digests, the Paradym app version/build, compatibility flags used
(`OID4VP_SIGN_REQUEST=true`, `DRAFT13_COMPAT_MODE=false`), the acceptance checklist with pass/fail,
test output, demo steps and known limitations.

## Verification

```bash
cd deploy && cp .env.example .env && docker compose up -d      # registry needs ~2-4 min
../scripts/bootstrap.sh && ../scripts/seed-age-citizens.sh     # idempotent, re-runnable
npm test --workspaces                                          # unit
npm run test:e2e                                               # scripted-wallet suite (table above)
npx newman run ../../sunbird-rc-core/services/oid4vc-service/oid4vc-service.postman_collection.json
open http://localhost/verifier                                 # QR → wallet → APPROVED/DENIED
./scripts/demo.sh                                              # scripted positive + negative walkthrough
```

Done when every charter checkbox passes from a clean checkout using these commands, negative and
privacy cases included.

## Known gaps to record (not blockers)

- **No issuer allowlist in v2.1.0's verifier** — closed in `services/verifier`, as DESIGN §4 and §6
  already require. Worth an upstream note.
- `ENABLE_AUTH=false` on the local stack. The dev deployment can turn it on precisely because we do
  not use the registry offer hook, which is the caller that cannot send a bearer token.
- `STATUS_LIST_ENABLED=false`, so `revocation: OK` is a default rather than a real check. Out of scope
  per PRODUCT, but it must not be presented as verified revocation.
- `did:web` on localhost is not externally resolvable; third-party verification of the issuer DID
  needs the HTTPS deployment.
- Wallet choice deviates from COMPATIBILITY's *candidate* Age wallet (EUDI Android) in favour of
  Paradym. That document explicitly leaves wallet selection to Kartheek, so this is a recorded
  engineering decision, not a baseline change. Worth noting in the handoff that upstream's own
  evidence (`oid4vc-service/README.md` §9.2) covers Paradym in the **presentation role only** —
  credential *collection* into Paradym is evidenced locally by the `../demo-oid4vc` round-trip, so
  Step 2 must re-confirm OpenID4VCI issuance into Paradym on our stack before the demo, rather than
  inheriting it.

## Escalation

Nothing here changes Product, Design, scope, privacy guarantees or interoperability commitments, so
no escalation to Anand is needed to begin. One interpretation to state in the handoff rather than
ask about: DESIGN §7's `platform.*` schema — protocol transaction state lives in Redis (single-use
codes and nonces, per COMPATIBILITY guidance) and the identity/credential/credential-schema services
keep their own databases, so `platform.*` stays empty in Iteration 01.
