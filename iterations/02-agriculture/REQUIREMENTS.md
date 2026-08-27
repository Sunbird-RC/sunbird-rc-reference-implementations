# Agriculture / Rural Credit — Requirements

**Status:** Updated after Iteration 01; ready for final requirements review
**Iteration:** 02

## 1. Required Demonstration Workflows

### R1 — Farmer credential issuance

1. The farmer opens Inji Wallet.
2. The farmer authenticates through Keycloak using a synthetic National ID-linked account.
3. The wallet shows the Farmer Registry as an issuer relevant to this use case.
4. The farmer requests `FarmerIdentityCredential`.
5. The issuer resolves the authenticated National ID to exactly one Farmer record.
6. The issuer returns a holder-bound credential derived from that record.
7. The farmer previews, accepts, and stores the credential.

### R2 — Land credential issuance

1. The wallet shows the Land Registry as the other relevant issuer.
2. The farmer requests `LandOwnershipCredential`.
3. The Land issuer uses its own synthetic mapping to resolve the authenticated National ID to Farmer ID and then to exactly one owned Land record.
4. The wallet or caller cannot select an arbitrary Farmer ID or Land ID.
5. The issuer returns a holder-bound credential derived from the Land record.
6. The farmer previews, accepts, and stores the credential.

After both issuance flows, the wallet must be completely closed, cold-started,
unlocked, and shown to retain both credentials.

### R3 — Bank farm-credit verification

1. The mock bank starts a farm-credit request and displays a QR code.
2. Inji Wallet scans the request.
3. The wallet identifies the Farmer and Land credentials required to satisfy it.
4. The wallet displays the bank identity, request purpose, credentials, requested attributes, and consent action.
5. The farmer consents.
6. The wallet presents the minimum required claims from both credentials.
7. The verifier validates both presentations before running the loan rule.
8. The verifier confirms that `farmerId` matches across the credentials.
9. The decision module calculates the loan using the verified crop and cultivated acreage.
10. The bank displays **ELIGIBLE — Maximum Loan ₹X** or **NOT ELIGIBLE**.

No Agriculture-specific mobile verifier is required. Web QR verification is the customer-facing channel.

## 2. Identity and Mapping Requirements

- Keycloak accounts map deterministically to synthetic National IDs.
- Each Agriculture National ID maps to at most one Farmer ID.
- Each demo Farmer ID maps to one Land ID.
- National ID, Farmer ID, and Land ID use different formats and sequences.
- The same logical synthetic farmers appear consistently across Keycloak, Farmer Registry, and Land Registry fixtures, with an issuer-side National ID mapping in each registry.
- Each registry retains its own tables and authoritative metadata.
- National ID is never used as the Agriculture presentation-correlation value.
- The authenticated account cannot obtain another farmer's or landowner's credential.
- Unmapped National ID, missing Farmer record, and missing Land record fail safely.

## 3. Issuer Requirements

- Farmer Registry and Land Registry have different stable issuer identifiers.
- Each issuer has independent signing material and credential configuration.
- Each issuer reads only its authorised source data through Sunbird RC APIs.
- The wallet lists only Farmer Registry and Land Registry for this demo.
- The wallet clearly names both issuers. Issuance must not proceed through an
  unexplained unknown- or unverified-organisation warning.
- Issuer configuration may be demo-configured in the wallet; production trust-registry discovery is deferred.
- Issuance is initiated from the wallet and must not require an issuance QR or issuer-counter webpage.

## 4. Credential Requirements

### Farmer Identity Credential

Required source claims:

- `farmerId`
- `registeredFarmer`
- `farmerCategory`
- `district`

### Land Ownership Credential

Required source claims:

- `landId`
- `farmerId`
- `ownershipStatus`
- `landAreaAcres`
- `cropType`
- `cultivatedAreaAcres`
- `district`

Rules:

- Both credentials use the compatible SD-JWT VC profile supported by Sunbird RC and the pinned Inji release.
- Both credentials are bound to the wallet holder key.
- A combined presentation must prove that both credentials are controlled by the
  same presenting wallet key; matching `farmerId` values alone are insufficient.
- `cultivatedAreaAcres` must be greater than or equal to zero and cannot exceed `landAreaAcres`.
- `cropType` must use a controlled demo vocabulary.
- Credential claims must be derived from registry data, not accepted from the wallet or bank.
- Each farmer receives one Land credential for this demo.

## 5. Disclosure Requirements

The bank request is limited to:

```text
Farmer credential: farmerId, registeredFarmer
Land credential: farmerId, ownershipStatus, cropType, cultivatedAreaAcres
```

The presentation and verifier evidence must prove that National ID, name, address, date of birth, Farmer metadata not requested, Land ID, total land metadata, district, and unrelated credentials are not disclosed.

## 6. Loan Decision Requirements

The decision engine runs only after successful credential and transaction verification.

Eligibility:

```text
registeredFarmer = true
AND farmerId values match
AND ownershipStatus = ACTIVE
AND cultivatedAreaAcres > 0
AND cropType has an approved rate
```

Calculation:

```text
maximumLoan = cultivatedAreaAcres × cropRatePerAcre
```

Rates:

```text
PADDY      ₹30,000/acre
WHEAT      ₹40,000/acre
MAIZE      ₹25,000/acre
COTTON     ₹45,000/acre
SUGARCANE  ₹50,000/acre
```

- Calculations must avoid floating-point currency errors.
- Acreage precision and currency rounding must be deterministic and documented.
- Unsupported crops and inactive ownership produce **NOT ELIGIBLE**.
- Verification failures produce **REJECTED/UNABLE TO VERIFY**, not **NOT ELIGIBLE**.

## 7. Required Demo Fixtures

- Eligible Paddy farmer.
- Eligible Wheat farmer.
- Registered farmer with inactive ownership.
- Registered farmer with an unsupported crop.
- Mismatched valid Farmer and Land credentials.
- Keycloak account without National ID mapping.
- National ID without a Farmer record.
- Farmer record without a Land record.
- Cryptographically valid credential from an untrusted Farmer issuer.
- Cryptographically valid credential from an untrusted Land issuer.

## 8. Security and Privacy Requirements

- Validate credential signatures and approved algorithms.
- If the pinned Inji/Sunbird RC exchange does not expose enough information to
  enforce the approved algorithm policy, stop and obtain Anand's decision on a
  documented deviation. Do not claim an unenforced allowlist.
- Validate each issuer against the correct trust entry and credential type.
- Enforce issuer roles: the trusted Farmer issuer cannot satisfy the Land role,
  and the trusted Land issuer cannot satisfy the Farmer role.
- Validate holder/key binding for every presented credential.
- Validate audience, nonce, expiry, response mode, and atomic single-use transaction state.
- Reject tampering and replay.
- Reject a presentation where Farmer IDs do not match.
- Never run the loan rule on unverified claims.
- Cancellation or denial of consent discloses nothing.
- Public endpoints must not expose operator, registry-write, DID-minting, schema-management, or unrestricted offer-creation operations.
- Logs and evidence must not contain passwords, tokens, private keys, raw credentials, raw presentations, National IDs, or undisclosed claims.
- Use synthetic data only.

## 9. Evidence Requirements

- Continuous real-device recording of Farmer credential issuance.
- Continuous real-device recording of Land credential issuance.
- Continuous cross-device bank verification recording showing the wallet and bank result.
- Continuous cold-restart recording showing both stored credentials still present.
- Eligible Paddy or Wheat result with the calculation visible.
- Valid ineligible result.
- Cancellation with no disclosure.
- Sanitised evidence proving minimum disclosure and Farmer ID correlation.
- Automated positive, negative, privacy, trust, holder-binding, tampering, and replay results.
- Exact Sunbird RC, Inji, Keycloak, protocol-profile, fork, image, and configuration versions.
- Clean-checkout setup, test, and demo instructions.
- Regression results for all accepted Age capabilities.
- A line-by-line acceptance table that links each requirement to the recording,
  automated test, configuration, or other reproducible evidence that closes it.

## 10. Completion Gate

The iteration is ready for acceptance only when every required workflow has real-device evidence, the requirements checklist maps to repository evidence, known deviations are explicit, Age regression is green, and Anand has reviewed the customer demonstration.

Nothing may merge into `main` without Anand's explicit sign-off.

## 11. Mandatory Inji Handshake Before Full Implementation

Before building the complete registries and bank journey, prove on the pinned
Inji Wallet build:

1. The wallet lists only the Farmer Registry and Land Registry.
2. Keycloak `authorization_code` authentication returns correctly to Inji.
3. Both issuers can issue holder-bound SD-JWT VCs directly without issuance QR.
4. Both credentials can be stored together and survive a cold restart.
5. One OpenID4VP request can be satisfied using both credentials.
6. Only the approved claims are disclosed.
7. The named bank, requested claims, consent, cancellation, and QR response are
   presented correctly.

If any item fails, capture the exact version, configuration and sanitised
protocol exchange, then escalate options to Anand before changing the journey,
replacing Inji, or adding an adapter.
