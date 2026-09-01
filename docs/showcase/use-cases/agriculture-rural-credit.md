# Agriculture and rural credit

## The sector problem

A bank evaluating farm credit needs trusted evidence that the applicant is a
registered farmer, owns the presented land, and is cultivating an eligible crop.
The evidence comes from different authorities and must refer to the same farmer.

## What this demonstration proves

A farmer obtains credentials from independent Farmer and Land registries. With
consent, the wallet presents the minimum required claims from both. The bank
verifies them, correlates the Farmer ID and calculates the maximum loan from the
verified crop and cultivated acreage.

## Journey

```text
Farmer Registry ──→ Farmer Identity Credential ─┐
                                                ├─→ Wallet
Land Registry ────→ Land Ownership Credential ─┘       │
                                                       ↓ consent
                                                Mock bank verifier
                                                       ↓
                                  ELIGIBLE / NOT ELIGIBLE / REJECTED
```

## Registry and credential model

| Issuer | Authoritative record | Credential | Claims used by the bank |
|---|---|---|---|
| Farmer Registry | Farmer record mapped from National ID | `FarmerIdentityCredential` | Farmer ID and registered-farmer status |
| Land Registry | Land record mapped to the farmer | `LandOwnershipCredential` | Farmer ID, ownership, crop and cultivated acreage |

National ID is used for authentication and issuer-side lookup. It is not the
correlation value disclosed to the bank.

## Sunbird RC capabilities shown

- Separate Farmer and Land registry entities and metadata.
- Two independent credential issuers and signing identities.
- Wallet-driven direct issuance through Keycloak authentication.
- Two holder-bound credentials stored in one wallet.
- One consented, selective multi-credential presentation.
- Issuer allowlisting and role validation for each credential.
- Same-holder validation and Farmer ID correlation.
- ES256-only algorithm policy enforced before the business rule.
- Verified-data-based farm-credit calculation.
- Clear separation of business ineligibility, verification rejection and refusal.

## Decision example

```text
valid registered-farmer credential
AND valid active land-ownership credential
AND matching Farmer ID
AND supported crop
→ cultivated acres × approved crop rate
```

The result is a demonstration policy outcome, not a real loan approval.

## Demonstration and implementation

- [Product definition](../../../iterations/02-agriculture/PRODUCT.md)
- [Requirements](../../../iterations/02-agriculture/REQUIREMENTS.md)
- [Architecture and design](../../../iterations/02-agriculture/DESIGN.md)
- [Customer demonstration and evidence](../../evidence/02-agriculture/README.md)
- [Line-by-line acceptance](../../evidence/02-agriculture/ACCEPTANCE.md)
- [Formal sign-off](../../reviews/ITERATION-02-SIGNOFF.md)

> **Public-video placeholder:** Add a streamable customer-facing URL and
> thumbnail. Do not expose the deployment host, credentials or raw evidence.
