# Sunbird RC Demo — Product Definition

## Positioning

This project is a **Sunbird RC capability showcase**. The selected use cases progressively demonstrate reusable, standards-aligned, privacy-preserving credential capabilities across different domains.

The objective is not to build production solutions for Age, Agriculture, or Education. These domains are demonstration vehicles for Sunbird RC issuance, wallet interoperability, selective disclosure, multi-issuer and multi-credential scenarios, credential correlation, and web/mobile verification.

## Product Goal

Demonstrate the complete verifiable credential lifecycle:

**Issue → Store → Request → Consent → Present → Verify → Decide**

The showcase should prove that common credential capabilities can support independent domains, issuers, wallets, and verifier channels without rebuilding the platform for each use case.

## Product Principles

- **Privacy and holder control:** disclose only the claims required for a transaction; obtain user consent before presentation.
- **Standards-based interoperability:** use OpenID4VCI, OpenID4VP, and an applicable SD-JWT VC profile selected during design.
- **Reusable infrastructure:** separate generic credential processing from schemas, source data, correlation, and domain rules.
- **Independent participation:** issuers, wallets, and verifiers should be replaceable where standards permit.
- **Open implementation:** use suitable open-source components and keep the showcase independently reproducible.
- **Synthetic data only:** test data must be deterministic, repeatable, and contain no real personal data.

## Wallet Requirements

- **Inji Wallet must complete at least one end-to-end use case.**
- Other use cases may use Inji or suitable open-source, VC-compliant mobile wallets.
- Across the showcase, wallets must support issuance/receipt, storage, credential selection, user consent, presentation, and the required web-to-mobile or mobile-to-mobile flows.
- One wallet implementation is not required for every use case; multiple compliant wallets may be used to demonstrate interoperability.
- For the revised Age iteration, the wallet must authenticate the citizen through Keycloak, show available issuers, let the citizen select the National Identity Authority, and request/fetch the credential directly from that issuer. Issuance must not use a QR code or an issuer-counter web page.

## Issuers and Data

- The showcase includes multiple logically independent credential issuers.
- Issuers may share one database infrastructure for demo simplicity.
- Each use case must retain independent tables or schemas, domain entities, credential source data, and business structures. Domain data must not be mixed.
- The shared database is a demo convenience, not a target deployment model; real issuers would ordinarily control separate environments.
- Multi-tenant issuers, sub-issuer management, organisational hierarchies, and delegated issuer administration are out of scope and must not complicate the current architecture.

## Verification Channels

The showcase must demonstrate both channels:

### Web verification

A verifier web page initiates a presentation request and displays a QR code. A compatible mobile wallet scans it, shows the requested disclosures, obtains consent, and presents the credential. The verifier validates the presentation, applies the relevant business rule, and displays the result.

### Mobile verification

A separate demo mobile verifier experience initiates or receives a credential presentation and displays the verified business result. It may be a lightweight application, an adapted open-source verifier, or another standards-compatible demo application. For the revised Age iteration, this must be a same-device journey: the verifier app invokes the wallet through a standards-compatible deep link, the holder reviews and consents, and the selectively disclosed response is validated before the app displays its result.

The detailed protocol interaction and component choices belong in architecture and design.

## Demonstration Use Cases

### 1. Age Verification

**Purpose:** foundational credential lifecycle and privacy-preserving disclosure.

- Issuer: National Identity Authority
- Holder: Citizen
- Verifier: Age-restricted service
- Credential: `AgeVerificationCredential`
- Minimum presentation: an issuer-derived assertion such as `ageOver18 = true`, without disclosing date of birth or unrelated identity claims
- Result: **APPROVED** or **DENIED**

Demonstrates issuance, wallet storage, selective disclosure, consent, holder/key binding, presentation, cryptographic verification, replay/transaction protection, and data minimisation.

The Age use case must demonstrate all three interaction patterns: authenticated wallet-driven issuance without an issuance QR, cross-device web verification by QR, and same-device mobile verification by deep link.

### 2. Agriculture / Rural Credit

**Purpose:** multi-issuer, multi-credential, and linked-credential validation.

- Issuers: Farmer Registry and Land Registry
- Holder: Farmer
- Verifier: Bank
- Credentials: `FarmerIdentityCredential` and `LandOwnershipCredential`
- Result: **ELIGIBLE — Maximum Loan ₹X** or **NOT ELIGIBLE**

The verifier validates both credentials, correlates the required subject or domain information, aggregates eligible facts, and applies loan rules.

### 3. Education / Employment

**Purpose:** reuse in another domain plus credential discovery and filtering.

- Issuers: School, College, and University
- Holder: Student or applicant
- Verifier: Employer
- Credentials: `SchoolCertificate`, `CollegeDiploma`, and `UniversityDegree`
- Result: **QUALIFIED** or **NOT QUALIFIED**

The wallet identifies credentials relevant to the verifier request without exposing the holder's complete credential collection.

## Core Acceptance

The showcase is accepted when:

- All three use cases complete the end-to-end credential lifecycle.
- Inji Wallet completes at least one full use case.
- Web QR-based cross-device verification works.
- A mobile verifier experience works.
- Selective disclosure reveals only requested claims and requires consent.
- Invalid, tampered, incorrectly bound, or replayed presentations are rejected.
- Multiple issuers and multi-credential presentation operate as required.
- Credential correlation, discovery/filtering, and business decisions produce expected results.
- Use-case data remains logically separated.
- Generic capabilities are reused and domain logic remains separate.
- Later iterations do not regress accepted earlier capabilities.

## Out of Scope

- Production deployment, scale, availability, certification, or regulatory readiness.
- Real personal or institutional data.
- National trust registries, federation, or ecosystem governance platforms.
- Production revocation/status infrastructure, while the design should not prevent future lifecycle support.
- Multi-tenancy, sub-issuers, delegated issuer administration, or organisational issuer hierarchies.
- A production-grade wallet or verifier application.

## Success Statement

The project succeeds by demonstrating that **Sunbird RC provides a reusable, standards-aligned foundation for credential ecosystems in which independent issuers, wallets, and verifiers can participate while preserving privacy, institutional autonomy, and technology choice.**
