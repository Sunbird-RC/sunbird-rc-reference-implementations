# Iteration 01 — Age Verification

**Status:** Revised after implementation review — changes required

## Objective

Deliver one complete, demonstrable Age credential journey with three mandatory user-facing flows:

1. **Authenticated, wallet-driven issuance** directly from the issuer, without an issuance QR code.
2. **Cross-device presentation** from a mobile wallet to a website using a QR code.
3. **Same-device presentation** from a mobile verifier app to the wallet using a deep link.

All three flows must use the same synthetic citizen identity and the issued SD-JWT VC. The result must prove authentication, issuer selection, direct issuance, wallet storage, holder consent, selective disclosure, cryptographic verification, and an **APPROVED** or **DENIED** age decision.

This iteration establishes the reusable issuer-wallet-verifier foundation for later use cases.

## Ownership and Control

- **Engineering owner:** Kartheek
- **Coding and testing agent:** Claude Code / Co-work, operating under Kartheek
- **Product, Design, and acceptance:** Anand

Kartheek selects the implementation technologies and a suitable open-source mobile wallet within this charter. Inji is not mandatory for this iteration, provided it completes at least one later end-to-end use case.

Neither Kartheek nor Claude may reduce, reinterpret, mock, or substitute the required user journeys. A material compatibility or architecture gap must be documented and brought to Anand before changing the baseline.

## Authoritative Inputs

Read these in order before implementation resumes:

1. [Product Definition](../../docs/project/PRODUCT.md)
2. [Architecture & Design](../../docs/design/DESIGN.md)
3. This charter
4. [Iteration review feedback](../../docs/reviews/ITERATION-01-FEEDBACK.md)
5. [Compatibility Reference](../../docs/design/COMPATIBILITY.md)
6. [Coding Agent Instructions](../../CLAUDE.md)

## Required Actors

- **National Identity Authority:** logical Age credential issuer backed by Sunbird RC.
- **Synthetic citizen:** deterministic citizen record containing the source date of birth.
- **Keycloak:** authenticates the wallet user with credentials mapped to that same citizen.
- **Mobile VC wallet:** authenticates the citizen, discovers/selects the issuer, receives and stores the credential, obtains consent, and presents selectively.
- **Web verifier:** initiates cross-device verification using a QR code.
- **Mobile verifier app:** initiates same-device verification using a deep link.
- **Reusable verifier service:** validates both presentation channels and supplies verified claims to the Age decision rule.

## Issuer, Identity, and Source Data

- Use Sunbird RC `v2.1.0` as the registry and credential foundation.
- Maintain deterministic synthetic citizen records in the independent Age data structure.
- Maintain an explicit, stable mapping between each demo Keycloak account and exactly one synthetic citizen record.
- Use the mapped citizen record—not a caller-supplied date of birth or citizen selection—as the authoritative issuance source.
- Derive `ageOver18` at the issuer from the authoritative synthetic date of birth.
- Issue a holder-bound `AgeVerificationCredential` as an SD-JWT VC through native Sunbird RC OID4VC capabilities wherever supported.
- The credential may contain data needed for holder recognition, but a presentation request must disclose only `ageOver18`; date of birth, name, and unrelated identity attributes must remain undisclosed.

## Flow 1 — Authenticated Wallet-Driven Issuance

The demonstrable user journey is:

1. The citizen opens the mobile VC wallet.
2. The wallet authenticates the citizen through Keycloak using the username/password associated with the synthetic citizen record.
3. After authentication, the wallet displays the available issuer or issuers.
4. The citizen selects the **National Identity Authority**.
5. The wallet displays the available Age credential and lets the citizen request or fetch it.
6. The issuer resolves the authenticated citizen's mapped Sunbird RC record, derives `ageOver18`, creates the holder-bound SD-JWT VC, and returns it directly to the wallet through OpenID4VCI.
7. The wallet stores the credential and renders enough information for the citizen to recognise it.

Mandatory boundaries:

- **Do not use a QR code for issuance.**
- Do not require an issuer-counter web page to start issuance.
- Do not let the user select an arbitrary citizen record in a browser or request payload.
- Do not treat Keycloak authentication alone as sufficient; the authenticated account must resolve to the correct source record.
- Do not replace the real wallet journey with a scripted client for acceptance evidence.

## Flow 2 — Cross-Device Web Verification by QR

The demonstrable user journey is:

1. An age-restricted website creates an OpenID4VP transaction requesting only `ageOver18` and displays a QR code.
2. The citizen scans the QR code with the mobile VC wallet.
3. The wallet displays the verifier identity, the requested Age credential/attribute, and a consent action.
4. The citizen selects the relevant Age credential or attribute and consents.
5. The wallet creates an SD-JWT presentation disclosing only `ageOver18` and returns it to the verifier.
6. The reusable verifier service validates the presentation and passes only verified, normalised claims to the Age decision rule.
7. The website displays **APPROVED** for an eligible citizen or **DENIED** for an ineligible or invalid response.

Acceptance requires a real mobile-wallet scan, request display, selection, consent, and presentation. Scripted-wallet coverage remains useful automated evidence but is not a substitute for the device flow.

## Flow 3 — Same-Device Mobile Verification by Deep Link

The demonstrable user journey is:

1. A separate demo mobile verifier app creates an age-verification request for only `ageOver18`.
2. The verifier app invokes the mobile VC wallet through the selected wallet's standards-compatible deep-link or same-device OpenID4VP mechanism.
3. The wallet displays the verifier identity, requested Age credential/attribute, and a consent action.
4. The citizen selects the relevant Age credential or attribute and consents.
5. The wallet returns the selective SD-JWT presentation to the mobile verifier flow.
6. The reusable verifier service validates the response; validation must not be reimplemented or bypassed in the mobile UI.
7. The mobile verifier app displays **APPROVED** or **DENIED**.

The selected wallet may determine the exact standards-compatible invocation and response mode. The final choice, versions, callback/deep-link configuration, and limitations must be recorded.

## Architecture Boundaries

- Use native Sunbird RC capabilities and released compatibility modes first.
- Use one reusable verification service for both web and mobile verifier channels.
- Keep protocol validation separate from the `ageOver18` decision rule.
- Keep Keycloak authentication and citizen-to-record mapping separate from issuer signing keys and credential data.
- Web and mobile verifier UIs display results; they do not independently trust claims or make cryptographic decisions.
- A custom standards adapter is allowed only after a reproducible compatibility gap is documented and Anand approves the material Design change.
- Do not add multi-tenancy, issuer administration, production identity proofing, or unrelated platform scope.

## Required Security and Privacy Behaviour

- Use synthetic data only.
- An authenticated Keycloak account can receive only the credential derived from its mapped citizen record; cross-citizen issuance must fail.
- Validate holder/key binding.
- Validate issuer signature, issuer trust allowlist, and the approved algorithm policy.
- Validate nonce, audience, expiry, response mode, and atomic single-use transaction state.
- Reject credential or selective-disclosure tampering.
- Reject replayed presentations.
- Apply the Age business decision only after cryptographic, protocol, holder, and trust validation succeeds.
- Both verifier channels receive only `ageOver18` and essential protocol metadata—not date of birth, name, gender, citizenship, wallet inventory, or unrelated claims.
- Cancellation or denial of consent discloses nothing and never produces approval.
- Logs and evidence must not contain passwords, secrets, access tokens, private keys, raw credentials, raw presentations, or undisclosed claims.
- No mocked wallet, hardcoded approval, UI-only simulation, disabled security check, or scripted success may be used as acceptance evidence.

## Acceptance Checklist

### Environment and identity

- [ ] A clean checkout starts Sunbird RC, Keycloak, issuer, verifier service, web verifier, and required mobile builds/configuration using documented steps.
- [ ] Deterministic eligible and ineligible synthetic citizens exist.
- [ ] Each demo Keycloak account is demonstrably mapped to the correct Sunbird RC citizen record.
- [ ] Exact Sunbird RC, Keycloak, wallet, verifier-app, protocol-profile, and compatibility-mode versions are recorded.

### Direct issuance

- [ ] The wallet authenticates an eligible citizen through Keycloak.
- [ ] The wallet lists the National Identity Authority as an available issuer.
- [ ] The citizen selects the issuer and requests the Age credential inside the wallet.
- [ ] The issuer derives the claim from the authenticated citizen's Sunbird RC record.
- [ ] The wallet receives and stores the holder-bound SD-JWT VC directly, without an issuance QR or issuer-counter page.
- [ ] After closing/reopening the wallet and authenticating again, the citizen can still find and recognise the stored credential.
- [ ] The ineligible citizen can receive a valid credential containing the issuer-derived negative assertion.
- [ ] Invalid credentials, incorrect passwords, unmapped accounts, and attempts to request another citizen's credential fail safely.

### Cross-device web verification

- [ ] The website displays a QR request for only `ageOver18`.
- [ ] The real mobile wallet scans it and displays the verifier, request, credential selection, and consent.
- [ ] Consent produces a selective SD-JWT presentation containing only the requested assertion.
- [ ] An eligible presentation displays **APPROVED** and an ineligible presentation displays **DENIED**.
- [ ] Cancellation discloses nothing and does not approve access.

### Same-device mobile verification

- [ ] A separate mobile verifier app initiates the request and opens the wallet through a deep link/same-device flow.
- [ ] The wallet displays the verifier, request, credential selection, and consent.
- [ ] The selective presentation returns to the mobile verification flow and is validated by the reusable verifier service.
- [ ] The app displays **APPROVED** or **DENIED** correctly.
- [ ] Cancellation and invalid responses fail safely without disclosure or approval.

### Security, privacy, and negative tests

- [ ] Tampered credential or disclosure is rejected.
- [ ] Wrong or untrusted issuer is rejected.
- [ ] Wrong holder key is rejected.
- [ ] Incorrect nonce or audience is rejected.
- [ ] Expired and replayed presentations are rejected.
- [ ] An unapproved algorithm is rejected or a specific Design change has been approved before implementation.
- [ ] Captured protocol evidence for both channels proves that undisclosed identity claims do not reach the verifier.
- [ ] Automated tests cover decision logic, identity mapping, issuance authorisation, verification failures, privacy, and regression.

### Demonstration and handoff

- [ ] Kartheek demonstrates all three real user journeys to Anand.
- [ ] Test results and sanitised protocol evidence are reproducible from documented commands.
- [ ] Known issues, deviations, and material decisions are explicit.
- [ ] Handshake-only files are excluded from the proposed merge unless separately approved.
- [ ] No change is merged to `main` before feedback closure and Anand's explicit sign-off.

## Required Evidence Handoff

Provide:

```text
Implementation summary
Acceptance checklist with pass/fail and evidence links
Direct issuance demo steps and screenshots/recording
Cross-device QR demo steps and screenshots/recording
Same-device deep-link demo steps and screenshots/recording
Automated test commands and results
Sanitised protocol and minimum-disclosure evidence
Component versions and compatibility mode
Identity-to-source-record mapping approach
Known issues and deviations
Material decisions requiring approval
```

## Out of Scope

- Agriculture and Education credentials or rules.
- Production identity proofing or National ID integration.
- Real personal data.
- Production deployment, scale, certification, or regulatory compliance.
- Production trust registry or revocation infrastructure.
- Multi-tenancy, sub-issuers, delegated issuer administration, or organisational hierarchies.
- Custom standards adapter unless a documented material gap is approved by Anand.
- Production-grade wallet or verifier applications beyond what is required to demonstrate the three flows.

## Sign-off Gate

The current implementation is not accepted until every mandatory flow is demonstrated and the acceptance evidence is reviewed. Nothing moves to `main` until the demo is complete, feedback is closed, and Anand explicitly signs off.
