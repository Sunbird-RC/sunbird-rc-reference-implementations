# Applications of Sunbird RC

Sunbird RC helps ecosystems create trusted registries and issue verifiable
credentials from authoritative records. People can hold those credentials in a
standards-compatible wallet and present only the information required for a
service or decision.

These applications show how the same Registry and Credential foundation can be
adapted to very different sectors.

## Explore the applications

### Privacy-preserving age verification

Enable a person to prove that they satisfy an age requirement without sharing
their date of birth or complete identity record.

[Explore age verification →](use-cases/age-verification.md)

### Farmer and land credentials for rural credit

Allow a bank to verify farmer registration, land ownership and crop information
from independent authoritative sources before calculating farm-credit
eligibility.

[Explore agriculture and rural credit →](use-cases/agriculture-rural-credit.md)

### Education credentials for admission and employment

Allow a learner to obtain credentials from a School, College and University and
reuse them for postgraduate admission and employment screening.

[Explore education and employment →](use-cases/education-employment.md)

## The common pattern

```text
Authoritative sector records
          ↓
Sunbird RC Registry
          ↓
Trusted credential issuer
          ↓
Standards-compatible wallet
          ↓ holder consent and selected information
Verifier application
          ↓
Service or decision
```

The sector changes, but the reusable pattern remains:

1. Model authoritative records using Registry schemas.
2. Connect authenticated users to the correct records.
3. Issue verifiable credentials derived from those records.
4. Store credentials in a standards-compatible wallet.
5. Request and present only the information required for a purpose.
6. Verify trust and integrity before applying a sector rule.

## What Sunbird RC contributes

- Configurable registries for sector-specific records.
- Credential schemas and issuer configurations.
- Credentials derived from authoritative registry data.
- Independent issuer identities and signing boundaries.
- Standards-based issuance and presentation interfaces.
- Reusable verification capabilities that can precede sector-specific decisions.

The demonstrations use a customized open-source wallet. The integration is
standards-aligned; any selected wallet must still be tested against the exact
protocol and credential profile used by an implementation.

## From application to implementation

Each application guide explains:

- the problem being addressed;
- the actors and their responsibilities;
- the records and credentials involved;
- how Sunbird RC enables the solution;
- the experience being demonstrated; and
- how another ecosystem can adapt the pattern.

After understanding an application, use the linked reference implementation and
Sunbird RC resources to examine schemas, configuration, APIs and working code.

> These applications use synthetic data and simplified policies to demonstrate
> capabilities. They are reference patterns, not production deployments or
> sector-policy recommendations.
