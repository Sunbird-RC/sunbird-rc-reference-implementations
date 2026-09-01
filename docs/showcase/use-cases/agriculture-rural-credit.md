# Farmer and land credentials for rural credit

## The problem

Farmers often need seasonal or working-capital credit to purchase seed,
fertilizer, equipment and other inputs. A lender assessing that application may
need to establish several facts: that the applicant is a registered farmer, that
the applicant owns or controls agricultural land, what crop is cultivated, and
how much land is under cultivation.

Those facts rarely come from one system. A Farmer Registry may be maintained by
an agriculture authority, while ownership and land metadata are maintained by a
land-administration authority. Each uses its own identifiers, records and
operational processes. The lender must determine whether the records are valid,
current, issued by the right authority and related to the same applicant.

In a document-based process, farmers may collect certificates or extracts from
multiple offices and submit copies to every lender. Banks must inspect the
documents, reconcile names or identifiers and manually enter crop and acreage
information. This increases processing time, creates opportunities for altered
or mismatched records, and may require farmers to disclose identity and land
details that are not needed for the credit decision.

Direct integration between every bank and every source registry is another
possible approach, but it creates tightly coupled point-to-point connections and
requires authoritative systems to be online for every loan application. The
real-world need is a trusted and portable way for farmers to bring verified
facts from independent authorities into a lender's digital journey, with clear
consent and minimum disclosure.

## Ecosystem actors

| Actor | Responsibility | Illustrative global examples |
|---|---|---|
| Farmer | Authenticates, obtains both credentials and consents to presentation | A smallholder, tenant, cooperative member or commercial farmer applying for seasonal or investment credit |
| Farmer Registry | Maintains farmer identity and registration records and issues Farmer Identity Credentials | A national or subnational farmer registry, agricultural-beneficiary registry, cooperative member registry or India's AgriStack Farmer Registry model |
| Agriculture authority | Governs farmer registration and relevant crop information | A ministry of agriculture, provincial/state agriculture department, agricultural payments agency or authorized programme operator |
| Land Registry | Maintains ownership, tenure, parcel and acreage records and issues Land Ownership Credentials | A national cadastral agency, deeds or titles registry, local land office, or State land-records department such as those operating under India's DILRMP |
| Identity provider | Authenticates the farmer and connects the person to the applicable records | A national eID provider such as Singpass or Aadhaar where legally authorized, or a sector identity provider; Keycloak performs this role in the demonstration |
| Wallet | Stores both credentials and presents selected claims together | A standards-compatible farmer, cooperative, bank, government or open-source credential wallet |
| Lender | Verifies both credentials, correlates the farmer and applies its credit rule | A commercial or development bank, rural or agricultural bank, credit cooperative, microfinance provider or digital lender |

The examples are jurisdiction-neutral role patterns, not a claim that any named
programme participates in the demo. Farmer registries may be national,
subnational or cooperative, while land administration may use deeds, titles,
cadastres or customary-tenure records. India's
[Farmer Registry guidance](https://agristack.gov.in/assets/registries/farmerRegistry/farmer_registry_faqs.pdf)
and [DILRMP](https://dolr.gov.in/en/programmes-schemes/dilrmp-2/) are concrete
examples of these broader registry categories.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, system-ui, Arial','primaryColor':'#E0EEFF','primaryTextColor':'#1C1D1F','primaryBorderColor':'#346DDB','lineColor':'#79859B','secondaryColor':'#F6F7FA','tertiaryColor':'#FFFFFF'}}}%%
flowchart LR
  F[Farmer] -->|Authenticates| IDP[Identity provider]
  IDP --> FR[Farmer Registry]
  IDP --> LR[Land Registry]
  FR -->|Farmer credential| W[Farmer wallet]
  LR -->|Land credential| W
  B[Bank or lender] -->|Requests both credentials| W
  W -->|Consent and selected claims| B
  B --> V[Verify trust, holder and Farmer ID]
  V --> P[Apply crop and acreage policy]
  P --> O[Eligibility and maximum amount]
```

## The application

The application allows each authority to remain responsible for its own records
while giving the farmer a portable form of evidence. After authentication, the
Farmer Registry resolves the farmer's record and issues a **Farmer Identity
Credential**. The Land Registry independently resolves the corresponding land
record and issues a **Land Ownership Credential**. Each credential is signed by
its own issuer and stored in the farmer's wallet.

The credentials have complementary roles. The Farmer credential establishes
registered-farmer status. The Land credential establishes ownership status and
provides the crop and cultivated acreage used by the demonstration policy. A
common Farmer ID makes it possible to establish that the two credentials refer
to the same farmer without exposing the National ID used for authentication.

When the farmer applies for credit, the bank requests only the facts required
for that application. The wallet shows the request and presents selected claims
from both credentials only after consent. The bank verifies the issuing
authority for each credential, confirms that both credentials are controlled by
the same holder, checks the Farmer ID correlation and rejects any invalid or
mismatched combination before evaluating eligibility.

Once the evidence is trusted, a separate lending-policy component determines
the outcome. In the demonstration, active ownership and a supported crop are
required, and the maximum amount is calculated from verified cultivated acreage
and the configured crop rate. This illustrates how authoritative evidence can
feed a transparent service rule without placing lending logic inside the
registries or wallet.

For farmers, the result is reusable evidence under their control. For source
authorities, it preserves clear data and issuer boundaries. For banks, it
provides verifiable inputs that can reduce manual document handling while still
allowing each lender to define its own governed credit policy.

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

## Watch the rural-credit application

> **Demonstration video placeholder** — Show Farmer and Land credential
> issuance, both cards surviving a wallet restart, bank QR verification,
> minimum disclosure, the loan calculation, ineligible and mismatched-record
> outcomes, and consent refusal. Replace this block with the public video URL.

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
