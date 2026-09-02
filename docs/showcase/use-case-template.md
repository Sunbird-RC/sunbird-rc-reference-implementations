# Application guide template

Use this structure to explain a new application of Sunbird RC.

## The problem

Describe the sector problem, why current approaches are difficult, and what
better outcome is required.

## Ecosystem participants, coverage and boundaries

Use one integrated table rather than separate actor and scope sections. Include
every relevant participant, its real-world responsibility and examples, what the
reference implementation demonstrates or represents, and the production work
that remains. Mark each role as **Demonstrated**, **Represented with synthetic
data/configuration**, an **Integration boundary**, or **Not addressed**.

| Participant | Ecosystem responsibility and examples | Reference coverage | Production integration remaining |
|---|---|---|---|
| Record authority | Maintains authoritative data | Represented with synthetic records | Source-system integration and stewardship |
| Credential issuer | Issues credentials from trusted records | State whether issuance is demonstrated | Accreditation, keys, revocation and operations |
| Holder and wallet | Controls storage and consent | State which wallet journeys are demonstrated | Assurance, recovery, accessibility and support |
| Verifier | Verifies evidence and provides a service | State the exact demonstrated decision | Service integration and complete business process |
| Governance body | Defines trust and accountability | State any configuration used as a stand-in | Trust-list operation, policy, audit and appeals |

Do not combine distinct authorities merely to simplify the diagram, and do not
present simulated institutions as completed production integrations.

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
