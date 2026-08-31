# Education / Employment — Product Definition

**Status:** Ready for Product review
**Iteration:** 03
**Depends on:** Accepted Age and Agriculture foundations

## Purpose

Demonstrate three independent education issuers and reuse the same credentials
for two different verified decisions: eligibility to enter a Master's admission
pool and eligibility for the first round of a job interview.

This is a Sunbird RC capability showcase, not a production admission,
recruitment, or employment system.

## Customer story

A synthetic learner authenticates through Keycloak and obtains:

1. `SchoolCertificate` from the School issuer.
2. `CollegeDiploma` from the College issuer.
3. `UniversityDegree` from the University issuer.

The established customized wallet stores all three. The learner then uses them
with two independent verifiers:

- a postgraduate institution evaluating a Master's application;
- a job provider evaluating eligibility for Software Engineer interview round one.

Both verifiers validate all three credentials but receive only approved claims.

## Product outcomes

- Three independent issuers with separate identities, keys, configurations, and data.
- Authenticated wallet-driven issuance of all three credentials without issuance QR.
- Three credentials stored and discovered in one wallet.
- One consented presentation using three credentials.
- Issuer-role validation, same-holder binding, Learner ID correlation, approved
  algorithm enforcement, transaction integrity, and minimum disclosure.
- The same credentials reused for two different verifier purposes and rules.
- Clear eligible, not eligible, unverifiable, and refusal outcomes.
- No implication that eligibility equals admission or employment.

## Actors

- **Learner/applicant:** holder of the credentials.
- **Keycloak:** authenticates the synthetic learner.
- **School, College, and University:** independent issuers.
- **Wallet:** the customized Paradym-based wallet used in the accepted demos,
  configured only for Education issuers.
- **Master's admission portal:** determines entry into the admission-list pool.
- **Job portal:** determines selection for interview round one.
- **Reusable verifier service:** validates presentations before domain decisions.

## Identifier model

```text
National ID → Learner ID → institution-specific Student ID
```

- National ID is used for authentication and issuer-side lookup only.
- Learner ID correlates the three Education credentials.
- Each issuer retains its own Student ID and metadata.
- National ID and Student IDs are not disclosed to either verifier.

## Credentials

| Issuer | Credential | Claims |
|---|---|---|
| School | `SchoolCertificate` | `learnerId`, `completionStatus`, `completionYear`, `percentage` |
| College | `CollegeDiploma` | `learnerId`, `qualification`, `specialization`, `completionStatus`, `completionYear`, `percentage` |
| University | `UniversityDegree` | `learnerId`, `degreeLevel`, `fieldOfStudy`, `completionStatus`, `graduationYear`, `percentage` |

## Master's eligibility

For the Computer Science Master's demo:

```text
all three credentials valid, trusted, same-holder, and same learnerId
AND every completionStatus = COMPLETED
AND School percentage >= 60
AND College percentage >= 60
AND University percentage >= 70
AND University degreeLevel = BACHELOR
AND University fieldOfStudy is COMPUTER_SCIENCE,
    INFORMATION_TECHNOLOGY, or SOFTWARE_ENGINEERING
```

Eligible result:

```text
ELIGIBLE FOR MASTER'S APPLICATION
Application accepted for consideration.
Await the admission list.
```

Applicant ranking and the final admission list depend on the full applicant pool
and are outside this iteration. The demo must never display `ADMITTED`.

## Job eligibility

For the Software Engineer demo:

```text
all three credentials valid, trusted, same-holder, and same learnerId
AND School completionStatus = COMPLETED
AND College completionStatus = COMPLETED
AND University completionStatus = COMPLETED
AND University percentage >= 60
AND University degreeLevel = BACHELOR
AND University fieldOfStudy is COMPUTER_SCIENCE,
    INFORMATION_TECHNOLOGY, or SOFTWARE_ENGINEERING
```

School and College need only be passed; their percentages are not job thresholds.

Eligible result:

```text
SELECTED FOR INTERVIEW — ROUND 1
```

This is not an employment offer or final selection.

## Result model

Each verifier distinguishes:

- its purpose-specific eligible next step;
- `NOT ELIGIBLE` for verified claims that fail its rule;
- `REJECTED / UNABLE TO VERIFY` for credential, trust, algorithm, holder,
  correlation, disclosure, or transaction failure; and
- `NO DATA SHARED` when the holder refuses.

## Acceptance

- All three credentials are directly issued to and stored in the wallet.
- Only the three Education issuers appear in the Education wallet build.
- Both portals request all three credentials through cross-device QR.
- The holder sees verifier, purpose, credentials, claims, and consent.
- The Master's portal applies 60% School, 60% College, and 70% University.
- The job portal requires passed School/College and 60% University.
- Unrelated or undisclosed claims and credentials do not reach either verifier.
- Accepted Age and Agriculture capabilities do not regress.

## Out of scope

- Real education, identity, admission, or employment data.
- Applicant ranking, seat allocation, entrance tests, admission, or enrollment.
- Interviews, skills testing, job offers, or employment.
- Transcript subjects and individual marks.
- Production accreditation, trust registry, revocation, or regulation.
- A new mobile verifier application.
- Inji interoperability. This iteration uses the established customized wallet
  and makes no Inji compatibility claim; the project-level Inji commitment is
  handled separately.

## Success statement

> One learner, three independent issuers, three credentials, two verifier
> purposes, two transparent rules, and no unnecessary disclosure.
