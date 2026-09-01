# Application guide template

Use this structure to explain a new application of Sunbird RC.

## The problem

Describe the sector problem, why current approaches are difficult, and what
better outcome is required.

## Ecosystem actors

| Actor | Responsibility |
|---|---|
| Record authority | Maintains the authoritative data |
| Credential issuer | Issues a credential from trusted records |
| Holder | Obtains and controls the credential |
| Wallet | Stores and presents credentials with consent |
| Verifier | Verifies evidence and provides a service or decision |

Adapt the actors to the ecosystem. Do not combine distinct authorities merely to
simplify the diagram.

## The application

Describe the complete user journey from authoritative record to service outcome.

## How Sunbird RC enables it

### Registry

Explain the entities, schemas, identifiers, mappings and authoritative records.

### Credentials

Explain the issuers, credentials, selected claims, signing boundaries and holder
binding.

### Wallet interaction

Explain issuance, storage, discovery, consent and presentation using the selected
standards profiles.

### Verification and outcome

Explain trust validation, correlation, minimum disclosure and the application
rule. Clearly separate business ineligibility from inability to verify and holder
refusal.

## Experience demonstrated

Present the observable journey as a short sequence. Include both successful and
important unsuccessful outcomes.

## Information design

| Used for the service | Kept private |
|---|---|
| Minimum required claims | Unrelated identifiers and attributes |

## How to adapt this pattern

Explain how another ecosystem should:

1. identify authoritative actors;
2. model registry records;
3. define identifiers and mappings;
4. define issuers and credentials;
5. establish trust governance;
6. select and compatibility-test a wallet;
7. define minimum disclosures and verifier purposes;
8. keep sector policy separate from credential verification; and
9. add production privacy, security and operational controls.

## Explore the implementation

Link, in this order:

1. the relevant Sunbird RC documentation;
2. the working reference implementation;
3. schemas and configuration;
4. a public demonstration; and
5. setup guidance for replication.

## Boundaries

State what is synthetic, simplified, planned, out of scope or not production
ready. Claim only what the working application demonstrates.
