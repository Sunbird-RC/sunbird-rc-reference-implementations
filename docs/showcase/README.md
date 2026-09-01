# Sunbird RC in Action

Sunbird RC provides reusable registry and credential capabilities for building
trusted digital ecosystems. These demonstrations show how the same foundation
can support different sectors without turning Sunbird RC into a sector-specific
application.

## What the demonstrations prove

Across Age, Agriculture, and Education, the showcase follows one lifecycle:

> **Register → Issue → Store → Request → Consent → Present → Verify → Decide**

Each sector configures its own records, issuers, credential schemas, disclosed
claims, and decision rules. The reusable Sunbird RC and standards layer remains
consistent.

| Use case | Sector outcome | Sunbird RC capability focus | Status |
|---|---|---|---|
| [Age verification](use-cases/age-verification.md) | Prove an age condition without disclosing full identity | Registry-backed issuance, selective disclosure, web and mobile verification | Demonstrated |
| [Agriculture and rural credit](use-cases/agriculture-rural-credit.md) | Verify farmer and land records before calculating farm credit | Multiple registries, issuers and credentials; correlation and policy | Demonstrated |
| [Education and employment](use-cases/education-employment.md) | Reuse three education credentials for admission and employment screening | Credential discovery, multi-credential presentation and purpose-specific decisions | In development |

## Reusable capability layers

### Registry

- Define sector-specific entities and schemas.
- Maintain authoritative synthetic source records for the demonstrations.
- Keep each issuer's data and responsibilities logically separate.
- Resolve an authenticated person to the correct domain record.

### Credentials

- Configure independent credential issuers and signing identities.
- Issue credentials derived from registry records.
- Bind credentials to the holder's wallet key.
- Support SD-JWT selective disclosure and standards-based presentation.
- Verify credential integrity, issuer trust, holder binding and transaction state.

### Wallet integration

- Use standards-based OpenID4VCI and OpenID4VP interactions.
- Authenticate through Keycloak for wallet-driven issuance.
- Store credentials, display requests, obtain consent and present selected claims.
- Keep the wallet replaceable where compatible protocol and credential profiles
  are supported and tested.

The current demonstrations use the established customized Paradym-based
open-source wallet. They demonstrate standards-aligned integration but do not
claim that every wallet works without compatibility testing.

## Choose your path

- **Sector and programme leaders:** start with an individual use case and its
  outcome.
- **Government and ecosystem architects:** see the [capability matrix](capability-matrix.md).
- **Implementers:** follow the repository links on each use-case page.
- **Demonstrators:** use the customer story and final-demo sequence on each page.

## Important boundary

These are capability demonstrations using synthetic data. They are not
production services, policy recommendations, regulatory certifications, loan
systems, admission systems, or recruitment systems.
