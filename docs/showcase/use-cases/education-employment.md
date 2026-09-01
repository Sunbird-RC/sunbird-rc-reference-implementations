# Education and employment

> **Status:** In development. This page describes the approved iteration input,
> not a completed or accepted capability.

## The sector problem

Learners repeatedly provide education records to institutions and employers.
The receiving organization must verify credentials from different issuers while
asking only for information relevant to its purpose.

## What the demonstration will prove

One learner receives credentials from a School, College and University. The
same three credentials are then reused for two independent purposes:

- eligibility to enter a Master's admission pool;
- eligibility for Software Engineer interview round one.

Eligibility does not mean admission or employment.

## Planned journey

```text
School ─────→ School Certificate ────┐
College ────→ College Diploma ───────┼─→ Wallet
University ─→ University Degree ─────┘      │
                                            ├─→ Master's admission portal
                                            └─→ Job application portal
```

## Planned registry and credential model

| Issuer | Credential | Selected information |
|---|---|---|
| School | `SchoolCertificate` | Learner ID, completion and percentage |
| College | `CollegeDiploma` | Learner ID, qualification, specialization, completion and percentage |
| University | `UniversityDegree` | Learner ID, degree level, field, completion and percentage |

National ID supports authentication and issuer-side lookup. Learner ID
correlates credentials for verification. Institution-specific Student IDs are
not disclosed.

## Planned decisions

### Master's application

- School: completed and at least 60%.
- College: completed and at least 60%.
- University: completed Bachelor degree, relevant field and at least 70%.
- Eligible result: application accepted for consideration; await the admission
  list—not admitted.

### Job application

- School and College: completed/passed.
- University: completed Bachelor degree, relevant field and at least 60%.
- Eligible result: selected for interview round one—not employed.

## Sunbird RC capabilities to be shown

- Three independent education registries and issuers.
- Three credentials stored in one wallet.
- Credential discovery and selective multi-credential presentation.
- Issuer-role, same-holder and Learner ID validation.
- Reuse of the same credentials for two verifier purposes.
- Different transparent policies applied only after verification.
- Regression of accepted Age and Agriculture capabilities.

## Iteration inputs

- [Start here](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/blob/iteration/education-03-employment/iterations/03-education/START.md)
- [Product definition](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/blob/iteration/education-03-employment/iterations/03-education/PRODUCT.md)
- [Requirements](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/blob/iteration/education-03-employment/iterations/03-education/REQUIREMENTS.md)
- [Architecture and design](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/blob/iteration/education-03-employment/iterations/03-education/DESIGN.md)
- [Final demo expectations](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/blob/iteration/education-03-employment/iterations/03-education/DEMO.md)

When the iteration is accepted, replace this status notice with demonstrated
evidence, the final video, acceptance results and implementation links.
