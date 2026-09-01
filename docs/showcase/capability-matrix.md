# Capability map

The demonstrations progressively expose reusable Sunbird RC capabilities rather
than three unrelated applications.

| Capability | Age | Agriculture | Education |
|---|:---:|:---:|:---:|
| Sector registry and schema | ✓ | ✓ | Planned |
| Authenticated record lookup | ✓ | ✓ | Planned |
| Wallet-driven direct issuance | ✓ | ✓ | Planned |
| Independent credential issuers | One | Two | Three planned |
| Holder-bound SD-JWT credentials | ✓ | ✓ | Planned |
| Selective disclosure | ✓ | ✓ | Planned |
| Web QR presentation | ✓ | ✓ | Planned |
| Same-device deep link | ✓ | Supporting channel | Not required |
| Multiple credentials in one request | — | Two | Three planned |
| Issuer-role validation | ✓ | ✓ | Planned |
| Same-holder validation | ✓ | ✓ | Planned |
| Cross-credential correlation | — | Farmer ID | Learner ID planned |
| Purpose-specific decision | Age access | Farm credit | Admission and interview planned |
| Consent refusal / no disclosure | ✓ | ✓ | Planned |
| Positive and negative outcomes | ✓ | ✓ | Planned |
| Regression of earlier capabilities | Foundation | Age | Age and Agriculture planned |

## What remains reusable

The protocol, credential-validation, consent, trust, holder-binding and
transaction-protection capabilities are reusable. Sector registries, credential
claims, correlation keys, policies, presentation purpose and user experience are
configured for each domain.

## What the matrix does not claim

- A checkmark means demonstrated in this repository, not production readiness.
- “Planned” means defined for the active Education iteration, not accepted.
- Wallet interoperability depends on compatible standards profiles and hands-on
  testing with the selected wallet.
