# Iteration 01 — Age Verification: evidence

**Status:** implemented and verified end to end on a laptop stack. The on-device
run with Paradym is the one criterion still outstanding.
**Branch:** `iteration/age-01-verification`
**Charter:** [`../../../iterations/01-age/CHARTER.md`](../../../iterations/01-age/CHARTER.md)
**Plan:** [`../../../iterations/01-age/IMPLEMENTATION.md`](../../../iterations/01-age/IMPLEMENTATION.md)
**Verified:** 24 August 2026

This is the handoff artifact. Anything not marked verified has not been run.

## What was built

| Component | Path | Role |
|---|---|---|
| Local stack | `deploy/` | Sunbird RC `v2.1.0` from `ghcr.io/sunbird-rc/*`, plus Postgres, Vault, Redis and a single-origin nginx |
| Age source data | `registry-schemas/AgeCitizen.json` | National Identity Authority entity; the only source of credential claims |
| Issuer counter | `services/age-issuer/` | Reads the registry through its API, derives `ageOver18`/`ageOver21`, creates a pre-authorised OpenID4VCI offer |
| Verifier service | `services/verifier/` | Generic: checks gate → disclosure policy → issuer trust allowlist → domain decision. Age is one module (`src/domains/age/`) |
| Verifier page | `services/verifier-web/` | Static, Sunbird Spark themed. Shows the QR and the decision; talks only to the verifier service |
| Trust allowlist | `config/trust/issuers.json` | Version-controlled demo trust model (DESIGN §6) |
| Tests | `tests/unit`, `tests/e2e` | 39 unit + 24 end-to-end |

**No standards adapter was needed.** Sunbird RC `v2.1.0`'s native `oid4vc-service`
covered OpenID4VCI issuance, `vc+sd-jwt` selective disclosure, holder binding,
OpenID4VP with DCQL and QR, and single-use transaction state — confirmed by the
run, not just by reading the source.

## Versions

Pinned tags with the digests this evidence was produced against:

| Component | Tag | Digest |
|---|---|---|
| `sunbird-rc-core` (registry) | `v2.1.0` | `sha256:8ea8cf87caf402cec92af276dc5c5bff8dc321ab75023693b558d12cc76b8859` |
| `identity-service` | `v2.1.0` | `sha256:f6697e181a19f9862f2925cfe8e9ed006fa19616d16ce0ffddcb00f0418024ff` |
| `credential-schema` | `v2.1.0` | `sha256:0f69ac5c3a1e7f6164204a79555e3dd12e3fa56074593c2f9c560bdc9763935d` |
| `credentials-service` | `v2.1.0` | `sha256:51240b2fd5786d2cd034bdcac485352fd5b86e012584095f413aa902e7885b5c` |
| `oid4vc-service` | `v2.1.0` | `sha256:63d395a1e99357fb450da96aeb57bd1ea0e9d5152ddec40de60d1069e162af1e` |
| `postgres` | `14` | `sha256:2fdfb9b432d4a73bd3eea3d989752c1e669b68d502347e0bfd2cc6d709f3d6b4` |
| `hashicorp/vault` | `1.13.3` | `sha256:5eba321fbeb624163a45c1aee5379caf6ec16fe6f644cc89f203a209eafba5eb` |
| `redis` | `7-alpine` | `sha256:ff02b58f971e7d7d156a1267e283fcbbeee91773b6aa36c49dac28ecfe28eadf` |
| `nginx` | `alpine` | `sha256:db35bfc6b2951e7f8a72db5db120288c127ffaeeb4a6d4b95a26fead017d5913` |
| Services + tests | `node:22-alpine` (images), Node 25.6.1 (host) | — |
| Wallet — scripted | `jose` 6.1.0 | — |
| Wallet — device | Paradym Wallet | **pending the on-device run** |

Source of truth for released behaviour: local checkout of `sunbird-rc-core` at
tag `v2.1.0` (`2ade66c`).

## Configuration that matters

| Flag | Value | Why |
|---|---|---|
| `OID4VP_SIGN_REQUEST` | `true` | Paradym is Credo-based: it fetches the request object as `application/oauth-authz-req+jwt` and answers **406** to an unsigned one |
| `VERIFIER_DID` | minted `did:web` | Signing refuses a `did:rcw`, which no third-party wallet can resolve |
| `DRAFT13_COMPAT_MODE` | `false` | Final OpenID4VCI 1.0. Draft-13 is Inji's idiom, for Iteration 02 |
| `SESSION_STORE` | `redis` | Single-use codes and nonces must survive a restart for the replay tests to mean anything |
| `STATUS_LIST_ENABLED` | `false` | Revocation infrastructure is out of scope (PRODUCT) |
| `ENABLE_AUTH` | `false` | No Keycloak in this stack; `age-issuer` is the only caller of `POST /oid4vc/offer` |
| `authentication_enabled` (registry) | `false` | Same reason |
| `search_providerName` | `NativeSearchService` | No Elasticsearch in the stack |
| `AGE_REGISTRY_JDBC` | `jdbc:postgresql://db:5432/age` | The Age domain's own database — see deviation 2 |

Three identities are minted, all `did:web`:

| Identity | Role |
|---|---|
| National Identity Authority | Issues the credential; its DID is the credential `iss` and the single allowlist entry |
| Age-restricted service | The **verifier's** DID, used to sign OID4VP request objects. A separate party deserves a separate key |
| Unlisted issuer | Publishes the same credential type from an untrusted DID, so "wrong issuer" is tested with a cryptographically **valid** credential |

## Credential design

`AgeVerificationCredential`, `vc+sd-jwt`, ES256, every claim selectively disclosable:

| Claim | Derived? | Disclosed to the age verifier |
|---|---|---|
| `ageOver18` | yes, at issuance from `dateOfBirth` | **yes — the only one requested** |
| `ageOver21` | yes, at issuance | no |
| `dateOfBirth` | copied from the registry | no |
| `name` | copied from the registry | no |

`dateOfBirth` and `name` are in the credential on purpose: a credential holding
only the answer would make selective disclosure untestable, because "nothing
leaked" would just mean "there was nothing to leak". The e2e suite asserts both
halves — that the credential *can* disclose four claims, and that exactly one
travels.

DCQL requests `ageOver18` plus the protocol claim `iss`, pins the type through
`meta.vct_values`, and puts **no `values` constraint** on the age claim:
constraining it to `true` would turn a legitimate minor into a verification
*failure* instead of a verified **DENIED**.

## Test results — executed

```
$ npm run test:unit
tests 39   pass 39   fail 0

$ npm run test:e2e
tests 24   pass 24   fail 0     (6 consecutive clean runs)
```

Unit coverage: calendar-correct age derivation (18th-birthday boundary,
leap-day births, month boundaries), rejection of impossible dates and of records
with no date of birth, the decision truth table including the `"false"`-is-truthy
trap, the trust allowlist (unexpanded `${VAR}` is a startup failure, not a
wildcard), DCQL minimality, the verification gate treating a *missing* check as a
failure, and session expiry.

End-to-end, against the real protocol with a scripted holder wallet: issuance
into the wallet, holder binding via `cnf.jwk`, minimum disclosure asserted
against the raw presentation, APPROVED/DENIED decisions, the boundary and
leap-day fixtures, and ten negative cases.

### Scripted demo

`./scripts/demo.sh` — all four cases behaved as expected:

| Case | Result |
|---|---|
| Adult | **APPROVED**, seven checks OK |
| Minor | **DENIED**, seven checks OK — a verified refusal, not a failure |
| Tampered disclosure | rejected, HTTP 403 from the stack |
| Unlisted issuer, valid signature | seven checks OK, rejected by the **trust allowlist** |

The last row is the one worth reading twice: every cryptographic check passes and
the presentation is still refused, because the issuer is not on the allowlist.

### Browser

`http://localhost/verifier/` was driven in Chrome for both outcomes: **APPROVED**
(`ageOver18 = true`) and **DENIED** (`ageOver18 = false`), each showing the issuer
name, the single disclosed claim, the withheld claims struck through, and all
seven checks as pass pills. The decision is computed server-side; the page only
renders it.

## Acceptance checklist

### Positive flow
- [x] A synthetic eligible citizen receives an `AgeVerificationCredential` in a wallet
- [x] The wallet scans the web verifier's QR request
- [~] The wallet shows that only `ageOver18` is requested and obtains consent — *protocol verified; the consent **screen** needs the Paradym device run*
- [x] The wallet presents `ageOver18 = true` without unrelated identity claims
- [x] The verifier validates the presentation and displays **APPROVED**

### Negative and privacy flows
- [x] A valid `ageOver18 = false` presentation returns **DENIED**
- [x] User denial/cancellation discloses nothing and does not approve
- [x] Tampered credential and tampered disclosure are rejected
- [x] An issuer outside the allowlist is rejected, with a cryptographically valid credential
- [x] Wrong holder key is rejected
- [x] Incorrect nonce and incorrect audience are rejected
- [x] Expired/unknown transaction and replayed presentation are rejected
- [x] Verifier output carries no undisclosed identity claims, and no holder identifier
- [x] A pre-authorised code cannot be redeemed twice

### Engineering evidence
- [x] A clean checkout starts the stack with documented commands — *proven by three full `down -v` rebuilds*
- [x] Automated tests cover the decision logic and the required verification failures
- [x] Integration tests cover the issuance and presentation endpoints
- [x] Use-case data remains logically separated (`tests/e2e/data-isolation.test.mjs`)
- [x] Versions, configuration mode and limitations recorded
- [ ] Paradym device run: consent screen, and OpenID4VCI collection on this stack
- [ ] Kartheek demonstrates the flow to Anand

## Reproducing

```bash
cd deploy && cp env.example .env && docker compose up -d   # registry ~1-4 min
../scripts/bootstrap.sh          # Vault kv, three did:web identities, schemas
../scripts/seed-age-citizens.sh  # synthetic citizens
cd .. && npm install
npm run test:unit
npm run test:e2e
./scripts/demo.sh
open http://localhost/verifier/
```

## Defects found by running it

Recorded because each one would have passed a code review:

1. The Postgres init script was mounted as `.sh` and failed with
   `/bin/bash: bad interpreter: Permission denied` — and the entrypoint carried
   on and started the server. The extra databases and the Age namespace were
   silently never created. Now plain `.sql`, which psql runs directly.
2. `?currentSchema=age` does nothing for the registry (see deviation 2).
3. `bootstrap.sh`'s `mint_did` printed status to stdout, which is the DID being
   captured by `$(...)` — so an ANSI-coloured sentence ended up in `.env`, in the
   schema `author`, and in the trust allowlist. The verifier reported one trusted
   issuer and trusted nobody real. Status now goes to stderr, and a value that is
   not a `did:web` is fatal.
4. `set_env` used a grep alternation with an empty branch, which BSD grep rejects
   (`empty (sub)expression`); the `|| true` then truncated `.env` and took the
   DIDs with it.
5. nginx waited on verifier health, but the verifier fails closed without a trust
   DID that `bootstrap.sh` mints *through nginx* — a first-run deadlock on a
   clean checkout. nginx now waits only for the service to start, which is safe
   because every `proxy_pass` resolves per request.
6. `[hidden]` was overridden by `.panel { display: grid }`, so the result panel
   was visible before any check had run.

## Known limitations and deviations

1. **v2.1.0's verifier does not check issuer identity.** Its checks cover
   signature, nonce, audience, holder binding, revocation and DCQL — never
   *whose* signature. `services/verifier` enforces the allowlist, as DESIGN §4
   and §6 require. Demonstrated by the demo's case 4. Worth reporting upstream.
2. **The Age namespace is a database, not a schema.** DESIGN §7 says `age.*`
   schemas. The registry exposes only a JDBC URI (`connectionInfo_uri`) and
   leaves table placement to Sqlg, which puts unqualified vertex labels in
   `public`: with `?currentSchema=age` the run produced `public.V_AgeCitizen` and
   an empty `age` schema. There is no supported setting for it, so the boundary
   is a dedicated `age` **database** — stronger isolation, still one PostgreSQL
   deployment, and Agriculture/Education get their own the same way. The intent
   of §7 holds; the mechanism differs. **Flagged for Anand's awareness.**
3. **The algorithm allowlist is absent by decision.** A presentation's JWS `alg`
   is not observable through `/vp/status`, so a policy field for it would be a
   control that does nothing — the trap upstream calls out for `tx_code`. The
   constraint holds by construction (identity-service signs SD-JWT VCs with
   ES256) and is recorded here instead of being faked in code.
4. **`revocation: OK` is a default, not a check** (`STATUS_LIST_ENABLED=false`).
   Out of scope per PRODUCT; must not be presented as verified revocation.
5. **`did:web` on localhost is not externally resolvable.** The method mandates
   https; identity-service resolves its own DIDs from its database, so local
   flows work. A phone needs the HTTPS host, and `PUBLIC_URL` must be pinned
   before any demo credential is issued — changing it invalidates every `did:web`
   and every credential already issued.
6. **`platform.*` stays empty.** Protocol transaction state lives in Redis and
   each protocol service keeps its own database.
7. **Turning on `ENABLE_AUTH` will require a token in the verifier service.**
   `POST /vp/request` and `GET /vp/status/:id` carry `@UseGuards(KeycloakAuthGuard)`
   — a no-op at `ENABLE_AUTH=false`, but on the dev deployment `services/verifier`
   will need a `client_credentials` token for both. The posture is otherwise
   ready: we never use the registry offer hook, which is the caller that cannot
   send one.
8. **Wallet choice deviates from COMPATIBILITY's candidate** (EUDI Android) in
   favour of Paradym, which is already exercised against these APIs. That document
   leaves wallet selection to Kartheek. Upstream evidence covers Paradym for
   *presentation* only; collection is evidenced by the `demo-oid4vc` round-trip on
   an interim image, so issuance into Paradym must be re-confirmed on this stack.
9. **The verifier page is static, not the React app** the plan mentioned adapting
   from `demo-oid4vc/verifier-app`. It needs no build step, so the stack builds
   offline; the Sunbird Spark theme is applied directly (see below).
10. **One unexplained e2e failure.** A single run failed on
    `the credential is holder-bound…` while a browser session was concurrently
    polling the verifier; it did not reproduce in six subsequent runs, alone or in
    suite. The e2e files now run with `--test-concurrency=1` because they share
    one stack. Recorded rather than dismissed — worth watching in Iteration 02.
11. **The iteration branch was cut from `docs/first-handshake`, not `main`.** That
    branch is three documentation commits ahead of `main` and carries the handshake
    docs this work references. GIT-WORKING-MODEL says an iteration branch starts
    from the latest accepted `main`; flagged rather than quietly rebased.

## UI theme

The verifier page follows the **Sunbird Spark** design system, read from the
Figma file itself (`figma.com/design/gdTmBeuK9os2NxeLZIi5rq`, "Color palette and
font" frame, node `13-89`) and cross-checked against the Spark portal's shipped
CSS, which encodes the same system.

Palette, hex verbatim from the file's Primary/Secondary Palette:

| Token | Hex | Used for |
|---|---|---|
| BRICK | `#a85236` | primary action, links, section labels |
| GINGER | `#cc8545` | wordmark, chip borders, warning tone |
| SUNFLOWER | `#ffdb73` | the chip for the one claim actually shared |
| IVORY | `#fffef4` | QR plate |
| INK | `#376673` | secondary/status text |
| WAVE | `#70adbf` | focus rings, the waiting pulse |
| FOREST / MOSS | `#82a668` / `#66a682` | APPROVED |
| JAMUN | `#540f3b` | DENIED — BRICK is the primary action colour here, so a refusal needs a different, unmistakable tone from the same palette |

Type is Rubik throughout, per the file's own note ("HEADINGS & LARGER TEXT:
Rubik / PARAGRAPH & BODY TEXT: Rubik"), self-hosted from the same `woff2` the
Spark portal ships — no CDN, so the stack still runs with no network. Card titles
are Rubik Medium 20 in the file, which is the scale used here.

Composition follows the file's screens rather than being invented: white cards
with a hairline border on a light page, `#F4F4F4` frame fill, SUNFLOWER pill
chips with dark text, dot-separated meta lines (the file's idiom for card
metadata), BRICK section labels with a `→`, and a near-black footer band with the
wordmark in GINGER.

Verified in Chrome for both outcomes after the restyle. Dev Mode inspect was not
available (the file is on a Free team plan, so exact spacing tokens could not be
exported); geometry was read from the Design panel and from the rendered frames.
