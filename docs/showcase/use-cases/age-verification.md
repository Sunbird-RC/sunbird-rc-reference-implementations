# Privacy-preserving age verification

> **Status: completed, accepted and merged to `main` in Iteration 01.** The
> issuance, cross-device and same-device journeys have been validated with synthetic data. See the
> [committed evidence](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/tree/main/docs/evidence/01-age).

## The problem

Age checks are required across many everyday services: access to age-restricted
content or venues, purchase of regulated goods, enrollment in age-bound
programmes, and eligibility for benefits or services. In most of these cases,
the service needs a simple answer—whether the person is above or below a defined
age—not the person's complete identity.

The common approach is to ask the person to upload, photocopy or display a
government identity document. That document usually reveals far more than the
transaction requires, including the person's full name, exact date of birth,
address, photograph and identity number. The service may then retain a copy,
creating an avoidable store of sensitive personal data.

The approach is also difficult to use consistently in digital journeys. A
verifier may have to inspect a document image, calculate age, detect tampering
and decide whether the issuing authority can be trusted. Citizens repeatedly
share the same sensitive document with unrelated services, while issuing
authorities have little control over how copies are interpreted or retained.

The real-world need is therefore for a reusable digital proof that answers the
specific age question, can be verified as originating from an authoritative
source, remains under the citizen's control and does not expose unnecessary
identity information.

## Ecosystem participants, coverage and boundaries

The reference application implements the credential journey across the
highlighted participants. It does not replace the governance, legal authority or
operating systems that make an identity ecosystem authoritative.

| Participant | Ecosystem responsibility and examples | Coverage in this reference implementation | Production responsibility or integration remaining |
|---|---|---|---|
| Citizen or resident | Obtains and controls an age proof; a resident using a national eID or civil identity | **Demonstrated:** a synthetic citizen authenticates, receives the credential and controls both presentation channels | Real enrolment, account recovery, accessibility, support and lawful-consent arrangements |
| Identity provider | Authenticates and binds the session to the record; for example Singpass, an eIDAS-notified scheme or Aadhaar where lawful | **Represented:** Keycloak authenticates synthetic National ID accounts | Integration with the approved provider, required assurance and account lifecycle |
| Identity authority and Registry | Maintains authoritative identity and birth records; for example a civil registry or national identity authority | **Represented:** Sunbird RC maintains synthetic records and resolves the authenticated user | Data onboarding, corrections, stewardship, retention and lawful-use controls |
| Credential issuer | Derives and signs the age condition under the authority's mandate | **Demonstrated:** issues a holder-bound SD-JWT credential | Accreditation, production keys, revocation, expiry and audit operations |
| Wallet provider | Protects the credential, displays requests and mediates consent | **Demonstrated:** the customized open-source wallet stores and presents it | Wallet assurance, device security, recovery and interoperability acceptance |
| Age-restricted service | Requests minimum evidence and decides access; for example a retailer, platform, venue or public service | **Demonstrated:** web QR and mobile deep-link verifiers return outcomes | Integration with the actual service, applicable policy, exceptions and retention rules |
| Trust and regulatory bodies | Define recognized issuers, purposes and accountability | **Not integrated:** a configured allowlist represents trust | Legislation, trust-list operation, dispute resolution and oversight |

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, system-ui, Arial','primaryColor':'#E0EEFF','primaryTextColor':'#1C1D1F','primaryBorderColor':'#346DDB','lineColor':'#79859B','secondaryColor':'#F6F7FA','tertiaryColor':'#FFFFFF'}}}%%
flowchart LR
  C[Citizen] -->|Authenticates| IDP[Identity provider]
  IDP --> IA[Identity authority and registry]
  IA -->|Issues age credential| W[Citizen wallet]
  S[Age-restricted service] -->|Requests age condition| W
  W -->|Consent and selective proof| S
  S --> D{Age rule}
  D -->|Satisfied| A[Access approved]
  D -->|Not satisfied| N[Access denied]
```

## How this reference application uses Sunbird RC

| Sunbird RC capability | Use in this application |
|---|---|
| **Registry — source records** | The Citizen Registry contains synthetic citizen records, including date of birth and the National ID mapping resolved after Keycloak authentication. It is the source from which the age condition is derived. |
| **Credential — VC issuer** | The configured identity issuer creates and signs the **Age Verification Credential** from the corresponding Citizen Registry record. |
| **Compatible wallet** | Stores the issued credential and presents the selected age condition with consent. The wallet does not store or replace the complete authoritative Registry record. |

> All citizen records, identifiers and values used here are synthetic. Production
> deployment requires integration with the responsible identity authority's
> governed records, policies and operations.

## The application

The application turns an authoritative identity record into a reusable,
purpose-specific digital credential. After authenticating the citizen, the
National Identity Authority locates the correct record and derives an age
condition such as “over 18.” It issues an **Age Verification Credential**
directly to a wallet controlled by the citizen.

The wallet becomes the citizen's point of control. It stores the credential and
can use it with different services without asking the identity authority to
participate in every transaction. The citizen can see who is requesting
information, understand what is being requested and decide whether to share it.

When an age-restricted service initiates a request, it asks for the required age
condition rather than an identity document. With the citizen's consent, the
wallet creates a selective presentation. The service cryptographically verifies
the issuer, credential, holder and transaction before applying its access rule.

The result is a simpler experience for the service and the citizen: the service
receives a trustworthy answer, the authority remains the source of the fact, and
the citizen avoids disclosing an exact date of birth or complete identity
record. The same model works across a website using a QR code and a mobile
application using a deep link.

## How Sunbird RC enables it

### Registry

A Sunbird RC Registry models the synthetic citizen records used by the identity
authority. The authenticated National ID resolves to the correct record, but the
National ID does not have to be disclosed to the verifier.

### Credential

The credential issuer derives an age condition from the registry record and
issues a holder-bound SD-JWT credential. The credential can selectively disclose
the required assertion while withholding other claims.

### Verification

The verifier checks the credential signature, trusted issuer, holder binding,
audience, nonce and transaction state before applying the age-access rule.

## Credential lifecycle and sample data

> **Synthetic demonstration data:** The identifiers and values below are
> fictional. They are not real people, official records or a production
> credential schema.

```text
Identity Authority issues                 Wallet stores
Age Verification Credential ────────────► Holder-bound SD-JWT
        │
        ▼ citizen consents
Presented: { "ageOver18": true }
        │
        ▼
Verifier checks issuer, signature, algorithm, holder and transaction
        │
        ▼
Age-restricted service applies APPROVED or DENIED rule
```

Sample credential held in the wallet:

```json
{
  "credentialId": "AGE-VC-10027",
  "ageOver18": true,
  "issuedAt": "2026-08-20"
}
```

Only `ageOver18` is presented. The exact date of birth, National ID, address and
other identity attributes are not shared with the verifier.

## Watch the age-verification application

The committed validation evidence covers direct wallet issuance, web QR and
same-device deep-link verification, consent, minimum disclosure, and approved
and denied outcomes.

[Review the Age evidence and test results](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/tree/main/docs/evidence/01-age)

## Experience demonstrated

### Obtain the credential

1. The citizen opens the wallet and selects the National Identity Authority.
2. The citizen authenticates through Keycloak.
3. The authority finds the corresponding synthetic citizen record.
4. The credential is issued directly to the wallet—no issuance QR is used.
5. The citizen reviews and stores the credential.

### Verify across devices

1. A website displays an age-verification QR code.
2. The citizen scans it with the wallet.
3. The wallet displays the verifier and requested information.
4. The citizen consents to disclose the age condition.
5. The website verifies the response and displays **APPROVED** or **DENIED**.

### Verify on the same device

1. A mobile application requests age verification.
2. A deep link opens the wallet.
3. The citizen reviews and consents.
4. The wallet returns the presentation to the application.
5. The application verifies it and displays the result.

## Information design

| Used by the issuer | Shared with the verifier | Withheld |
|---|---|---|
| Authenticated National ID and citizen record | Required age condition | Date of birth, address and unrelated identity details |

## How to adapt this pattern

1. Identify the authoritative organization that can determine the required age
   condition.
2. Model or connect the authoritative citizen records.
3. Define a purpose-specific credential and avoid unnecessary identity claims.
4. Configure authentication-to-record mapping.
5. Establish trusted issuer identifiers and keys.
6. Select a wallet compatible with the chosen OpenID4VCI, OpenID4VP and SD-JWT
   profiles.
7. Configure verifier requests for only the required assertion.
8. Add the jurisdiction's actual age policy, privacy notice, retention policy,
   revocation model and operational controls.
9. Test positive, negative, refusal, tampering and replay cases before deployment.

## Explore the implementation

- [Sunbird RC documentation](https://docs.sunbirdrc.dev/)
- [Reference implementation repository](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations)
- [Age implementation](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/tree/main/iterations/01-age)
- [Age demonstration evidence](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/tree/main/docs/evidence/01-age)

> Add the public customer demonstration video and live-demo link here when they
> are ready for external access.
