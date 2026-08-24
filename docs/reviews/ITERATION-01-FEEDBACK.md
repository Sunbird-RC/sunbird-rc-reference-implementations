# Iteration 01 — Age Verification Review Feedback

**Outcome:** Changes required — required user-facing wallet workflows are not yet demonstrated

## Current Output Assessment

| Required workflow | Current evidence | Status |
|---|---|---|
| Issuer reads synthetic citizen data | Age issuer reads deterministic `AgeCitizen` records through Sunbird RC | Demonstrated |
| Wallet authenticates the citizen through Keycloak using the matching synthetic record/password | Current stack has Keycloak removed and authentication disabled | Not implemented |
| Wallet lists available issuers | Current issuance starts from an issuer counter page | Not implemented |
| User selects an issuer and requests/fetches the VC from inside the wallet | Current flow creates a pre-authorised offer outside the wallet | Not implemented |
| Direct issuer-to-wallet issuance without an issuance QR | Current issuer page deliberately renders an issuance QR | Does not meet requirement |
| Cross-device presentation through web QR | Web verifier QR and scripted-wallet protocol flow work | Technically demonstrated |
| Real mobile wallet shows request and obtains consent | Paradym device run is still pending | Not yet demonstrated |
| SD-JWT selectively presents only the age assertion | Scripted-wallet evidence shows only `ageOver18` | Demonstrated technically; confirm on device |
| Website verifies and returns APPROVED/DENIED | Implemented and demonstrated locally | Demonstrated |
| Same-device verification through a separate mobile verifier app and deep link | No mobile verifier app or same-device flow exists | Not implemented |

## Required Issuance Workflow

The Age iteration must demonstrate direct wallet-driven issuance:

1. The issuer uses Sunbird RC as the source for synthetic citizen records.
2. The wallet authenticates the citizen through Keycloak using credentials associated with the same synthetic citizen record.
3. After authentication, the wallet displays the available issuer(s).
4. The citizen selects the National Identity Authority and requests the Age credential from within the wallet.
5. The wallet fetches and stores the VC directly from the issuer through OpenID4VCI.
6. **Do not use a QR code for credential issuance.**

The selected wallet and implementation may determine the precise standards-compliant interaction, but the user experience above must be demonstrated end to end.

## Required Presentation and Verification Workflows

### 1. Cross-device — web QR

1. A website starts an age-verification request and displays a QR code.
2. The citizen scans it using the mobile VC wallet.
3. The wallet displays the verifier, requested credential/attribute, and consent action.
4. The citizen selects the relevant age credential/attribute and consents.
5. The wallet presents only the required age assertion using SD-JWT selective disclosure.
6. The website verifies the response and displays **APPROVED** or **DENIED**.

The completed evidence must include the real mobile-wallet consent screen and successful presentation, not only a scripted wallet.

### 2. Same-device — mobile deep link

1. A separate demo mobile verifier app requests age verification.
2. It invokes the VC wallet using an appropriate deep link/same-device OpenID4VP flow.
3. The wallet displays the verifier request and asks for consent.
4. The citizen selects the relevant age credential/attribute and consents.
5. The wallet returns the selective SD-JWT presentation to the verifier app.
6. The mobile verifier validates the response and displays **APPROVED** or **DENIED**.

## Evidence Required for Review

- Exact Sunbird RC, Keycloak, wallet, and mobile-verifier versions.
- Mapping between the synthetic citizen record and Keycloak user.
- Wallet authentication and issuer-selection demonstration.
- Direct wallet-driven issuance with no issuance QR.
- Credential visible in wallet after issuance.
- Cross-device QR presentation with wallet consent.
- Same-device deep-link presentation with wallet consent.
- Proof that only the requested age assertion reaches each verifier.
- Positive, negative, cancellation, tampering, wrong-holder, wrong-issuer, nonce, audience, expiry, and replay results.
- Updated automated tests and reproducible demo instructions.

## Existing Review Items Still Open

- Clean the implementation branch so handshake-only files are not merged into `main`.
- Enforce the approved algorithm policy or escalate a specific Design change for approval.
- Update stale implementation-plan status.
- Record the dedicated Age database deviation for acceptance.
- Demonstrate the completed iteration to Anand and close feedback before requesting merge.

## Baseline Impact

Keycloak-authenticated, wallet-driven issuance and same-device mobile verification were not explicit requirements of the approved Age charter. They are now requested acceptance behaviour and materially expand Iteration 01.

Before implementation resumes, update the Product, Design, and Age charter as necessary so Kartheek and Claude work against one clear baseline. Do not treat these additions as previously failed criteria.
