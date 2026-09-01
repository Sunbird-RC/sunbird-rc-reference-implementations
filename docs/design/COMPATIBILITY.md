# Sunbird RC Demo — Compatibility Baseline

> **Scope note:** Inji-related material in this file is retained as historical
> compatibility research only. Anand removed Inji from the current demo
> programme on 31 August 2026; it creates no implementation, handshake, or
> acceptance requirement for any iteration.

**Status:** Reference input for engineering
**Validated:** 20 August 2026
**Revised:** 25 August 2026 — after the Iteration 01 review and Anand's answers
(`../reviews/ANSWERS-01-age-from-anand.md`). Wallet assignment for Age is reversed
and a new blocking finding is recorded; both are marked below and neither is proven
yet on a device.

## Purpose

Summarise documented or source-verified compatibility as input to Kartheek's implementation decisions. This document does not prescribe wallet assignment or create a separate delivery gate.

## Candidate Releases

| Component | Candidate baseline | Role |
|---|---|---|
| Sunbird RC | `v2.1.0` (`2ade66c`) | Registry, credential services, OpenID4VC issuer and verifier façade |
| Inji Mobile | `v0.22.1` (to be pinned at the spike) | **Age** wallet — the only candidate whose stock journey is sign in, list issuers, fetch |
| EUDI Android Reference Wallet | `2026.07.39-Demo` (`3956c13`) | No longer the Age candidate — see "Age wallet reassignment" |

These are reference candidates, not mandatory implementation pins. Kartheek may select other suitable open-source wallets or releases while preserving the Product requirements, and should record immutable image digests or commit SHAs with the implementation evidence.

## Age wallet reassignment (25 August 2026)

The revised charter requires an issuance journey where the citizen signs in inside
the wallet, the wallet lists the available issuer, and the credential is fetched
directly with no QR. Judged against that:

- **EUDI Android** has no authenticated issuer-directory journey. It consumes a
  credential offer, which the charter now forbids as the entry point. It cannot
  satisfy Flow 1 as written.
- **Inji Mobile** ships exactly that journey — an issuers screen, a credential-type
  screen, and an OAuth sign-in per issuer. It reaches its issuer list through a
  companion configuration service, which Anand has accepted for the demo provided
  it stays limited to discovery and configuration.

Anand raised no objection to reversing the assignment (answer 9); wallet selection
remains an engineering decision, and Inji doing Age also satisfies Product's
requirement that Inji completes at least one full use case. Exact version, profile
and compatibility mode are to be recorded when the spike runs.

## Resolved — where the credential-request nonce comes from (26 August 2026)

Found by reading the Inji source available locally, **not** yet confirmed against
the release we will pin.

Inji builds its proof of possession with the nonce taken from the token response
(`shared/openId4VCI/Utils.ts`: `nonce: decodedToken.c_nonce`), and that checkout
calls no separate nonce endpoint. If Keycloak is the authorization server, the
token response is Keycloak's and carries no such nonce — the proof would go out
without one and issuance would fail.

Anand's answer 4 accepts **either** arrangement, so the fallback was to make the
issuer the authorization server and have it redirect the citizen to Keycloak,
keeping the nonce in the issuer's own token response.

**That fallback is not needed for Age.** Proven against the live deployment on
26 August 2026: with Keycloak as the authorization server, a client that takes
the nonce from the issuer's `nonce_endpoint` completes issuance normally. The
arrangement recorded for Age is therefore **wallet-to-Keycloak directly**, and
`tests/e2e/flow1-wallet-issuance.test.mjs` keeps it honest — it signs in through
Keycloak's real login page and requests the credential exactly that way.

Credo (and so Paradym) fetches the nonce from `nonce_endpoint`, which our stack
publishes. Inji's token-response-only behaviour remains a real constraint, but
Inji is no longer part of Age — it moves to Agriculture, where this finding
should be re-read before that iteration commits to an arrangement.

## Deployment findings (26 August 2026)

Found while putting the stack on a public host, all fixed in the repository
rather than by hand on the server.

| # | Finding | Why it mattered | What changed |
|---|---|---|---|
| 1 | `did:web` mandates https, and the demo host had no certificate | over http the issuer's identifier only resolves for a client told to relax the rule, which a real wallet need not do | `scripts/enable-https.sh` issues a Let's Encrypt certificate for an `sslip.io` name (no DNS to own) and `deploy/docker-compose.tls.yml` puts the gateway behind it |
| 2 | Keycloak interrupted the first sign-in with "Update Account Information" | its default user profile requires an email, so `VERIFY_PROFILE` fires **before** the wallet receives its authorization code — in the wallet that is a form in the in-app browser and the journey stalls | the realm disables `VERIFY_PROFILE` and the synthetic accounts carry complete profiles (`@citizens.invalid`, reserved by RFC 2606) |
| 3 | The credential type URL 404ed | oid4vc-service serves SD-JWT VC Type Metadata at `/vct/<slug>` only for schemas whose stored `vct` is *relative*; ours was absolute, so our own published URL had nothing behind it. Credo fetches that document to render the credential | bootstrap stores the slug and lets the service normalise it; the published `vct` is unchanged, and it now follows `PUBLIC_URL` |
| 4 | Changing the public origin silently kept the old identity | a `did:web` spells its host into the identifier, and identity-service still resolves an old one from its own database, so bootstrap happily reused a DID no external wallet could resolve | `mint_did` refuses a DID minted under another host and says why |
| 5 | The stack has unauthenticated operator endpoints | not survivable on the internet: registry read **and write**, DID minting, schema creation, the pre-authorised offer endpoint, Keycloak's admin console — and `POST /oid4vc/offer`, which mints a credential from caller-supplied claims and would let anyone obtain one signed by the National Identity Authority saying anything | the gateway now has two listeners. `routes-citizen.conf` is what the internet sees; `routes-ops.conf` is served only on a listener Docker publishes on `127.0.0.1`. Endpoints sitting under wallet-facing prefixes (`/oid4vc/offer`, `/vp/request`, `/vp/status`, `/auth/admin`) are refused explicitly on the public listeners, because omission alone would leave the broader prefix serving them. The realm also enables brute-force protection, and bootstrap rotates Keycloak's default admin password |
| 6 | An IP allowlist was the first attempt at #5, and it failed | on macOS, Docker Desktop's host-to-container NAT arrives from an unpredictable public-looking address (observed: `144.202.100.225`), so `allow 127.0.0.1; allow 10/8; …` locked the developer out of their own stack — and it meant recording an operator's home address in deployment config | replaced by the loopback listener above, which depends on no address at all. Reaching operator endpoints from another machine is an ssh port-forward: `ssh -L 8088:127.0.0.1:8088 user@host` |

| 7 | The wallet reached Keycloak and the sign-in failed instantly with "something went wrong" | OID4VCI lets an issuer advertise a `scope` per credential configuration, and a standards wallet asks the authorization server for **that** scope rather than plain `openid`. Ours advertises `age-verification-credential`; Keycloak refuses any scope it does not know, answering `error=invalid_scope`, which a wallet can only report as a generic failure. Found on the device — the automated suite was signing in with `openid` and passing | every advertised scope now exists as a client scope in `deploy/keycloak/realm-age.json`, attached to the wallet client as **optional** so it is granted when asked for and does not ride along otherwise. `tests/e2e/flow1-wallet-issuance.test.mjs` now signs in with the scope metadata advertises, and asserts for **every** advertised scope that Keycloak grants it and that the token carries it |

| 8 | The wallet could not scan the verifier's QR, though the same URL worked as a deep link | the payload is ~206 characters (a `did:web` `client_id` plus an https `request_uri`), so the symbol is dense. It was rendered at 320px with a 2-module quiet zone, then CSS-capped to ~296px on a cream panel — three things at once working against a phone camera aimed at a laptop screen | 480px, the spec's 4-module quiet zone, `ecl: 'L'` (one version fewer, so larger modules), and the page renders it at 24rem on **white**, because the quiet zone is part of the symbol and contrast against it is what the decoder measures |

| 12 | The wallet posts **nothing** when the holder declines a presentation | observed on the device, 27 August 2026: the wallet fetched the request object and then sent no response at all — no `error=access_denied`, no empty `vp_token`. So a refusal is indistinguishable from a request the holder ignored, and the only terminal signal is the session TTL — minutes of a spinner in front of an audience | the verifier gained `POST /api/verifier/sessions/:id/cancel`, which marks the request abandoned and then **refuses to report a decision for it even if a presentation arrives late**. Enforced in the service rather than labelled in the UI, because a client-side "cancelled" caption over a session that could still return APPROVED would be untrue. The `declined` state added earlier remains, for wallets that do report a refusal. **Resolved on the device, 27 August 2026:** the fork now posts an Authorization Error Response (`error=access_denied` with the `state`, form-encoded to `response_uri`) from its decline path, and the verifier reported `declined` about two seconds after the holder tapped stop — no operator cancel, no waiting out the session. The verifier's own wording, "the holder declined the request", is the proof of route: that state can only come from the wallet's POST. The cancel endpoint stays, for wallets that still say nothing |

| 13 | The wallet showed **"Organization not verified"** for our verifier, and no configuration could fix it | not a missing trust entry — a defect in the wallet fork's SDK. Its `did` trust mechanism matched with ``effectiveClientId === `decentralized_identifier:${e.did}` ``, but `effectiveClientId` is the `client_id` verbatim. Our verifier sends the bare `did:web:…` form used by OpenID4VP before draft 26, and `@openid4vc/openid4vp` maps the `did` prefix onto the uniform `decentralized_identifier` prefix (`getOpenid4vpClientId`, `zClientIdPrefixToUniform`) while leaving `effectiveClientId` unprefixed. A string starting `did:` can never equal `'decentralized_identifier:' + anything`, so the lookup was unsatisfiable for every possible configured value — verified in the library source, not inferred | fixed in `vendor/paradym-wallet/packages/sdk/src/trust/handlers/did.ts` by stripping the prefix and any key fragment and then prefix-matching, which is what the OpenID4VCI path in the same file already did. Prefix matching also gives host-scoped trust, so re-provisioning the demo does not silently return the wallet to "unknown organization". **Removal path:** delete the patch if upstream normalises the comparison; nothing in our stack depends on it. The issuance screen needed no code — it runs through the fallback (`none`) mechanism, which already matches on an issuer prefix. Guarded from our side by `tests/e2e/age-verification.test.mjs` → *the verifier identifies itself with a bare did:web under the deployment host* |

| 14 | With two issuers on one deployment, **every issuer advertised every credential** | `credential-schema`'s `/oid4vci-configs` is deployment-wide and takes no filter, and `oid4vci.service.ts`'s `issuerMetadata()` builds `credential_configurations_supported` from all of it. Observed on 28 August 2026: the Farmer Registry, the Land Registry and the National Identity Authority each advertised all three published credentials. A wallet's issuer directory would then show the same credential under whichever issuer the holder opened, and each issuer would appear to offer credentials it cannot issue. It also broke Age's own one-credential invariant, which `verify.sh` asserts | no configuration scopes it — the endpoint takes no parameter and the client passes none, so this is the one Agriculture change that could not be made by configuration. Fixed in the fork by `ADVERTISE_OWN_CREDENTIALS_ONLY`, which filters on the `author` DID a schema already carries and which this service already uses as the per-schema issuer DID. **Off by default**, so a single-issuer deployment sees no change; it also requires `ISSUER_DID`, because filtering on an empty DID would advertise nothing and look exactly like the schema service being down. **Removal path:** delete the flag and the filter if upstream scopes `/oid4vci-configs` by issuer. Covered by `own-credentials.spec.ts` (5 tests) and by `verify.sh`, which asserts each Agriculture issuer advertises only its own |

| 15 | A presentation's signature **algorithm was not observable**, so the approved-algorithm policy REQUIREMENTS §8 asks for could not be enforced | `alg` lives in a JWS protected header and never reaches the claim set, and `/vp/status` reported only the seven checks and the matched claims. Iteration 01 therefore recorded the allowlist as a documented deviation rather than shipping a policy field that did nothing — the alternative would have been a control that looked like a control. Worse than absent: `oid4vp.service.ts` imported the holder key with `(vpHeader.alg as string) \|\| 'ES256'`, so a **missing** `alg` was silently treated as the approved one | fixed in the fork by `presentationAlgs()`, which decodes the protected header of both the issuer JWS and the KB-JWT and reports the set as `algs` in `/vp/status` — and deliberately **omits** an alg it could not parse rather than guessing, so an unreadable header cannot be reported as acceptable. `services/verifier` enforces the allowlist against it (`config/policy/algorithms.json`, ES256 only): an unapproved, absent or malformed algorithm is a **rejection**, not a business answer, and the check runs before the disclosure, trust and domain steps. **Removal path:** delete the reporting if upstream exposes `alg` itself; the verifier-side policy stays either way. Covered by `tests/unit/algorithm-policy.test.mjs` (12 tests, including absent, malformed, `none` and a mixed pair), `tests/e2e/algorithm-policy.test.mjs` (4 tests, one presenting a genuine ES384 holder key that upstream accepts and the verifier refuses), and five `verify.sh` checks including the ordering |

| 16 | **Any issuer instance will mint any published credential type**, signing with that credential's author key over its OWN entity's data | `ADVERTISE_OWN_CREDENTIALS_ONLY` (finding 14) filters issuer METADATA. It does not restrict `POST /oid4vc/credential`, which accepts any published `credential_configuration_id`. Found on 1 September 2026 while writing Education's issuance tests: asking the **school** instance for the **college** configuration returned HTTP 200 and a credential whose `iss` is the College's DID — credentials-service signs with the schema `author` key — carrying the learner's **school** percentage (78.5, where the real college figure is 71.2). The Agriculture equivalent of that test passes, which is why this went unnoticed for an iteration: the Land schema requires claims a FarmerRecord lookup cannot supply, so cross-issuance there fails on **validation**, not on authorization. Education's three records share their claim shape, so nothing stops it | **Contained today, and only by the `vct`.** oid4vc-service normalises a relative `vct` against the MINTING instance's `PUBLIC_URL`, so the cross-minted credential's type is `<host>/school/vct/college-record-credential` — not the `<host>/college/vct/...` that both portals pin in their DCQL query. The presentation is therefore refused, and `tests/e2e/flow3-education-issuance.test.mjs` asserts BOTH halves: that the mint succeeds, and that neither portal accepts the result. No verifier change was needed. What is unsatisfactory is that a trust boundary rests on how a URL is constructed rather than on an authorization check, so this is **raised for Anand** rather than closed: the natural fix is to apply the existing `ADVERTISE_OWN_CREDENTIALS_ONLY` filter to the credential endpoint as well as to metadata — same flag, same `author` comparison, a few lines in the fork, with the same removal path as finding 14. Not done unilaterally because it changes a security guarantee, which `CLAUDE.md`'s escalation boundary reserves for his approval |

## Wallet spike results — Age, 26 August 2026

Both wallet-facing journeys were run on a real device against the deployment.
Answer 9 asked for the version and profile to be recorded after the spike:

| | |
|---|---|
| Wallet | vendored in this repository at `vendor/paradym-wallet`: `animo/paradym-wallet` @ `2d68168` (Apache-2.0) plus seven showcase commits, app version 1.20.3. Previously recorded here as `@06394bd`, which named only the third of those seven |
| Build | Expo 56.0.12, React Native 0.85.3, `APP_VARIANT=preview`, arm64-v8a, package `id.paradym.wallet.preview` |
| Protocol stack | `@credo-ts/core` and `@credo-ts/openid4vc` 0.7.1-alpha-20260707121432, `@openid4vc/openid4vci` 0.5.4, `@openid4vc/openid4vp` 0.4.6 |
| Device | Samsung SM-A055F (Galaxy A05), Android 15 |
| Profile exercised | OpenID4VCI `authorization_code` + PKCE with Keycloak as the authorization server, credential-scope authorization, nonce from `nonce_endpoint`, `vc+sd-jwt` issuance with `cnf.jwk` holder binding; OpenID4VP over `openid4vp://` with a signed request object fetched by `request_uri`, `direct_post` response |
| Result | **Flow 1 and Flow 2 both work on the device.** Server-side over the same window: 12 Keycloak token exchanges, 11 credential requests, 8 credentials signed, 3 request objects fetched, 3 VP submissions, **0 verification failures** |

Two things the wallet fork already handles, which removed work the plan had
budgeted for: it picks the non-issuer entry out of `authorization_servers` and
names it explicitly in the offer it builds (so our two-entry metadata is
unambiguous), and it takes the credential-request nonce from the issuer's
`nonce_endpoint` rather than the token response — which is what made
Keycloak-as-authorization-server viable at all.

| 9 | The QR payload cannot be shortened by dropping `client_id` | it is duplicated inside the signed request object, and the wallet's `@openid4vc/openid4vp` `verifyJarRequest()` throws when the outer value does not byte-match. Unsigned request objects are not an option either: the wallet's fetch sends only JWT `Accept` types and our controller answers 406 for JSON | the remaining levers are the ones that do not touch the protocol — bigger modules on screen (an "Enlarge for scanning" mode on the verifier page), a shorter transaction id, and a shorter request-object path |
| 10 | A holder who declines is indistinguishable from one who never answers | OpenID4VP lets a wallet post `error=access_denied`, or a response with no `vp_token`, or simply nothing. Upstream turns the first two into a failed transaction, so the verifier reported "verification failed" — telling the citizen the system broke when it did exactly what they asked | the verifier now recognises refusal signatures and returns `state: 'declined'`; the page and the mobile app render both `declined` and `expired` as a neutral "NO DATA SHARED", never as a verification failure. Covered by `tests/e2e/age-verification.test.mjs` |
| 11 | The negative-test credential appeared in the wallet's issuer directory | issuer metadata is built from every published, OID4VCI-enabled schema with no filter, and offer creation reads the same set — so the fixture could not simply be unpublished | bootstrap no longer creates it; the tests that need it provision it (`ensureNegativeFixture`) and deprecate it afterwards. A customer-facing stack advertises one credential. Note the deprecate route takes the registry's `did:schema:<uuid>`, not the authored `$id` — the latter answers 500 |

Versions used: Keycloak `26.0`, certbot `v3.1.0`, `sunbird-rc-oid4vc-service:v2.1.0-authcode.9caf3c2b`
(fork branch `oid4vc-keycloak-as-v2.1.0`, source commit `9caf3c2b`, five commits off
`v2.1.0` since Iteration 02 added finding 14's fix), every other Sunbird RC service
on its official `ghcr.io/sunbird-rc` `v2.1.0` image.

## Compatibility Matrix

| Capability | Sunbird RC `v2.1.0` | EUDI `2026.07.39-Demo` | Inji `v0.22.1` | Design conclusion |
|---|---|---|---|---|
| OpenID4VCI | Final 1.0 plus draft-13 compatibility mode | Final v1 | Draft-13-oriented integration documented | Native Sunbird RC modes cover both target wallets; verify exact metadata/offer exchange on device |
| OpenID4VP | Final 1.0 / draft-23 modes, DCQL and `direct_post` | Final v1 with DCQL | Draft 23 documented | Use final mode for EUDI and draft-compatible mode for Inji; verify request-object/client-ID scheme |
| SD-JWT VC | `vc+sd-jwt`, ES256, selective disclosures | SD-JWT VC supported | IETF SD-JWT and selective presentation documented | Technically aligned; **Inji is now the Age wallet** |
| Holder binding | PoP JWT; `cnf.jwk`/holder key; nonce and audience checks | Secure-area wallet keys and OpenID4VCI key options | Public-key association/holder binding documented | Must prove the same holder key survives issuance and presentation in each chosen flow |
| Replay protection | Atomic single-use offer codes/nonces and single-use VP state | Wallet protocol client | Wallet protocol client | Sunbird RC provides verifier-side protection; validate negative replay cases end-to-end |
| Multi-credential presentation | VP token accepts credential arrays and DCQL evaluation | DCQL multiple combinations added in this release | Multiple credential requests documented since `v0.17.0` | Use Inji for Agriculture, subject to one hands-on two-credential presentation test |
| Web QR cross-device | Generates wallet QR/deep link and handles `direct_post` | Remote presentation | Cross-device QR OpenID4VP documented | No custom protocol required |
| Mobile verifier | Reusable verifier endpoints available | Separate open-source EUDI verifier app exists | Not required from Inji | Anand requires a **separately installed** app (answer 5); a mobile web page is not sufficient. It must use the reusable verifier service and hold no independent trust path |
| Authenticated wallet-driven issuance | **Absent from released `v2.1.0`** — only the pre-authorised grant; approved fork addition, optional and configurable (DESIGN decision 6) | Not applicable | Stock journey exists; nonce sourcing to be proven | The capability is ported, opt-in, and pinned; the wallet half is unproven until the spike |

## Verified Sunbird RC Capabilities

Inspection of the released `v2.1.0` source confirms:

- A native `oid4vc-service`; an external adapter is not required by default.
- OpenID4VCI Final 1.0 output with `DRAFT13_COMPAT_MODE` for Inji-style clients.
- `ldp_vc`, `jwt_vc_json`, `vc+sd-jwt`, and `mso_mdoc` credential formats.
- ES256 SD-JWT signing and ES256 wallet proof-of-possession.
- Holder binding through `cnf.jwk` or holder key identifiers.
- OpenID4VP request creation, DCQL evaluation, `direct_post`, and format aliases for `vc+sd-jwt`/`dc+sd-jwt`.
- Nonce, audience, holder-signature, issuer-signature, revocation, DCQL, and replay checks.
- Released documentation reporting real-wallet `vc+sd-jwt` issuance/presentation interoperability with walt.id and presentation interoperability with Paradym.

This evidence supports the architecture, but it does not substitute for testing the selected EUDI and Inji application builds.

## Engineering Validation Guidance

Kartheek and Claude Code / Co-work should perform the relevant checks within each implementation iteration. The exact wallets and order are engineering decisions.

### SD-JWT wallet flow

- Install/build the selected open-source wallet.
- Import an offer from Sunbird RC in final OpenID4VCI mode.
- Receive an ES256 SD-JWT VC bound to the wallet key.
- Answer a DCQL request through the web QR flow.
- Disclose only `ageOver18`.
- Confirm holder binding, nonce, audience, and replay rejection.

### Inji flow

- Install/build `v0.22.1`.
- Enable Sunbird RC `DRAFT13_COMPAT_MODE` where required.
- Complete the issuance and presentation requirements of the use case assigned to Inji.
- Confirm user consent and verifier correlation using only verified claims.
- Record the exact OpenID4VP request-object and client-ID mode required.

## Adapter Decision

**Current baseline: still no separate adapter.** Anand approved adding the
Keycloak-backed `authorization_code` capability *inside* `oid4vc-service` on a
pinned fork build instead (answer 1, DESIGN decision 6) — an upstream-aligned
addition, not an adapter, and not a released `v2.1.0` feature. Pre-authorised
issuance remains the default and is unchanged when the capability is off.

Use Sunbird RC `v2.1.0` native compatibility settings first. Kartheek may propose adapter code only if an implementation check fails and all of the following are recorded:

1. Exact wallet and Sunbird RC versions.
2. Failing protocol exchange and evidence.
3. Why configuration or an upstream fix cannot resolve it.
4. Minimal adapter responsibility and removal path.

## Known Implementation Cautions

- Sunbird RC's Java registry offer hook does not currently send a bearer token. Enabling authentication on offer creation requires either an authenticated issuer-side caller or a scoped fix to that hook.
- Signed OpenID4VP requests require a verifier DID resolvable by external wallets; use a pinned `did:web` for the demo.
- Use Redis-backed session state for repeatable single-use code and nonce behaviour across restarts.
- Public wallet-facing URLs require HTTPS and must match issuer, audience, and request metadata exactly.
- Do not log raw credentials, presentations, pre-authorised codes, access tokens, or holder identifiers.

## Evidence Sources

- [Sunbird RC v2.1.0 release](https://github.com/Sunbird-RC/sunbird-rc-core/releases/tag/v2.1.0)
- [Sunbird RC v2.1.0 source](https://github.com/Sunbird-RC/sunbird-rc-core/tree/v2.1.0/services/oid4vc-service)
- [EUDI Android Reference Wallet releases](https://github.com/eu-digital-identity-wallet/eudi-app-android-wallet-ui/releases)
- [EUDI Reference Implementation repositories](https://docs.eudi.dev/latest/reference-implementation/repositories-list/)
- [Inji Mobile v0.22.1](https://github.com/inji/inji-wallet/releases/tag/v0.22.1)
- [Inji Mobile overview](https://docs.inji.io/inji-wallet/inji-mobile/overview)
- [Inji OpenID4VP integration](https://docs.inji.io/inji-wallet/inji-mobile/technical-overview/integration-guide/openid4vp)
