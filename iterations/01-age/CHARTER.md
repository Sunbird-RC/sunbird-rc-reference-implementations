# Iteration 01 — Age Verification

## Objective

Deliver the first complete Sunbird RC credential showcase: issue an age credential, store it in a mobile wallet, request and consent to minimum disclosure, verify the presentation, and return an age-eligibility decision.

This iteration establishes the reusable issuer-wallet-verifier foundation for later use cases.

## Ownership

- **Engineering:** Kartheek
- **Coding/testing agent:** Claude Code / Co-work
- **Acceptance:** Anand

Kartheek selects the implementation technologies and a suitable open-source mobile wallet. Inji is not mandatory for this iteration, provided it completes at least one later end-to-end use case.

## Baselines

- [Product Definition](../../docs/project/PRODUCT.md)
- [Architecture & Design](../../docs/design/DESIGN.md)
- [Compatibility Reference](../../docs/design/COMPATIBILITY.md)
- [Coding Agent Instructions](../../CLAUDE.md)

## Scope

### Issuer and source data

- Use Sunbird RC `v2.1.0` as the registry and credential foundation.
- Model a National Identity Authority as one logical issuer with its own identifier and signing key.
- Create an independent Age data structure containing deterministic synthetic citizen records.
- Derive `ageOver18` from authoritative synthetic date-of-birth data at the issuer side.
- Configure and issue `AgeVerificationCredential` as an SD-JWT VC through Sunbird RC's native OID4VC capabilities.
- Bind the credential to the selected wallet's holder key.

### Wallet and issuance

- Select a suitable open-source, VC-compliant mobile wallet.
- Complete an OpenID4VCI issuance flow supported by the selected wallet and Sunbird RC.
- Store and render enough credential information for the holder to recognise it.
- Record the exact wallet version and Sunbird RC compatibility mode used.

### Web verification

- Provide a web verifier that starts an OpenID4VP transaction and displays a QR code.
- Request only `ageOver18`.
- The wallet must display the verifier/requested disclosure and obtain user consent.
- Validate the returned presentation using the reusable Sunbird RC verifier capability.
- Display only **APPROVED** or **DENIED**, plus minimal non-sensitive diagnostic information appropriate for the demo.

### Reusable foundation

- Keep protocol processing generic and Age decision logic isolated.
- Establish reproducible local deployment, deterministic data setup, test execution, and demo commands.
- Structure the implementation so later issuer and use-case additions do not duplicate the core issuer-wallet-verifier flow.

## Required Security and Privacy Behaviour

- The verifier receives `ageOver18` and protocol metadata required for verification, not date of birth, name, gender, citizenship, or unrelated claims.
- Holder/key binding is validated.
- Issuer signature and demo trust allowlist are validated.
- Nonce, audience, expiry, and single-use transaction state are validated.
- Credential or disclosure tampering fails.
- Replayed presentations fail.
- Business decisions run only after successful cryptographic and trust validation.
- Logs and evidence contain no secrets, tokens, private keys, raw credentials, or raw presentations.

## Acceptance

### Positive flow

- [ ] A synthetic eligible citizen receives an `AgeVerificationCredential` in the selected mobile wallet.
- [ ] The wallet scans the web verifier's QR request.
- [ ] The wallet shows that only `ageOver18` is requested and obtains consent.
- [ ] The wallet presents `ageOver18 = true` without unrelated identity claims.
- [ ] The verifier validates the presentation and displays **APPROVED**.

### Negative and privacy flows

- [ ] A valid `ageOver18 = false` presentation returns **DENIED**.
- [ ] User denial/cancellation does not disclose claims or produce approval.
- [ ] Tampered credential or disclosure is rejected.
- [ ] Wrong issuer or an issuer outside the allowlist is rejected.
- [ ] Wrong holder key is rejected.
- [ ] Incorrect nonce or audience is rejected.
- [ ] Expired or replayed presentation is rejected.
- [ ] Verifier output and captured protocol evidence contain no undisclosed identity claims.

### Engineering evidence

- [ ] A clean checkout can start the required services using documented commands.
- [ ] Automated tests cover the decision logic and required verification failures.
- [ ] Integration tests cover issuance and presentation endpoints where automation is practical.
- [ ] Component versions, wallet version, configuration mode, and known limitations are recorded.
- [ ] Kartheek demonstrates the working mobile-wallet and web-verifier flow to Anand.

## Out of Scope

- Agriculture and Education credentials or rules.
- Mobile verifier application; it is delivered in a later iteration.
- Production identity proofing or National ID integration.
- Real personal data.
- Production deployment, scale, certification, or regulatory compliance.
- Production trust registry or revocation infrastructure.
- Multi-tenancy, sub-issuers, or issuer administration.
- Custom standards adapter unless a documented material gap is approved by Anand.

## Evidence Handoff

At demo time, provide:

```text
Implementation summary
Acceptance checklist with pass/fail
Automated test results
Positive and negative demo steps
Versions and compatibility mode
Known issues or deviations
Material decisions requiring approval
```

Nothing moves to `main` until the demo is complete, feedback is closed, and Anand explicitly signs off.
