# Testing and validation

The repository includes unit, end-to-end and environment verification suites.

```bash
npm install
npm run test:unit
npm run test:e2e
./scripts/verify.sh
```

The accepted baseline recorded:

| Suite | Result |
|---|---:|
| Unit | 175 passed, 0 failed |
| End to end | 150 passed, 0 failed |
| Environment verification | 116 passed, 0 failed, 1 environment-specific skip |
| `oid4vc-service` fork | 154 passed, 0 failed |

The suites cover successful, ineligible, declined and rejected outcomes,
including issuer trust, holder binding, correlation, minimum disclosure,
tampering, replay, algorithm policy and boundary values. Run the suites again in
the target environment; these recorded totals are a baseline, not a substitute
for deployment validation.
