# Agriculture / Rural Credit — Architecture and Design

**Status:** Updated after Iteration 01; ready for final Design review
**Iteration:** 02  
**Product:** [`PRODUCT.md`](PRODUCT.md)  
**Requirements:** [`REQUIREMENTS.md`](REQUIREMENTS.md)

> **Final wallet decision:** The delivered customized Paradym-based wallet is
> the approved design baseline. Inji is out of scope for all demos. The earlier
> Inji design and handshake sections below are retained only as iteration
> history and are superseded by
> [`DECISION-03-wallet-scope.md`](../../docs/reviews/DECISION-03-wallet-scope.md).

## 1. Design Objective

Extend the accepted Age foundation to demonstrate independent issuers, multi-credential presentation, Agriculture-specific correlation, and a crop-based bank decision without duplicating identity, wallet, protocol, verifier, trust, or deployment capabilities.

## 2. System Context

```text
                    Keycloak
             account → National ID
                       │
              ┌────────┴────────┐
              ↓                 ↓
      Farmer Registry      Land Registry
 National ID → Farmer ID  Farmer ID → Land ID
              ↓                 ↓
 FarmerIdentityCredential  LandOwnershipCredential
              └────────┬────────┘
                       ↓
                   Inji Wallet
                       ↓ OpenID4VP / QR
                 Mock Bank Website
                       ↓
             Reusable Verifier Service
                       ↓ verified claims
             Agriculture Decision Module
                       ↓
       ELIGIBLE — Maximum Loan ₹X / NOT ELIGIBLE
```

## 3. Reused Foundation

Reuse from the accepted Age implementation after it is merged into `main`:

- Sunbird RC `v2.1.0` registry and credential services.
- Approved optional Keycloak-backed wallet-driven issuance extension.
- Keycloak authentication pattern and secure account mapping.
- PostgreSQL deployment and domain-table separation.
- Issuer identity, DID, key, and HTTPS approach.
- SD-JWT VC issuance and holder binding.
- Reusable OpenID4VP verifier service.
- Trust allowlist, nonce, audience, expiry, replay protection, and the recorded
  Age algorithm-policy limitation that Agriculture must resolve explicitly.
- Public citizen routes and loopback-only operator routes.
- Evidence, version pinning, sanitisation, and test conventions.

The customized Age wallet is not the Agriculture wallet baseline. Agriculture
must use the pinned Inji Wallet build and pass the compatibility gate below.
Backend and verifier reuse must not be treated as proof of Inji compatibility.

Agriculture-specific code is limited to registry entities, issuer configurations, credential schemas, correlation, decision rules, bank UI, fixtures, and Inji compatibility configuration.

## 4. Logical Components

### Keycloak

- Authenticates synthetic farmers.
- Maps each account subject to a National ID claim.
- Does not act as the Agriculture database.
- Does not expose passwords or National IDs to the bank.

### Farmer Registry issuer

- Reads Farmer records through Sunbird RC APIs.
- Maps authenticated National ID to Farmer ID.
- Issues `FarmerIdentityCredential` under its own issuer DID and key.
- Cannot access or issue Land Registry records.

### Land Registry issuer

- Uses its own synthetic mapping to resolve the authenticated National ID to the authorised Farmer ID.
- Reads the Land record through Sunbird RC APIs.
- Issues `LandOwnershipCredential` under a different issuer DID and key.
- Cannot accept caller-selected Farmer IDs or Land IDs.

### Inji Wallet

- Shows only Farmer Registry and Land Registry in this use-case configuration.
- Completes authenticated wallet-driven issuance from both issuers.
- Stores both credentials.
- Retains both credentials through a complete close, cold start, and unlock.
- Matches the bank's multi-credential request.
- Shows the bank, purpose, credentials, disclosures, and consent action.
- Creates the selective, holder-bound presentation.

### Reusable verifier service

- Creates the multi-credential OpenID4VP request.
- Validates both credential and presentation layers.
- Applies issuer/type-specific trust rules.
- Enforces the Farmer and Land issuer roles independently; one trusted issuer
  cannot substitute for the other role.
- Produces verified, normalised claims only after all checks pass.
- Sends no raw credentials or undisclosed claims to the bank UI or decision module.

### Agriculture decision module

- Confirms Farmer ID equality.
- Evaluates farmer registration and ownership.
- Looks up the crop rate from version-controlled policy.
- Calculates maximum loan using deterministic decimal arithmetic.
- Returns a structured eligible, ineligible, or verification-rejected result.

### Mock bank website

- Starts the request and displays the QR code.
- Polls/receives the verifier result.
- Displays the verified inputs used by the policy and the final result.
- Does not perform cryptographic verification independently.

## 5. Data Design

Use the shared showcase PostgreSQL database while keeping Agriculture entities in independent tables/entity labels.

### Keycloak fixture

```text
subject
nationalId
accountStatus
```

### Farmer entity

```text
farmerId             primary domain identifier
nationalId           issuer-side lookup only
registeredFarmer
farmerCategory
district
```

### Land entity

```text
landId               primary land identifier
nationalId           issuer-side authentication lookup only
farmerId             Agriculture relationship
ownershipStatus
landAreaAcres
cropType
cultivatedAreaAcres
district
```

Constraints:

- National ID, Farmer ID, and Land ID use different namespaces and sequences.
- National ID is unique in Farmer data.
- National ID is unique in Land data and maps to the same logical synthetic farmer fixture.
- Farmer ID is unique in Farmer data and uniquely identifies the demo Land record.
- Land ID is unique in Land data.
- One Land record per farmer for this iteration.
- `0 <= cultivatedAreaAcres <= landAreaAcres`.
- Crop type is an enumerated demo value.
- No Age, Education, generic Person, or shared cross-domain table is introduced.

## 6. Credential Design

### FarmerIdentityCredential

```text
issuer: Farmer Registry DID
format: compatible SD-JWT VC profile
holder binding: wallet key
claims:
  farmerId
  registeredFarmer
  farmerCategory
  district
```

Bank disclosure:

```text
farmerId
registeredFarmer
```

### LandOwnershipCredential

```text
issuer: Land Registry DID
format: compatible SD-JWT VC profile
holder binding: wallet key
claims:
  landId
  farmerId
  ownershipStatus
  landAreaAcres
  cropType
  cultivatedAreaAcres
  district
```

Bank disclosure:

```text
farmerId
ownershipStatus
cropType
cultivatedAreaAcres
```

The bank request must pin both credential types and their respective trusted issuers. It must not request National ID.

## 7. Issuance Flows

### Farmer credential

```text
Inji → Farmer Registry selection
     → Keycloak authentication
     → validated National ID claim
     → Farmer Registry lookup through Sunbird RC
     → Farmer credential derived, holder-bound, signed
     → preview and consent
     → stored in Inji
```

### Land credential

```text
Inji → Land Registry selection
     → existing Keycloak SSO or fresh authentication
     → validated National ID claim
     → authorised National ID-to-Farmer ID resolution
     → Land lookup by Farmer ID through Sunbird RC
     → Land credential derived, holder-bound, signed
     → preview and consent
     → stored in Inji
```

Each issuer performs its own authorisation. Keycloak SSO may avoid duplicate password entry, but one issuer must not rely on another issuer's unsigned client state.

## 8. Bank Presentation Flow

```text
Bank → verifier creates request for both credential types
     → QR displayed
Inji scans → resolves request and matches both credentials
     → shows bank, purpose, credentials and requested claims
Farmer consents
Inji → selective multi-credential presentation
Verifier validates transaction, holder and each credential
     → checks Farmer and Land issuer trust independently
     → normalises verified claims
Decision module → farmerId equality
                → registration + ownership + crop policy
                → cultivated acres × rate
Bank → displays result
```

## 9. Decision Model

Version-controlled policy:

```json
{
  "PADDY": 30000,
  "WHEAT": 40000,
  "MAIZE": 25000,
  "COTTON": 45000,
  "SUGARCANE": 50000
}
```

Decision order:

1. Reject if protocol or credential verification fails.
2. Reject if either issuer/type is not trusted for its required role.
3. Reject if holder binding is invalid or credentials are presented by different holders.
4. Reject if Farmer IDs do not match.
5. Return **NOT ELIGIBLE** if farmer registration, ownership, acreage, or crop policy fails.
6. Calculate `cultivatedAreaAcres × cropRatePerAcre` using decimal-safe arithmetic.
7. Return **ELIGIBLE** with crop, acreage, rate, and maximum loan.

## 10. Inji Compatibility Gate

Before full implementation, prove on the pinned Inji build:

- Issuer configuration for Farmer Registry and Land Registry only.
- Keycloak authentication and callback arrangement.
- Direct issuance without issuance QR for both issuers.
- SD-JWT VC format and holder binding.
- Storage of both credentials.
- One OpenID4VP request satisfied by both credentials.
- Same-wallet holder binding across both presented credentials.
- Selective disclosure of the exact bank claims.
- Consent, cancellation, and cross-device QR response.
- Nonce source, authorization-server arrangement, request-object mode, callback mode, and exact component versions.

If any required capability fails, record the exact exchange and return to Anand with options before changing the Product journey or introducing an adapter.

Paradym or another wallet must not be substituted for Inji without Anand's
explicit approval.

## 11. Security and Trust

- Separate issuer DIDs, signing keys, credential configurations, and allowlist entries.
- Keycloak subject/National ID mapping validated server-side.
- No caller-selected record identifiers.
- Issuer and credential type pinned per requested role.
- Same-holder proof across the multi-credential presentation.
- Signature, nonce, audience, expiry, replay, and issuer-role validation.
- Enforce the approved algorithm policy where the protocol output makes it
  enforceable. If it is not enforceable, record the exact limitation and obtain
  Anand's approval before treating it as an accepted deviation.
- Farmer ID equality checked only after verification.
- Loan policy executed only over verified normalised claims.
- National ID and undisclosed metadata excluded from verifier outputs and logs.
- Operator endpoints remain inaccessible from public wallet/bank routes.

## 12. Test Strategy

Automated tests cover:

- National ID → Farmer ID → Land ID mapping.
- Identifier uniqueness and namespace separation.
- Authorised issuance from both registries.
- Unmapped and cross-farmer issuance rejection.
- Credential format, claims, holder binding, and storage integration.
- Multi-credential matching and minimum disclosure.
- Farmer ID match and mismatch.
- Every crop rate and acreage boundary.
- Inactive ownership, zero acreage, unsupported crop, and invalid data.
- Wrong issuer/type, tampering, wrong holder, nonce, audience, expiry, and replay.
- Cancellation with no disclosure.
- Agriculture table isolation.
- Regression of accepted Age flows.

Real-device evidence remains mandatory for the primary customer journey.

## 13. Architecture Decisions

1. Use National ID only for authentication and issuer-side record resolution.
2. Use Farmer ID for correlation between Agriculture credentials.
3. Use one owned Land record and one Land credential per farmer for this demo.
4. Store crop type and cultivated acreage in the Land Registry and Land credential; do not add a Crop Registry.
5. Use Inji Wallet, subject to the compatibility gate.
6. Use one mock bank web verifier with cross-device QR.
7. Calculate maximum loan from verified cultivated acreage and a version-controlled crop rate, capped by the table's maximum ₹50,000 per acre.
8. Keep Agriculture feedback, decisions, implementation, and evidence on `iteration/agriculture-02-rural-credit`.
9. Do not begin full implementation until Age is accepted and this branch is synchronised with the updated `main`.

## 14. Open Items Before Implementation

- Complete and sign off Age Iteration 01.
- Synchronise this branch with the resulting accepted `main` without losing its definition history.
- Run the Inji compatibility gate.
- Convert the approved Product, Requirements, and Design into the final iteration charter and acceptance checklist.
- Use [`DEMO.md`](DEMO.md) as the required customer-demonstration sequence and
  evidence outline.
