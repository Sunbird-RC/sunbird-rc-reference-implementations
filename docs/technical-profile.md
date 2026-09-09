# Technical profile and known limitations

## Demonstrated profile

- Sunbird RC `v2.1.0`
- W3C Verifiable Credentials Data Model 2.0
- OpenID4VCI 1.0 with authorization-code and PKCE issuance
- OpenID4VP 1.0, DCQL and `direct_post`
- SD-JWT VC (`vc+sd-jwt`) with ES256 and holder-key binding
- `did:web` issuer and verifier identities
- Customized open-source Paradym mobile VC wallet

The repository carries a reproducible patch series under
`patches/oid4vc-service/`. The same changes are proposed upstream in
[Sunbird RC core PR #371](https://github.com/Sunbird-RC/sunbird-rc-core/pull/371).

## Boundaries

- All identities and records are synthetic.
- Issuer discovery is configured for each demo; a production trust-registry
  integration is not included.
- Production governance, key custody, recovery, revocation/status operations,
  audit, accessibility and regulatory controls remain adopter responsibilities.
- Agriculture demonstrates a simplified eligibility calculation, not complete
  underwriting or lending.
- Education demonstrates eligibility for consideration or interview only, not
  admission or employment.
- A known wallet deep-link decoding issue can affect some same-device URLs; the
  required cross-device QR journeys are unaffected.
