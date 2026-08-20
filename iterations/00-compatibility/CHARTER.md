# Iteration 00 — Wallet Compatibility Validation

## Objective

Prove that the selected Sunbird RC, EUDI Reference Wallet, and Inji Mobile releases interoperate using Sunbird RC's native OID4VC service before feature implementation begins.

This is a validation iteration. It must not build the Age, Agriculture, or Education applications.

## Ownership

- **Engineering:** Kartheek
- **Engineering agent:** Claude Code / Co-work
- **Acceptance:** Anand

Work must follow the [Git Working Model](../../docs/project/GIT-WORKING-MODEL.md) on an iteration branch created from the accepted `main` baseline.

Recommended branch:

```text
iteration/compatibility-00-wallets
```

## Baselines

- [Product Definition](../../docs/project/PRODUCT.md)
- [Architecture & Design](../../docs/design/DESIGN.md)
- [Compatibility Baseline](../../docs/design/COMPATIBILITY.md)

## Scope

### Environment

- Run Sunbird RC `v2.1.0`, including its native `oid4vc-service`.
- Pin the exact source commits and container image digests used.
- Provide externally reachable HTTPS endpoints for physical-device testing.
- Use synthetic data only.
- Use separate issuer identities and keys for all logical issuers exercised.

### EUDI / SD-JWT path

- Build or install EUDI Android Reference Wallet `2026.07.39-Demo`.
- Issue one ES256 SD-JWT VC from Sunbird RC using OpenID4VCI Final 1.0 mode.
- Bind the credential to the wallet key.
- Present only the requested claim through a DCQL/OpenID4VP web QR flow.
- Validate holder binding, audience, nonce, and single-use transaction state.

The synthetic credential may use `ageOver18`, but this iteration does not implement the Age user experience or decision application.

### Inji path

- Build or install Inji Mobile `v0.22.1`.
- Use Sunbird RC's draft-13 compatibility mode where required.
- Issue two test credentials representing two logical issuers.
- Present both credentials in one OpenID4VP transaction.
- Confirm consent and successful verifier validation.
- Record the request-object signing and client-ID mode required by Inji.

## Negative Checks

Demonstrate rejection of:

- Reused pre-authorised issuance code.
- Incorrect proof nonce or audience.
- Presentation signed by the wrong holder key.
- Reused or expired presentation transaction.
- Tampered credential or disclosure.
- Credential from an issuer outside the demo allowlist.

## Evidence

Commit concise, reproducible evidence to the iteration branch:

```text
iterations/00-compatibility/evidence/
  ENVIRONMENT.md
  EUDI.md
  INJI.md
  FAILURES.md          # only if unresolved failures exist
```

Evidence must include:

- Exact component versions, commits, image digests, and relevant configuration modes.
- Commands or repeatable steps needed to reproduce each flow.
- Sanitised request/response shapes or automated test output.
- Screenshots or a short demo recording for wallet consent and successful results.
- Results for every positive and negative acceptance check.
- No secrets, tokens, private keys, raw credentials, or personal data.

## Adapter Stop Rule

Do not create an adapter merely because the first configuration fails.

Before proposing adapter code:

1. Reproduce and isolate the failure.
2. Confirm the exact versions and protocol exchange.
3. Test the relevant Sunbird RC compatibility mode.
4. Determine whether configuration or a small upstream-aligned fix resolves it.
5. Document the minimal adapter responsibility and removal path.

Any adapter proposal is a material Design change and requires Anand's approval before implementation.

## Acceptance

This iteration is accepted when:

- [ ] Sunbird RC → EUDI SD-JWT VC issuance succeeds.
- [ ] EUDI → Sunbird RC selective presentation succeeds through web QR.
- [ ] Only the requested SD-JWT claim reaches the verifier.
- [ ] Sunbird RC → Inji issuance succeeds for two logical issuers.
- [ ] Inji presents two credentials in one verified transaction.
- [ ] Holder binding, nonce, audience, signature, issuer trust, and replay checks pass.
- [ ] All required negative cases are rejected.
- [ ] Exact runtime pins and compatibility modes are documented.
- [ ] No separate adapter is needed, or an evidenced exception has been approved.
- [ ] Kartheek demonstrates the flows and test evidence to Anand.
- [ ] Anand explicitly signs off before merge to `main`.

## Out of Scope

- Production hardening or deployment.
- Full domain schemas and business rules.
- Age, loan, or employment user interfaces.
- Mobile verifier implementation.
- Additional wallets.
- Trust registry, revocation infrastructure, or conformance certification.
