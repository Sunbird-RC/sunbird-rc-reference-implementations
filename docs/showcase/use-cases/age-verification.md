# Age verification

## The sector problem

An age-restricted service needs to know whether a citizen satisfies an age rule.
It does not need the citizen's complete identity record or date of birth.

## What this demonstration proves

A citizen authenticates, receives an Age Verification Credential in a wallet,
and proves the required age condition with consent. The verifier receives only
the required assertion and returns an approved or denied decision.

## Journey

```text
Synthetic citizen record
        ↓
National Identity Authority issuer
        ↓ direct authenticated issuance
Open-source wallet
        ↓ consented selective presentation
Web or mobile age verifier
        ↓
APPROVED or DENIED
```

## Registry and credential model

| Element | Demonstration configuration |
|---|---|
| Registry record | Synthetic citizen record linked to the Keycloak account |
| Issuer | National Identity Authority |
| Credential | `AgeVerificationCredential` |
| Required disclosure | Issuer-derived age condition such as `ageOver18` |
| Not disclosed | Date of birth and unrelated identity information |
| Verifiers | Cross-device website and same-device mobile application |

## Sunbird RC capabilities shown

- Registry-backed credential claims.
- Keycloak-authenticated, wallet-driven issuance without an issuance QR.
- Credential signing and holder-key binding.
- SD-JWT selective disclosure.
- Cross-device OpenID4VP request through QR.
- Same-device wallet invocation through deep link.
- Consent, nonce, audience and replay protection.
- Distinct approval, denial, verification failure and refusal outcomes.

## Why it matters

The demonstration shows how an organization can verify a condition about a
person without collecting their complete source record. It establishes the
reusable credential lifecycle used by the later sector demonstrations.

## Demonstration and implementation

- [Iteration charter](../../../iterations/01-age/CHARTER.md)
- [Acceptance evidence](../../evidence/01-age/README.md)
- [Validation table](../../evidence/01-age/VALIDATION.md)
- [Architecture baseline](../../design/DESIGN.md)

> **Public-video placeholder:** Add the final customer-ready Age demonstration
> URL and thumbnail before publishing this page.
