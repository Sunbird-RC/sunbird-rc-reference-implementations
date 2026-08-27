# Sunbird RC Demo — Architecture & Design

**Status:** Approved baseline, revised for Age Iteration 01 — 24 August 2026
**Product baseline:** [`../project/PRODUCT.md`](../project/PRODUCT.md)
**Compatibility baseline:** [`COMPATIBILITY.md`](COMPATIBILITY.md)

## 1. Design Objective

Build one reproducible showcase in which Sunbird RC provides the registry and credential foundation for three independent domains, while standards-facing components connect issuers to mobile wallets and web/mobile verifiers.

The architecture must maximise reuse without hiding use-case differences or overstating capabilities that have not been demonstrated.

## 2. Architecture Principles

- **Sunbird RC native first:** use supported Sunbird RC registry and credential capabilities before introducing custom code.
- **Thin adapters only:** add an interoperability adapter only for a verified protocol, format, or wallet gap.
- **Standards at boundaries:** issuer-wallet and wallet-verifier interactions use explicit, versioned standards profiles.
- **Logical issuer independence:** every issuer has its own identity, signing material, configuration, schema, and data boundary.
- **Common platform, separate domain logic:** reuse credential plumbing; isolate schemas, source data, correlation, and decisions.
- **Privacy by flow:** request the minimum claims, require consent, bind presentations to a holder and transaction, and avoid central presentation tracking.
- **Demo simplicity:** deploy locally with containers and synthetic data; avoid production platform concerns.

## 3. System Context

```text
┌──────────────────── Issuer side ────────────────────┐
│                                                     │
│  Domain source data                                 │
│  Age | Farmer | Land | School | College | University│
│             ↓                                       │
│  Sunbird RC Registry + Credential capabilities      │
│             ↓                                       │
│  Standards adapter (only for verified gaps)         │
│             ↓ OpenID4VCI / SD-JWT VC                │
└─────────────────────┬───────────────────────────────┘
                      ↓
          Compatible mobile VC wallets
      Inji + other open-source wallet(s)
                      ↓ OpenID4VP
          ┌───────────┴───────────┐
          ↓                       ↓
   Web Verifier + QR       Mobile Verifier
          └───────────┬───────────┘
                      ↓
        Verification + domain decision
```

## 4. Logical Components

### Sunbird RC

Sunbird RC is the showcase foundation and owns:

- Registry schemas and synthetic source entities.
- Registry CRUD and search APIs.
- Credential schema/template configuration where supported.
- Native credential creation, signing, verification, and lifecycle capabilities selected after compatibility validation.

One shared Sunbird RC deployment may serve the demo. Logical issuers must remain distinct through issuer profiles, use-case-specific tables/entities, access boundaries, and keys.

### Standards Adapter

Sunbird RC `v2.1.0` includes a native `oid4vc-service` protocol façade with OpenID4VCI/OpenID4VP and `vc+sd-jwt`. Therefore, **no separate standards adapter is part of the baseline architecture**.

A small stateless adapter remains permitted only if hands-on wallet interoperability identifies a gap that cannot be addressed through the released Sunbird RC compatibility modes or configuration.

Its allowed responsibilities are:

- Map a standards-based issuance request to Sunbird RC data and credential operations.
- Expose the selected OpenID4VCI metadata and endpoints.
- Produce the selected SD-JWT VC representation when Sunbird RC cannot do so natively.
- Preserve issuer identity, signing, holder binding, and audit boundaries.

It must not become a second registry, duplicate domain data, or contain domain business rules.

### Wallets

- Inji must complete at least one full use-case lifecycle.
- Kartheek may select Inji or another suitable open-source VC-compliant mobile wallet for each use case.
- Wallet selection should consider protocol and credential-format support, consent, holder binding, selective disclosure, multi-credential presentation, and implementation effort.
- Exact wallet releases and compatibility modes are engineering decisions and must be recorded with the implementation evidence.
- Wallet-specific behaviour remains outside generic issuer and verifier logic.
- In the Age iteration, the wallet authenticates through Keycloak, discovers/selects the National Identity Authority, and initiates direct OpenID4VCI credential retrieval without an issuance QR or issuer-counter page.

### Issuer Discovery

In a production ecosystem, issuer discovery should be governed through a trust registry and explicit wallet-to-issuer onboarding and mapping. Building that ecosystem capability is outside the current demo scope.

For these demonstrations, the relevant trusted issuer entries may be configured in the selected wallet or its required companion configuration service. Each use-case demo shows only its own relevant issuer or issuers; it must not display every showcase issuer merely to create a larger catalogue. The configuration service must remain limited to discovery/configuration and must not become another registry, issuer, credential store, identity system, or business-rules service.

### Identity and Issuance Authorisation

Keycloak authenticates the demo wallet user. Each demo account is mapped deterministically to exactly one synthetic citizen record held through Sunbird RC. The issuer resolves that mapping server-side and derives credential claims from the mapped authoritative record; the wallet or caller cannot supply or select another citizen's source record.

Authentication, citizen mapping, credential signing, and issuer keys remain separate concerns. The implementation must demonstrate that invalid credentials, unmapped accounts, and cross-citizen issuance attempts fail safely.

### Verifier Service

One reusable verifier service owns:

- OpenID4VP request creation and response handling.
- QR-based cross-device transaction initiation.
- Signature, issuer, time, audience, nonce, holder-binding, and disclosure validation.
- Credential matching and normalised verified claims.
- Transaction state with short expiry and single use.

Verifier-specific applications call this common service and do not implement cryptographic validation independently.

### Domain Decision Modules

Small modules consume only verified, normalised claims:

- Age: evaluate `ageOver18`.
- Agriculture: correlate farmer and land credentials, aggregate eligible land, and calculate the demo loan result.
- Education: match verified qualifications to the employment requirement.

These modules must never receive undisclosed wallet claims or unverified credential payloads.

## 5. Standards Baseline

Target standards:

- OpenID for Verifiable Credential Issuance 1.0 Final.
- OpenID for Verifiable Presentations 1.0 Final.
- SD-JWT as defined by RFC 9901.
- The compatible SD-JWT VC profile supported by the selected issuer and wallet releases.

The final implementation profile must be pinned in the repository and based on demonstrated interoperability, not assumed feature parity. Kartheek selects the best compatible open-source wallet and profile for each use case. Any protocol translation that is genuinely required must remain inside the standards adapter.

## 6. Credential and Issuer Model

| Domain | Logical issuer | Credential |
|---|---|---|
| Age | National Identity Authority | `AgeVerificationCredential` |
| Agriculture | Farmer Registry | `FarmerIdentityCredential` |
| Agriculture | Land Registry | `LandOwnershipCredential` |
| Education | School | `SchoolCertificate` |
| Education | College | `CollegeDiploma` |
| Education | University | `UniversityDegree` |

Each logical issuer has:

- Stable issuer identifier.
- Independent signing key and published verification material.
- Credential configuration and schema.
- Allowed source-data access.
- Explicit verifier trust entry for the demo.

The demo trust model is a version-controlled allowlist of issuer identifiers and public keys/metadata. It is loaded by the verifier service. A production trust registry is out of scope.

## 7. Data Design

Use one PostgreSQL database with independent use-case-specific tables/entity labels, for example:

```text
AgeCitizen and other Age tables
Farmer, Land and other Agriculture tables
School, College, University and other Education tables
Protocol transaction and non-domain configuration tables
```

Rules:

- No shared cross-domain person table.
- Even where use cases portray the same synthetic person, each use case keeps its own independent record and attributes; tables and domain data do not overlap.
- Synthetic identifiers may be intentionally correlated only through explicit test fixtures, without merging the domain records.
- The standards adapter reads data through Sunbird RC APIs rather than directly from domain tables.
- Presentation transaction data is short-lived and must not create a durable central history of holder activity.
- Keys and secrets remain outside source control and domain tables.

## 8. Primary Flows

### Issuance

```text
Wallet → Keycloak authentication → issuer discovery/selection
       → direct OpenID4VCI request → issuer endpoint
       → resolve authenticated citizen mapping
       → resolve source entity through Sunbird RC
       → validate credential schema
       → bind and sign credential
       → wallet stores credential
```

For the Age iteration, issuance is initiated and completed from the wallet. An issuance QR, issuer-counter page, or browser-based citizen selection is not permitted. Any authorisation code or token used internally must be short-lived, scoped, and bound to the authenticated citizen and wallet flow.

### Web cross-device verification

```text
Web verifier → create OpenID4VP transaction → show QR
Wallet scans → validates request → matches credential
Wallet shows requested claims → holder consents
Wallet → direct response → verifier service
Verifier validates → domain module decides → web result
```

### Mobile verification

```text
Mobile verifier → create presentation request → invoke wallet
Wallet shows request and consent → returns presentation
Verifier service validates → domain module decides → mobile result
```

For the Age iteration, this is a mandatory separate mobile verifier app and same-device deep-link journey. The exact invocation, callback, and response mechanism follows the selected wallet's supported OpenID4VP profile. The mobile UI must use the same reusable verifier service as the web flow and must not implement an independent trust or cryptographic decision path.

## 9. Security and Privacy

- HTTPS for all standards-facing endpoints outside local-only development.
- Separate issuer keys; no shared signing key across logical issuers.
- Holder/key binding where supported by the selected SD-JWT VC profile.
- Audience and cryptographically random nonce bound to every presentation transaction.
- Short transaction expiry and atomic single-use consumption to prevent replay.
- Minimum-claim requests and explicit wallet consent.
- Strict issuer allowlist and algorithm allowlist; reject unknown issuers or algorithms.
- Verify before executing correlation or business rules.
- No secrets, private keys, real personal data, or raw presentations in source control or normal logs.
- Structured security events without a central holder-presentation history.

## 10. Deployment

The reference deployment uses Docker Compose and includes:

- Sunbird RC and its required dependencies.
- One PostgreSQL database with separate use-case tables/entities and no shared domain-person table.
- Identity/access dependency required by the chosen Sunbird RC configuration.
- Standards adapter, if the compatibility spike proves it necessary.
- Reusable verifier service.
- Web verifier.
- Mobile verifier build/configuration.
- Deterministic synthetic-data setup and automated tests.

Exact languages and frameworks for new code are engineering choices, provided the result is open-source, reproducible, well-tested, and maintainable by the project team.

## 11. Verification Strategy

Every iteration supplies automated evidence for:

- Positive issuance and presentation.
- Minimum disclosure and consent.
- Wrong issuer, signature, audience, nonce, holder binding, and expired transaction.
- Tampered disclosure and replay rejection.
- Domain-specific positive and negative decisions.
- Data isolation between use cases.
- Regression of all previously accepted flows.

Protocol conformance tooling should be used where practical; an end-to-end demo alone is not sufficient evidence of interoperability.

## 12. Implementation Sequence

### Iteration 1 — Age

Establish the reusable vertical slice: Sunbird RC entity, Keycloak-to-citizen mapping, authenticated wallet-driven issuance without an issuance QR, issuer discovery/selection, holder-bound SD-JWT VC storage, web QR verification, mobile deep-link verification, consent, selective disclosure, holder/transaction binding, and age decision.

### Iteration 2 — Agriculture

Add independent issuers, multi-credential presentation, correlation, and loan decision without duplicating core protocol services.

### Iteration 3 — Education

Add the third domain, credential filtering/discovery, and final regression coverage. Reuse and regress the mobile verifier capability established in Iteration 1.

## 13. Architecture Decisions

1. **Sunbird RC boundary:** baseline Sunbird RC `v2.1.0` and its native `oid4vc-service`; introduce a thin standards adapter only for a demonstrated gap that configuration cannot resolve.
2. **Wallet policy:** Kartheek selects suitable open-source wallets per use case; Inji must complete at least one full use case.
3. **Trust model:** use a repository-controlled issuer allowlist for the demo; do not build a trust registry.
4. **Data model:** use one PostgreSQL database with separate use-case tables/entities. The same synthetic person is represented independently per use case; tables and domain data do not overlap.
5. **Delivery order:** Age (including web and mobile verification), Agriculture, then Education.
6. **Wallet-driven issuance extension:** add Keycloak-backed OpenID4VCI `authorization_code` support inside Sunbird RC's `oid4vc-service`, not the registry engine. The registry remains the authoritative claim source. The new grant is optional/configurable, existing pre-authorised issuance remains supported and unchanged by default, and the forked build must be pinned, tested, recorded as a deviation, and kept suitable for an upstream contribution.
7. **Demo issuer discovery:** configure only the relevant use-case issuer entries in the wallet/companion configuration; defer trust-registry-governed discovery and onboarding.

## 14. References

- [Sunbird RC overview](https://docs.sunbirdrc.dev/learn/readme-1)
- [Sunbird RC credential issuance APIs](https://rc.sunbird.org/api-reference/credentialling-apis/credential-issuance-apis)
- [Inji OpenID4VP integration](https://docs.inji.io/inji-wallet/inji-mobile/technical-overview/integration-guide/openid4vp)
- [Inji end-user credential presentation flows](https://docs.inji.io/end-user-guide)
- [EUDI Reference Implementation repositories](https://docs.eudi.dev/latest/reference-implementation/repositories-list/)
- [OpenID4VCI 1.0 Final](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-final.html)
- [OpenID4VP 1.0 Final](https://openid.net/specs/openid-4-verifiable-presentations-1_0-final.html)
- [RFC 9901 — Selective Disclosure for JWTs](https://www.rfc-editor.org/rfc/rfc9901.html)
