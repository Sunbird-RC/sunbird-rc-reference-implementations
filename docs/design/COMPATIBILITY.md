# Sunbird RC Demo — Compatibility Baseline

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

## Open finding — where the credential-request nonce comes from (blocking, unproven)

Found by reading the Inji source available locally, **not** yet confirmed against
the release we will pin.

Inji builds its proof of possession with the nonce taken from the token response
(`shared/openId4VCI/Utils.ts`: `nonce: decodedToken.c_nonce`), and that checkout
calls no separate nonce endpoint. If Keycloak is the authorization server, the
token response is Keycloak's and carries no such nonce — the proof would go out
without one and issuance would fail.

This is why Anand's answer 4 matters: he accepts **either** arrangement, so the
issuer can be the authorization server and redirect the citizen to Keycloak to sign
in, which keeps the nonce in the issuer's own token response. First item in the
spike; the outcome decides the arrangement, and both are within the approved
baseline.

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
