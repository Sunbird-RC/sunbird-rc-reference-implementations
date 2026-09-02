# Sunbird RC capabilities across applications

The three reference applications progressively combine Registry and Credential
capabilities. The matrix describes what these examples demonstrate; it is not a
boundary on the domains, registry models or credential use cases that can be
configured using Sunbird RC.

| Capability | Age verification | Rural credit | Education and employment |
|---|---|---|---|
| Authoritative sector records | Citizen | Farmer and land | Learner, School, College and University |
| Registry schemas | One citizen model | Separate Farmer and Land models | Separate education-institution models |
| Credential issuers | Identity authority | Farmer Registry and Land Registry | School, College and University |
| Credentials used together | One | Two | Three |
| Wallet-driven issuance | Yes | Yes | Yes |
| Selective disclosure | Age condition | Farmer, ownership, crop and acreage facts | Qualification and result facts |
| Cross-credential correlation | Not required | Farmer ID | Learner ID |
| Verifier applications | Age-restricted web and mobile services | Bank farm-credit application | Master's and job applications |
| Example decision | Age condition satisfied | Eligibility and maximum loan | Admission-pool or interview eligibility |

## Reusable foundation

Across the applications, Sunbird RC provides the mechanism to model records,
configure issuers, derive credentials from authoritative data and support
credential exchange. Ecosystems add their own governance, identity mapping,
trust lists, credential definitions, disclosure policies and service rules.

## Application-specific configuration

The following should be deliberately designed for each implementation:

- authoritative organizations and their registry responsibilities;
- record identifiers and permitted mappings;
- credential issuers, signing identities and trust governance;
- credential claims and minimum disclosure requirements;
- wallet and protocol-profile compatibility;
- verifier purpose, policy and user-facing outcome; and
- production privacy, security, revocation and operational controls.
