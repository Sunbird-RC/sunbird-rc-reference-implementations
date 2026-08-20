# Sunbird RC Demo — Architecture & Design

**Status:** Design in progress — architecture decisions approved  
**Product baseline:** [`../project/PRODUCT.md`](../project/PRODUCT.md)

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
      EUDI Reference Wallet | Inji Mobile
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

One shared Sunbird RC deployment may serve the demo. Logical issuers must remain distinct through issuer profiles, schemas, access boundaries, and keys.

### Standards Adapter

A small stateless adapter is permitted only when the selected Sunbird RC release does not natively provide the exact wallet-facing profile required by the showcase.

Its allowed responsibilities are:

- Map a standards-based issuance request to Sunbird RC data and credential operations.
- Expose the selected OpenID4VCI metadata and endpoints.
- Produce the selected SD-JWT VC representation when Sunbird RC cannot do so natively.
- Preserve issuer identity, signing, holder binding, and audit boundaries.

It must not become a second registry, duplicate domain data, or contain domain business rules.

### Wallets

- **Age:** use the open-source EUDI Reference Wallet for the SD-JWT VC selective-disclosure flow.
- **Agriculture:** use Inji Mobile for the complete multi-issuer and multi-credential flow.
- **Education:** reuse EUDI Reference Wallet or Inji Mobile based on credential discovery/filtering support; do not introduce a third wallet without a demonstrated need.
- Pin the exact wallet releases after validating protocol, credential-format, consent, holder-binding, and multi-credential compatibility.
- Wallet-specific behaviour remains outside generic issuer and verifier logic.

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

The final implementation profile must be pinned in the repository and based on demonstrated interoperability, not assumed feature parity. The EUDI Reference Wallet is the primary SD-JWT VC test client; Inji uses the best compatible credential profile for its assigned use case. Any protocol translation that is genuinely required must remain inside the standards adapter.

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

Use one PostgreSQL deployment with independent database schemas:

```text
age.*
agriculture.*
education.*
platform.*       # protocol transaction state and non-domain configuration only
```

Rules:

- No shared cross-domain person table.
- Synthetic identifiers may be intentionally correlated only within a use-case fixture.
- The standards adapter reads data through Sunbird RC APIs rather than directly from domain tables.
- Presentation transaction data is short-lived and must not create a durable central history of holder activity.
- Keys and secrets remain outside source control and domain tables.

## 8. Primary Flows

### Issuance

```text
Wallet → OpenID4VCI request → issuer endpoint
       → authenticate/authorise demo holder
       → resolve source entity through Sunbird RC
       → validate credential schema
       → bind and sign credential
       → wallet stores credential
```

Pre-authorised issuance is preferred for the first showcase iteration because it keeps the user journey small. The offer and code must be short-lived and single-use.

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

The exact same-device invocation and response mechanism will follow the selected wallet's supported OpenID4VP profile.

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
- PostgreSQL with separated use-case schemas.
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

### Design validation spike

Before feature implementation:

1. Pin the Sunbird RC, EUDI Reference Wallet, and Inji Mobile releases.
2. Record their supported credential formats, algorithms, holder binding, selective disclosure, multi-credential behaviour, and OpenID4VC draft/final versions.
3. Demonstrate the smallest Sunbird RC → EUDI issuance/presentation flow for SD-JWT VC.
4. Demonstrate the smallest Sunbird RC → Inji issuance/presentation flow using Inji's best compatible profile.
5. Decide whether the standards adapter is required, based only on verified gaps.

### Iteration 1 — Age

Establish the reusable vertical slice: Sunbird RC entity, issuer, SD-JWT VC, EUDI Reference Wallet, web QR verification, consent, holder/transaction binding, and age decision.

### Iteration 2 — Agriculture

Add independent issuers, multi-credential presentation, correlation, and loan decision without duplicating core protocol services.

### Iteration 3 — Education and mobile verification

Add the third domain, credential filtering/discovery, a mobile verifier experience, and final regression coverage.

## 13. Architecture Decisions

1. **Sunbird RC boundary:** use native Sunbird RC capabilities first; introduce a thin standards adapter only for demonstrated compatibility gaps.
2. **Wallet assignment:** EUDI Reference Wallet for Age; Inji Mobile for Agriculture; reuse one of them for Education after validating discovery/filtering behaviour.
3. **Trust model:** use a repository-controlled issuer allowlist for the demo; do not build a trust registry.
4. **Data model:** use one PostgreSQL deployment with separate use-case schemas and no shared cross-domain person table.
5. **Delivery order:** complete the compatibility spike, then Age, Agriculture, and Education/mobile verification.

## 14. References

- [Sunbird RC overview](https://docs.sunbirdrc.dev/learn/readme-1)
- [Sunbird RC credential issuance APIs](https://rc.sunbird.org/api-reference/credentialling-apis/credential-issuance-apis)
- [Inji OpenID4VP integration](https://docs.inji.io/inji-wallet/inji-mobile/technical-overview/integration-guide/openid4vp)
- [Inji end-user credential presentation flows](https://docs.inji.io/end-user-guide)
- [EUDI Reference Implementation repositories](https://docs.eudi.dev/latest/reference-implementation/repositories-list/)
- [OpenID4VCI 1.0 Final](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-final.html)
- [OpenID4VP 1.0 Final](https://openid.net/specs/openid-4-verifiable-presentations-1_0-final.html)
- [RFC 9901 — Selective Disclosure for JWTs](https://www.rfc-editor.org/rfc/rfc9901.html)
