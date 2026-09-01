# Education credentials for admission and employment

> This application is being built. The page describes the intended solution and
> will be updated with working evidence after the demonstration is accepted.

## The problem

Learners repeatedly submit certificates and marks to universities and employers.
Each receiving organization must establish whether the records are authentic,
whether they belong to the same applicant and whether the applicant satisfies a
specific rule.

The same education history may be needed for different purposes, but each
verifier should receive only the information required for its decision.

## Ecosystem actors

| Actor | Responsibility |
|---|---|
| Learner | Authenticates, obtains credentials and controls their presentation |
| School | Maintains school-completion records and issues School Certificates |
| College | Maintains college records and issues College Diplomas |
| University | Maintains degree records and issues University Degrees |
| Identity provider | Authenticates the learner and supports issuer-side record lookup |
| Wallet | Stores the three credentials and presents selected information |
| Master's institution | Verifies education history and evaluates admission-pool eligibility |
| Job provider | Verifies education history and evaluates interview-round eligibility |

## The application

One learner obtains credentials independently from a School, College and
University. The wallet stores all three.

The learner then reuses the credentials with two verifier applications. A
Master's institution applies its academic threshold. A job provider applies a
different employment-screening threshold. Both verify the same credentials, but
each makes its own transparent decision for its own purpose.

## How Sunbird RC enables it

### Education registries

Separate School, College and University entities maintain institution-specific
records. Each institution remains authoritative for the credential it issues.

### Credential issuance

Each institution issues a holder-bound credential derived from its record:

| Issuer | Credential | Example information |
|---|---|---|
| School | School Certificate | Learner ID, completion, year and percentage |
| College | College Diploma | Learner ID, qualification, specialization, completion, year and percentage |
| University | University Degree | Learner ID, degree level, field, completion, year and percentage |

### Correlation without excess identity data

National ID supports authentication and issuer-side lookup. A Learner ID links
the three credentials during verification. Institution-specific Student IDs do
not need to be disclosed.

### Reuse for different purposes

The wallet can present the same credentials to different verifiers. Verification
of signatures, issuers, holder and correlation is reusable; the Master's and job
rules remain separate application policies.

## Intended experience

### Obtain the credentials

1. The learner authenticates through the wallet.
2. The learner selects the relevant School, College and University issuers.
3. Each institution resolves its own record and issues its credential.
4. The learner reviews and stores all three credentials.

### Apply for a Master's programme

1. The institution requests the three education credentials.
2. The learner reviews the institution, purpose and requested claims.
3. The learner consents to presentation.
4. The verifier validates all credentials and applies the Master's rule.
5. An eligible applicant is accepted for consideration and waits for the
   admission list. The result is not an admission decision.

### Apply for a job

1. The job provider requests the education credentials.
2. The learner reviews and consents.
3. The verifier validates the credentials and applies the job rule.
4. An eligible candidate is selected for interview round one. The result is not
   an employment offer.

## Demonstration policies

### Master's application

- School completed with at least 60%.
- College completed with at least 60%.
- Relevant completed Bachelor's degree with at least 70%.

### Job application

- School and College completed/passed.
- Relevant completed Bachelor's degree with at least 60%.

## How to adapt this pattern

1. Identify recognized institutions and the records each controls.
2. Define institution and learner identifiers without exposing national identity
   information unnecessarily.
3. Model the School, College and University schemas.
4. Define credentials appropriate to the education system.
5. Establish accreditation, issuer onboarding and trust governance.
6. Configure the wallet for the participating institutions.
7. Define minimum disclosure separately for each application purpose.
8. Keep admission, ranking, recruitment and employment rules outside credential
   verification.
9. Add production revocation, expiry, corrections, appeals, privacy and audit
   controls.
10. Test forged issuers, mixed learners, incomplete education histories, refusal
    and policy-boundary outcomes.

## Explore the implementation

- [Sunbird RC documentation](https://docs.sunbirdrc.dev/)
- [Reference implementation repository](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations)
- [Education application inputs](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/tree/iteration/education-03-employment/iterations/03-education)

The reference implementation and public demonstration links will be added after
the application is completed and accepted.
