# Education / Employment — Architecture and Design

**Status:** Ready for Design review
**Iteration:** 03
**Product:** [`PRODUCT.md`](PRODUCT.md)
**Requirements:** [`REQUIREMENTS.md`](REQUIREMENTS.md)

## 1. Objective

Extend the accepted foundation with three Education issuers and two verifier
purposes without duplicating identity, wallet, protocol, trust, verification,
deployment, or evidence capabilities.

## 2. Context

```text
                       Education Keycloak
                     account → National ID
                               │
               ┌───────────────┼───────────────┐
               ↓               ↓               ↓
         School issuer   College issuer   University issuer
               ↓               ↓               ↓
     SchoolCertificate CollegeDiploma  UniversityDegree
               └───────────────┼───────────────┘
                               ↓
                       Established wallet
                               ↓ OpenID4VP / QR
               ┌───────────────┴───────────────┐
               ↓                               ↓
       Master's admission portal           Job portal
               └───────────────┬───────────────┘
                               ↓
                     Reusable verifier service
                               ↓
                ┌──────────────┴──────────────┐
                ↓                             ↓
       Admission eligibility          Interview eligibility
```

## 3. Reuse

After Agriculture is accepted and merged, reuse:

- Sunbird RC registry and credential services;
- Keycloak-backed wallet-driven issuance;
- the customized wallet and build process;
- independent issuer instances and issuer-scoped advertisement;
- multi-credential request and verification processing;
- issuer-role trust, same-holder binding, algorithm policy, minimum disclosure,
  and transaction protections;
- public/operator route separation; and
- deterministic fixtures, tests, evidence, and regression conventions.

Education-specific code is limited to entities, issuer configuration, credential
schemas, two verifier websites, fixtures, and decision modules.

## 4. Components

### Education Keycloak realm

Authenticates synthetic learners and maps account subject to National ID. It is
not an Education database and exposes no National ID to verifiers.

### School, College, and University issuers

Each has its own DID, key, name, logo, credential configuration, trust role, and
source access. Each resolves the authenticated learner independently, advertises
only its own credential, and cannot issue another institution's record.

### Wallet

The Education build lists only the three issuers, performs direct issuance,
stores and discovers the credentials, matches three-credential requests, shows
purpose and disclosures, obtains consent, and constructs selective presentations.

### Reusable verifier

Creates purpose-specific three-credential requests, validates the transaction
and each credential, pins issuer/type roles, enforces the approved algorithm,
confirms same holder and Learner ID, applies disclosure policy, and passes only
verified normalized claims to a decision module.

### Decision modules

- Admission applies 60/60/70 and returns eligibility for consideration only.
- Employment requires passed School/College and University >=60%, returning
  interview-round-one selection only.

### Web portals

Start requests, display QR and results, and contain no cryptographic verification
or independent trust logic.

## 5. Data design

Use separate Education entities in the shared database:

```text
EducationLearner
SchoolRecord
CollegeRecord
UniversityRecord
```

Recommended mappings:

```text
EducationLearner: learnerId, nationalId
SchoolRecord: schoolStudentId, learnerId, nationalId, completionStatus,
              completionYear, percentage
CollegeRecord: collegeStudentId, learnerId, nationalId, qualification,
               specialization, completionStatus, completionYear, percentage
UniversityRecord: universityStudentId, learnerId, nationalId, degreeLevel,
                  fieldOfStudy, completionStatus, graduationYear, percentage
```

Identifiers use separate namespaces. Percentages are bounded and deterministic.
No table is shared with Age or Agriculture. Issuers read through Sunbird RC APIs.

## 6. Credential request design

Each verifier request has three role-labelled queries:

```text
school role     → SchoolCertificate from School
college role    → CollegeDiploma from College
university role → UniversityDegree from University
```

The request carries only claims required by that verifier's committed policy.
Missing, additional, mixed-holder, mismatched, or role-substituted credentials
are rejected before business evaluation.

## 7. Flows

Issuance:

```text
Wallet → issuer → Keycloak/SSO → National ID → Sunbird RC record
       → holder-bound SD-JWT VC → review → store
```

Presentation:

```text
Portal → three-credential request → QR
Wallet → match credentials → review claims → consent → presentation
Verifier → transaction + credentials + roles + holder + correlation + disclosure
         → purpose-specific decision
Portal → accurate next-step result
```

## 8. Decision order

1. Reject protocol or credential failure.
2. Reject unapproved algorithm or wrong issuer/type.
3. Reject mixed holders.
4. Reject mismatched Learner IDs.
5. Return `NOT ELIGIBLE` for verified policy failure.
6. Return the purpose-specific eligible next step.

Percentage comparisons use deterministic decimal arithmetic.

## 9. Test strategy

Cover mappings, table isolation, three authorized issuance flows, issuer-scoped
advertisement, role trust, holder binding, three-credential matching, disclosure,
Learner ID match/mismatch, 60% and 70% boundaries, incomplete qualifications,
unsupported fields, algorithms, tampering, wrong issuer/holder, nonce, audience,
expiry, replay, cancellation, and Age/Agriculture regression.

## 10. Architecture decisions

1. Three independent issuers: School, College, University.
2. Reuse the established customized wallet.
3. National ID is authentication and issuer lookup only.
4. Learner ID is the Education correlation value.
5. Two web QR verifier experiences; no new mobile verifier app.
6. Admission eligibility is not admission.
7. Interview eligibility is not employment.
8. Evidence and validation are implemented continuously.
9. All work remains on `iteration/education-03-employment`.
10. Implementation waits for Agriculture acceptance, merge, and branch sync.
