# Education / Employment — Requirements

**Status:** Ready for requirements review
**Iteration:** 03

## 1. Issuance

For School, College, and University:

1. The learner selects the clearly named issuer in the wallet.
2. The learner authenticates through the Education Keycloak realm.
3. The issuer resolves National ID to exactly one learner and institution record.
4. The caller cannot select another Learner ID or Student ID.
5. The issuer derives a holder-bound SD-JWT VC from its authoritative record.
6. The learner reviews, accepts, and stores the credential.

Only the three Education issuers appear. Issuance uses no QR or issuer web page.

## 2. Identity and data

- Keycloak accounts map deterministically to synthetic National IDs.
- Each National ID maps to one Education Learner ID.
- Each issuer independently maps the learner to its own Student ID and record.
- The same learner fixture is consistent across all three issuers.
- Education has separate, non-overlapping tables in the shared database.
- National ID and Student IDs remain issuer-side and are not credential claims.
- Unmapped, missing, and cross-learner requests fail safely.

## 3. Issuers

- Separate DIDs, keys, configurations, trust roles, and source access.
- Each issuer advertises only its own credential.
- Each issuer reads only its authorized entity through Sunbird RC APIs.
- One trusted Education issuer cannot substitute for another issuer's role.
- Issuer names and trust information are clear in the wallet.

## 4. Credentials

- Claims match [`PRODUCT.md`](PRODUCT.md).
- The same Education `learnerId` appears in all three primary credentials.
- Percentages are decimal values from 0 through 100 with deterministic precision.
- Completion, degree, and field values use controlled vocabularies.
- Claims come from issuer records, never the wallet or verifier.
- Primary-journey credentials bind to the same wallet holder key.

## 5. Master's portal

- Starts a cross-device QR request for all three credentials.
- Shows institution, purpose, credentials, claims, and consent in the wallet.
- Receives only policy-required disclosures.
- Validates transaction and credentials before applying the rule.
- Applies School >=60%, College >=60%, University >=70%, completed credentials,
  Bachelor degree, and accepted field of study.
- Eligible means accepted for consideration and waiting for the admission list.
- It must not claim admission.

## 6. Job portal

- Starts a separate QR request for all three credentials.
- Uses its own purpose and disclosure policy.
- Requires passed/completed School and College, completed Bachelor degree in an
  accepted field, and University percentage >=60%.
- Eligible means selected for interview round one.
- It must not claim employment, a job offer, or final selection.

## 7. Disclosure

Neither verifier receives National ID, Student IDs, name, address, date of birth,
contact details, transcripts, subjects, individual marks, unrelated metadata,
Age/Agriculture credentials, or unrequested claims.

Evidence must prove absence on the wire, not only in the UI.

## 8. Decision and security

- Verify before executing business rules.
- Enforce the approved algorithm allowlist, including positive and negative tests.
- Validate issuer/type per role, same-holder binding, audience, nonce, expiry,
  response mode, and atomic single-use state.
- Reject tampering, replay, over-disclosure, missing credentials, mixed holders,
  mismatched Learner IDs, and issuer-role substitution.
- Verified rule failure produces `NOT ELIGIBLE` with an understandable reason.
- Verification failure produces `REJECTED / UNABLE TO VERIFY` and no decision.
- Refusal produces `NO DATA SHARED` and no eligibility result.

## 9. Fixtures

- Meets both rules.
- Meets the job rule but fails the Master's University 70% rule.
- Fails the Master's School or College 60% rule.
- Fails the job University 60% rule.
- Incomplete School, College, or University qualification.
- Unsupported University field.
- Mismatched Learner IDs.
- Credentials from different holders.
- Unmapped account and missing institution records.
- Valid credential from an untrusted issuer for each role.

## 10. Evidence and completion

- Real-device recording of all three issuance flows and stored credentials.
- Continuous Master's and job QR journey recordings.
- Eligible and valid-ineligible result for both policies.
- Representative `REJECTED / UNABLE TO VERIFY` result.
- Refusal with `NO DATA SHARED`.
- Sanitized minimum-disclosure and Learner ID correlation evidence.
- Automated positive, negative, privacy, trust, algorithm, holder, tampering,
  replay, and percentage-boundary tests.
- Exact component, wallet, fork, image, profile, and configuration versions.
- Clean-checkout setup, test, and demo instructions.
- Captured Age and Agriculture regression results.
- A line-by-line table mapping every requirement to committed evidence.

Evidence is built alongside implementation, not assembled only after the demo.
Nothing merges to `main` without Anand's explicit sign-off.
