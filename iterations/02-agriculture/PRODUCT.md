# Agriculture / Rural Credit — Product Definition

**Status:** Updated after Iteration 01; ready for final Product review
**Iteration:** 02  
**Depends on:** Accepted Age iteration identity, credential, verifier, security, deployment, testing, and evidence foundation. Agriculture uses Inji Wallet and must prove its compatibility independently.

## Purpose

Demonstrate how Sunbird RC supports a rural-credit journey involving two independent issuers, two linked credentials, holder consent, privacy-preserving multi-credential presentation, cross-issuer correlation, and a transparent bank-loan decision.

This is a capability showcase, not a production lending system or a real agricultural registry.

## Customer Story

A synthetic farmer authenticates using the same National ID and Keycloak pattern established during Age verification. The wallet uses that authenticated identity to obtain:

1. A Farmer Identity Credential from the Farmer Registry.
2. A Land Ownership Credential from the Land Registry.

The farmer then applies for farm credit on a mock bank website. With the farmer's consent, Inji Wallet presents the minimum required information from both credentials. The bank verifies the credentials, confirms that the Farmer ID matches, applies a crop-specific per-acre lending rule, and displays the eligibility result and maximum loan amount.

## Product Outcomes

The demonstration must prove:

- National ID authentication through Keycloak.
- Deterministic mapping from National ID to Farmer ID and from Farmer ID to Land ID.
- Independent Farmer Registry and Land Registry issuers.
- Direct issuance of both credentials into Inji Wallet.
- Storage of credentials from two issuers in one wallet.
- Persistence of both credentials after the wallet is completely closed, reopened, and unlocked.
- One consented presentation containing the required information from both credentials.
- Verification of both issuers, holder binding, transaction integrity, and minimum disclosure.
- Correlation using Farmer ID without disclosing National ID.
- A crop-specific loan calculation using verified land data.
- Four clearly separated outcomes: **ELIGIBLE — Maximum Loan ₹X**, **NOT ELIGIBLE**, **REJECTED / UNABLE TO VERIFY**, and **NO DATA SHARED**.

## Actors

- **Farmer:** holder of both credentials.
- **Keycloak / National ID authentication:** authenticates the synthetic citizen and supplies the National ID mapping.
- **Farmer Registry:** resolves National ID to its Farmer record and issues `FarmerIdentityCredential`.
- **Land Registry:** uses its synthetic National ID-to-Farmer ID mapping to resolve the authenticated farmer's Land record and issues `LandOwnershipCredential`.
- **Inji Wallet:** authenticates, discovers the relevant issuers, receives and stores both credentials, obtains consent, and presents them.
- **Mock Bank:** requests the required claims and displays the farm-credit result.
- **Reusable verifier service:** validates both credentials and supplies verified claims to the loan decision module.

## Identifier Model

The three identifiers are independent and use visibly different formats and sequences:

```text
National ID → Farmer ID → Land ID
```

Example:

```text
National ID: NAT-90018472
Farmer ID:   FRM-KA-0041
Land ID:     LAND-MYS-820137
```

- National ID is used for authentication and issuer-side record resolution.
- Farmer ID is the Agriculture correlation identifier.
- Land ID identifies the owned land record.
- National ID must not be disclosed to the bank.
- No identifier may be treated as interchangeable with another.

## Credentials

### Farmer Identity Credential

Issued by the Farmer Registry and based only on its synthetic authoritative record.

Product claims:

- `farmerId`
- `registeredFarmer`
- `farmerCategory`
- `district`

### Land Ownership Credential

Issued by the Land Registry and based only on its synthetic authoritative record.

Product claims:

- `landId`
- `farmerId`
- `ownershipStatus`
- `landAreaAcres`
- `cropType`
- `cultivatedAreaAcres`
- `district`

For this demonstration, each farmer has one owned Land record and one Land credential.

## Bank Disclosure

The bank may request only:

- `farmerId` from both credentials for correlation.
- `registeredFarmer`.
- `ownershipStatus`.
- `cropType`.
- `cultivatedAreaAcres`.

The bank must not receive National ID, farmer name, date of birth, address, complete land-record metadata, parcel coordinates, unrelated wallet credentials, or undisclosed claims.

## Loan Policy

The farmer is eligible when:

```text
Farmer credential is valid
AND Land credential is valid
AND both issuers are trusted
AND both credentials are bound to the presenting holder
AND registeredFarmer = true
AND farmerId matches across both credentials
AND ownershipStatus = ACTIVE
AND cultivatedAreaAcres > 0
AND cropType is supported
```

Maximum loan:

```text
cultivatedAreaAcres × approved crop rate per acre
```

Demo crop rates:

| Crop | Rate per acre |
|---|---:|
| Paddy | ₹30,000 |
| Wheat | ₹40,000 |
| Maize | ₹25,000 |
| Cotton | ₹45,000 |
| Sugarcane | ₹50,000 |

₹50,000 is the maximum permitted per-acre rate in the demo policy. The table is illustrative and is not a real lending policy.

## Customer-Facing Result

Eligible example:

```text
ELIGIBLE
Crop: Paddy
Cultivated Area: 4 acres
Applicable Rate: ₹30,000 per acre
Maximum Loan: ₹1,20,000
```

Valid but ineligible example:

```text
NOT ELIGIBLE
Reason: No active land ownership
```

Cryptographic, trust, holder-binding, correlation-integrity, or transaction failures are verification rejections. They must not be presented as ordinary business ineligibility.

## Product Acceptance

- A real farmer journey completes issuance of both credentials into Inji Wallet.
- The wallet clearly shows the two independent issuers.
- Only the Farmer Registry and Land Registry appear in the Agriculture issuer directory; Age and unrelated issuers do not appear.
- Both credentials remain available after a complete wallet restart.
- The mock bank requests and receives the minimum information from both credentials through a web QR flow.
- The farmer sees a clearly named and trusted bank, the purpose, credentials, requested information, and consent action.
- Matching valid credentials produce the correct crop-based loan amount.
- A valid ineligible case produces **NOT ELIGIBLE**.
- Mismatched, untrusted, tampered, replayed, or incorrectly bound credentials are rejected.
- Cancellation shares nothing and produces no loan decision.
- Previously accepted Age capabilities do not regress.

Inji Wallet is an explicit Product requirement for this iteration. The accepted
Age implementation used a different open-source wallet, so its wallet behaviour
must not be assumed to transfer to Inji. Replacing Inji or materially changing
the journey requires Anand's decision.

## Out of Scope

- Real farmers, National IDs, land records, or lending decisions.
- Leasehold, tenancy, crop-insurance, subsidy, or seasonal-history workflows.
- Multiple lands or multiple crops per farmer.
- A separate Crop Registry.
- A production trust registry or issuer-onboarding platform.
- Production loan origination, underwriting, repayment, disbursement, or banking integration.
- Agriculture-specific mobile verifier application.
- Production identity proofing, fraud detection, revocation infrastructure, or regulatory compliance.

## Success Statement

The iteration succeeds when a customer can see:

> **One authenticated farmer, two independent issuers, two credentials, one consented presentation, one verified correlation, and one transparent crop-based credit decision.**
