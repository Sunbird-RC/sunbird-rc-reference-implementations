# Privacy-preserving age verification

## The problem

Many services need to establish that a person is above a permitted age. The
usual approach asks for an identity document containing the person's name, date
of birth, address and other information that the service does not need.

This creates unnecessary collection of personal data and leaves the verifier to
interpret an identity document rather than verify a purpose-specific fact.

## Ecosystem actors

| Actor | Responsibility |
|---|---|
| Citizen | Authenticates, obtains the credential and controls its presentation |
| National Identity Authority | Maintains the authoritative citizen record and issues the credential |
| Identity provider | Authenticates the citizen and connects the session to the correct record |
| Wallet | Stores the credential, displays requests and obtains consent |
| Age-restricted service | Requests the minimum age evidence and makes the access decision |

## The application

The National Identity Authority derives an age condition from its authoritative
citizen record and issues an **Age Verification Credential**. The citizen stores
it in a wallet.

When a service needs age verification, it requests only the age assertion. The
citizen reviews the request and consents. The service verifies the credential and
returns an access decision without receiving the citizen's date of birth or full
identity record.

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
