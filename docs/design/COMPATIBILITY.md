# Sunbird RC Demo — Compatibility Baseline

**Status:** Desk validation complete; device-level validation required before Iteration 1 implementation
**Validated:** 20 August 2026

## Purpose

Pin candidate releases and distinguish documented or source-verified compatibility from interoperability that must still be demonstrated on real wallet builds.

## Candidate Releases

| Component | Candidate baseline | Role |
|---|---|---|
| Sunbird RC | `v2.1.0` (`2ade66c`) | Registry, credential services, OpenID4VC issuer and verifier façade |
| EUDI Android Reference Wallet | `2026.07.39-Demo` (`3956c13`) | Age SD-JWT VC wallet |
| Inji Mobile | `v0.22.1` | Agriculture wallet and mandatory Inji lifecycle |

These are candidate implementation pins. Kartheek should record immutable image digests or commit SHAs when the deployable stack is assembled.

## Compatibility Matrix

| Capability | Sunbird RC `v2.1.0` | EUDI `2026.07.39-Demo` | Inji `v0.22.1` | Design conclusion |
|---|---|---|---|---|
| OpenID4VCI | Final 1.0 plus draft-13 compatibility mode | Final v1 | Draft-13-oriented integration documented | Native Sunbird RC modes cover both target wallets; verify exact metadata/offer exchange on device |
| OpenID4VP | Final 1.0 / draft-23 modes, DCQL and `direct_post` | Final v1 with DCQL | Draft 23 documented | Use final mode for EUDI and draft-compatible mode for Inji; verify request-object/client-ID scheme |
| SD-JWT VC | `vc+sd-jwt`, ES256, selective disclosures | SD-JWT VC supported | IETF SD-JWT and selective presentation documented | Technically aligned; EUDI remains the primary Age wallet |
| Holder binding | PoP JWT; `cnf.jwk`/holder key; nonce and audience checks | Secure-area wallet keys and OpenID4VCI key options | Public-key association/holder binding documented | Must prove the same holder key survives issuance and presentation in each chosen flow |
| Replay protection | Atomic single-use offer codes/nonces and single-use VP state | Wallet protocol client | Wallet protocol client | Sunbird RC provides verifier-side protection; validate negative replay cases end-to-end |
| Multi-credential presentation | VP token accepts credential arrays and DCQL evaluation | DCQL multiple combinations added in this release | Multiple credential requests documented since `v0.17.0` | Use Inji for Agriculture, subject to one hands-on two-credential presentation test |
| Web QR cross-device | Generates wallet QR/deep link and handles `direct_post` | Remote presentation | Cross-device QR OpenID4VP documented | No custom protocol required |
| Mobile verifier | Reusable verifier endpoints available | Separate open-source EUDI verifier app exists | Not required from Inji | Reuse Sunbird verifier service with a lightweight/EUDI mobile verifier client |

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

## Required Hands-on Checks

Kartheek and Claude Code / Co-work should complete these before feature implementation:

### EUDI / Age

- Install/build `2026.07.39-Demo`.
- Import an offer from Sunbird RC in final OpenID4VCI mode.
- Receive an ES256 SD-JWT VC bound to the wallet key.
- Answer a DCQL request through the web QR flow.
- Disclose only `ageOver18`.
- Confirm holder binding, nonce, audience, and replay rejection.

### Inji / Agriculture

- Install/build `v0.22.1`.
- Enable Sunbird RC `DRAFT13_COMPAT_MODE` where required.
- Receive credentials from two logical issuers.
- Present both credentials in one verifier transaction.
- Confirm user consent and verifier correlation using only verified claims.
- Record the exact OpenID4VP request-object and client-ID mode required.

## Adapter Decision

**Current decision: no separate adapter.**

Use Sunbird RC `v2.1.0` native compatibility settings first. Introduce adapter code only if a hands-on check fails and all of the following are recorded:

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
