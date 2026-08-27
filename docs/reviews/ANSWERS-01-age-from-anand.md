# Answers from Anand — Iteration 01 Revised Scope

**Date:** 25 August 2026  
**Responds to:** [`QUESTIONS-01-age-for-anand.md`](QUESTIONS-01-age-for-anand.md)

## 1. Wallet-Driven Issuance and Released Sunbird RC

Approve Option A with controls: port the Keycloak-backed OpenID4VCI `authorization_code` capability onto the `v2.1.0`-based Sunbird RC fork.

This change belongs in Sunbird RC's **`oid4vc-service` credential issuance/protocol capability**, not in the registry engine. The registry remains the authoritative source of citizen data and derived claims; the issuance service adds the authenticated-subject-to-registry-record lookup boundary.

Implement this as an **optional, configurable capability** so existing implementations are protected:

- Existing pre-authorised issuance remains supported and unchanged by default.
- Enabling Keycloak/`authorization_code` is an explicit configuration choice.
- Both grants have regression coverage and do not weaken each other's token, nonce, holder-binding, or claim-source controls.
- Keep the port narrowly scoped, pin its source commit and image digest, and describe it as an upstream-aligned addition to `v2.1.0`, not as a released `v2.1.0` feature.
- Prepare or submit an upstream contribution and record the deviation and removal/update path.
- Do not include unrelated changes from the older fork branch.

The prepared port may proceed subject to these controls and the charter evidence requirements.

## 2. Issuer Discovery

For a production ecosystem, issuer discovery should come through a trust registry together with explicit mapping and onboarding between wallets and issuers. That ecosystem capability is outside this demo.

For now, configure the relevant issuer entries in the wallet or its required companion configuration. Each use-case demo must show only the issuer or issuers relevant to that use case. For Age, listing only the National Identity Authority is sufficient. Do not add unrelated issuers merely to make the selection list larger.

Any companion component must be limited to discovery/configuration and must not become another registry, issuer, credential store, identity system, or business-rules service.

## 3. Demo Citizen Accounts

The demo may begin with pre-created synthetic citizen accounts. Enrolment and production identity proofing remain out of scope.

Provision accounts deterministically through setup fixtures. Do not commit passwords or secrets. Reproducible demo credentials may be supplied through local configuration or generated during setup and shown to the demo operator. Evidence must show the account-to-citizen mapping without exposing passwords or tokens.

## 4. Keycloak Authentication Arrangement

Either arrangement is acceptable: the wallet may interact with Keycloak directly, or the issuer may redirect the wallet/user to Keycloak.

In both cases:

- The wallet initiates the issuance journey.
- The citizen visibly authenticates through Keycloak.
- The validated Keycloak subject determines the Sunbird RC citizen record.
- The wallet cannot supply or select another citizen's record.
- Tokens are validated, scoped, and handled securely.

Choose the standards-compatible arrangement supported by the selected wallet and record it as an engineering decision.

## 5. Mobile Verifier Application

Use a separately installed mobile verifier application. It may be deliberately lightweight or based on an open-source verifier, but a normal mobile web page alone is not sufficient.

The app invokes the wallet through the selected same-device deep-link/OpenID4VP mechanism and uses the reusable verifier service. It must not implement an independent cryptographic trust path.

## 6. Consent Evidence

Provide one continuous screen recording for each primary journey, supplemented by screenshots where useful.

The recordings should show the starting application, authentication where applicable, issuer/credential selection, verifier identity, requested `ageOver18` disclosure, consent or cancellation, return to the verifier, and the final **APPROVED** or **DENIED** result.

Keep passwords, tokens, raw QR payloads, raw credentials/presentations, private keys, and unrelated attributes out of the captures or redact them.

## 7. Returning Citizen

Show both checks:

1. Close/reopen and unlock the wallet, confirming that the credential persists locally.
2. End the Keycloak session, authenticate again, and confirm that the existing credential remains available without reissuance.

## 8. Cross-Citizen Issuance Protection

An automated integration/security test is acceptable because there is intentionally no legitimate user interface for selecting another citizen.

Prove that a manipulated citizen identifier is ignored or rejected, the authenticated subject resolves only to its mapped record, an unmapped subject receives no credential, and no other citizen's claims appear in the response or logs.

## 9. Wallet Selection

There is no objection to reversing the compatibility note's candidate wallet assignment. Wallet selection remains an engineering decision.

Complete the compatibility test first, record the exact wallet/version/profile, update the compatibility findings, and demonstrate every charter journey. The Product requirement that Inji completes at least one full use case remains.

## 10. Database and Use-Case Separation

Use **one PostgreSQL database** for the showcase. Keep independent, non-overlapping tables/entities and data for Age, Agriculture, and Education.

Even when multiple use cases portray the same synthetic person, each use case maintains its own record and domain attributes. Do not create a shared cross-domain person table and do not mix or reuse domain tables. Any intentional synthetic correlation belongs only in explicit test fixtures.

Update the current dedicated Age database implementation and its tests to this model. This is now the approved Design direction.

## 11. Branch History

Do not rewrite the shared iteration history. Keep temporary handshake files absent from the final tree, review the complete net diff against accepted `main`, and use a squash merge after acceptance so `main` receives one clean iteration change.

No merge may occur before the required demonstrations, evidence review, feedback closure, and Anand's explicit sign-off.

## Proceeding

Continue on `iteration/age-01-verification`. Keep all further questions, answers, review feedback, implementation responses, challenges, decisions, and retrospective learning on this same iteration branch so its history preserves the full working record.

First update the implementation plan and compatibility findings against these decisions. Then proceed with the approved work and return the charter-mapped evidence handoff.
