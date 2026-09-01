# Farmer and land credentials for rural credit

## The problem

A bank evaluating farm credit may need evidence from several authoritative
sources. Farmer registration can be maintained by one authority and land
ownership by another. The bank must know that both records refer to the same
farmer and must calculate eligibility using trusted crop and acreage data.

Paper documents and disconnected databases make this slow, difficult to verify
and prone to inconsistent or excessive data sharing.

## Ecosystem actors

| Actor | Responsibility |
|---|---|
| Farmer | Authenticates, obtains both credentials and consents to presentation |
| Farmer Registry | Maintains farmer records and issues Farmer Identity Credentials |
| Land Registry | Maintains ownership, crop and acreage records and issues Land Ownership Credentials |
| Identity provider | Authenticates the farmer using the National ID mapping |
| Wallet | Stores both credentials and presents selected claims together |
| Bank | Verifies both credentials, correlates the farmer and applies the farm-credit rule |

## The application

The farmer obtains a **Farmer Identity Credential** from the Farmer Registry and
a **Land Ownership Credential** from the Land Registry. Each issuer has its own
authoritative records, identity and signing boundary.

During a farm-credit application, the wallet presents selected claims from both
credentials. The bank verifies them, confirms that the Farmer ID matches, and
uses verified ownership, crop and cultivated acreage to determine eligibility
and calculate the maximum demonstration loan.

## How Sunbird RC enables it

### Farmer Registry

A Farmer entity represents the authoritative farmer record. The issuer uses the
authenticated National ID to locate the correct Farmer ID and derive the Farmer
Identity Credential.

### Land Registry

A separate Land entity represents ownership, land area, cultivated area and crop
metadata. Its issuer independently maps the authenticated person to the farmer's
land record and derives the Land Ownership Credential.

### Independent credentials

The registries use different issuer identities and keys. This enables the bank
to verify not only that each credential is signed, but also that the correct
authority issued the correct credential type.

### Multi-credential verification

The bank requests both credentials in one transaction. Verification confirms:

- both credential signatures and approved algorithms;
- the trusted issuer for each credential role;
- control by the same wallet holder;
- matching Farmer IDs;
- audience, nonce and transaction integrity; and
- disclosure of only the required claims.

The lending rule runs only after these checks succeed.

## Experience demonstrated

### Obtain farmer evidence

1. The farmer selects the Farmer Registry in the wallet.
2. Keycloak authenticates the farmer.
3. The registry maps the National ID to the Farmer record.
4. The farmer reviews and stores the Farmer Identity Credential.

### Obtain land evidence

1. The farmer selects the Land Registry.
2. The Land Registry resolves the corresponding owned land record.
3. The farmer reviews ownership, crop and acreage information.
4. The Land Ownership Credential is stored in the same wallet.

### Apply for farm credit

1. The mock bank requests both credentials through a QR code.
2. The wallet shows the bank, credentials and requested claims.
3. The farmer consents.
4. The bank verifies and correlates the credentials.
5. The bank displays eligibility and, when eligible, the maximum loan.

## Demonstration policy

    valid registered-farmer credential
    AND valid active land-ownership credential
    AND matching Farmer ID
    AND supported crop
    → maximum loan = cultivated acres × crop rate per acre

The application distinguishes:

- **ELIGIBLE** with a maximum demonstration amount;
- **NOT ELIGIBLE** when verified facts fail the lending rule;
- **REJECTED / UNABLE TO VERIFY** when trust or correlation fails; and
- **NO DATA SHARED** when the farmer refuses.

## Information design

| Needed by the bank | Kept private |
|---|---|
| Farmer ID, registered status, ownership status, crop and cultivated acreage | National ID, name, address, date of birth, Land ID, total land metadata and unrelated credentials |

## How to adapt this pattern

1. Identify the authorities responsible for farmer and land records.
2. Define separate registry schemas, stewardship and access boundaries.
3. Establish a safe National ID-to-Farmer ID-to-Land ID mapping.
4. Define the credentials and minimum claims required by lenders.
5. Establish issuer onboarding, role-based trust and key governance.
6. Configure wallet discovery to show only relevant ecosystem issuers.
7. Define the lender's policy separately from credential verification.
8. Replace the demonstration crop rates with governed policy data.
9. Add production revocation, expiry, audit, privacy, security and operational
   controls.
10. Test mismatched records, wrong issuers, wrong holders, tampering, refusal and
    incomplete evidence.

## Explore the implementation

- [Sunbird RC documentation](https://docs.sunbirdrc.dev/)
- [Reference implementation repository](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations)
- [Agriculture implementation](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/tree/main/iterations/02-agriculture)
- [Agriculture demonstration evidence](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/tree/main/docs/evidence/02-agriculture)

> Add the public customer demonstration video and live-demo link here when they
> are ready for external access.
