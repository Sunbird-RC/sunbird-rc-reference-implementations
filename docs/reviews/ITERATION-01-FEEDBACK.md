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
- Credential remains available after the citizen closes/reopens the wallet and authenticates again.
- Cross-device QR presentation with wallet consent.
- Same-device deep-link presentation with wallet consent.
- Proof that only the requested age assertion reaches each verifier.
- Positive, negative, cancellation, tampering, wrong-holder, wrong-issuer, nonce, audience, expiry, and replay results.
- Updated automated tests and reproducible demo instructions.

## Existing Review Items Still Open

- Clean the implementation branch so handshake-only files are not merged into `main`.
- Enforce the approved algorithm policy or escalate a specific Design change for approval.
- Update stale implementation-plan status.
- Use one PostgreSQL database while keeping Age, Agriculture, and Education in separate non-overlapping tables/entities; update the existing dedicated-Age-database implementation accordingly.
- Demonstrate the completed iteration to Anand and close feedback before requesting merge.

## Iteration Retrospective

### What worked

- The iteration produced a substantive Sunbird RC implementation rather than a paper design.
- Synthetic citizen data and issuer-derived `ageOver18` were demonstrated.
- The SD-JWT and reusable verifier foundation is technically promising.
- Cross-device OpenID4VP worked with the scripted wallet, and the web verifier produced the expected decisions.
- Automated tests and implementation evidence gave the review a concrete basis.
- Known wallet and interoperability limitations were reported rather than hidden.

### What we learned

1. **Define journeys, not only capabilities.** Terms such as “issuance,” “wallet support,” and “end to end” allowed multiple interpretations. Every mandatory journey must identify the actor, visible user action, system interaction, expected screen/result, failure outcome, and required evidence.
2. **Keep controlled baselines consistent.** Product expected mobile verification, while Design sequencing and the original Age charter deferred it. Product, Design, charter, agent instructions, and acceptance evidence must form one traceable chain before implementation begins.
3. **Separate evidence levels.** Unit/API tests and scripted protocol clients prove technical behaviour; they do not prove the required real-wallet user experience. Acceptance must distinguish automated evidence, real-component integration, and real-device demonstration.
4. **Validate wallet compatibility early.** Before full implementation, confirm the selected wallet can support the required SD-JWT profile, Keycloak authentication journey, issuer discovery, direct issuance, cross-device QR, same-device deep link/callback, consent, and credential selection.
5. **Review earlier.** Journey and compatibility reviews should happen before substantial implementation, when a correction is still inexpensive.
6. **Record deviations as they occur.** Database layout, algorithm-policy enforcement, authentication removal, public HTTPS requirements, and similar deviations must be logged and classified as an engineering choice, an acceptance issue, or a material decision requiring Anand.
7. **Protect branch intent.** Temporary handshake material must not flow into an implementation merge merely because of branch ancestry. Implementation branches should start from the latest accepted `main`, and proposed merge contents must be checked explicitly.
8. **Completion means observable outcomes.** Successful endpoints are not sufficient when the charter requires an actual citizen journey across wallet, issuer, and verifier applications.

### Process changes for this and future iterations

Before full implementation begins:

1. Approve actor-by-actor positive, negative, cancellation, and privacy journeys.
2. Map each journey to Product, Design, charter acceptance criteria, tests, and demo evidence.
3. Complete a time-boxed compatibility check for every wallet-dependent interaction.
4. Record exact component/profile versions and any gap or workaround.
5. Confirm the iteration branch starts from the intended accepted baseline.

During implementation:

1. Review progress at journey-level checkpoints, not only at the final demo.
2. Maintain a concise decision/deviation log.
3. Keep automated protocol tests, real-component tests, and real-device evidence visibly separate.
4. Escalate material Product, Design, privacy, security, or standards changes before implementing them.

At handoff:

1. Demonstrate each journey using the required real applications.
2. Provide pass/fail traceability from every charter item to evidence.
3. Show eligible, ineligible, cancellation, authentication failure, privacy, tampering, and replay outcomes.
4. Inspect the proposed merge contents and exclude temporary handshake material.
5. Wait for Anand's explicit sign-off before merging to `main`.

## End-to-End Journey Sufficiency

No additional primary Age journey is required beyond the three revised flows:

1. Authenticated wallet-driven issuance without an issuance QR.
2. Cross-device web verification using QR.
3. Same-device mobile verification using a deep link.

These flows must, however, be demonstrated with the following variants rather than treated as separate applications:

- Eligible citizen → valid credential → **APPROVED**.
- Ineligible citizen → valid credential → **DENIED**.
- Incorrect credentials, unmapped account, and cross-citizen issuance attempt → no credential.
- User cancellation/denial → no disclosure and no approval.
- Returning authenticated user → previously issued credential remains available in the wallet.
- Tampered, expired, replayed, wrongly bound, or untrusted presentation → rejection.

Credential revocation, renewal/reissuance, recovery after wallet loss, multi-device synchronisation, and production identity proofing are useful future lifecycle journeys but are not required for the current capability-showcase iteration.

## Baseline Update

Keycloak-authenticated, wallet-driven issuance and same-device mobile verification were not explicit requirements of the original approved Age charter. They materially expand Iteration 01 and must not be described as failures against the earlier baseline.

Product, Design, the Age charter, review feedback, and Claude instructions are now aligned on the original `iteration/age-01-verification` working branch. Kartheek and Claude must continue feedback closure on this branch.
