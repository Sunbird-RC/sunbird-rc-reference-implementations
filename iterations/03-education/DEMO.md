# Iteration 03 — Education / Employment: Final Demo Expectations

**Presenter:** Kartheek
**Channel:** Wallet on a phone; verifier websites on a separate screen

## 1. Issue three credentials

- Show only School, College, and University in the issuer directory.
- Authenticate one synthetic learner.
- Obtain and store School, College, and University credentials.
- Show all three in the wallet.

## 2. Master's application

- Explain School >=60%, College >=60%, and University >=70%.
- Scan the portal QR; show all three credentials, claims, purpose, and consent.
- Show an eligible applicant receiving:

```text
ELIGIBLE FOR MASTER'S APPLICATION
Application accepted for consideration.
Await the admission list.
```

- Show a verified applicant failing the rule receiving `NOT ELIGIBLE`.
- Never display `ADMITTED`.

## 3. Job application

- Explain passed School/College and University >=60%.
- Scan the job QR and review the separate three-credential request.
- Show an eligible candidate receiving:

```text
SELECTED FOR INTERVIEW — ROUND 1
```

- Show a verified candidate failing the rule receiving `NOT ELIGIBLE`.
- Never display a job offer or employment.

## 4. Privacy and failures

- Show that neither verifier receives identifiers or unrelated claims.
- Show one representative failure producing `REJECTED / UNABLE TO VERIFY`.
- Refuse one request and show `NO DATA SHARED`.

## Quality gate

- No issuance QR, unrelated issuer, unexplained trust warning, hidden technical
  intervention, or hardcoded outcome.
- All three credentials are visibly involved in each request.
- The two policies and next steps are understandable to a customer.
- Eligibility is never presented as admission or employment.

## Accompanying repository evidence

The branch must contain the final charter, line-by-line validation, captured test
runs, privacy evidence, exact versions, clean-checkout instructions, deviations,
Age and Agriculture regression, and final commit reference before sign-off.
