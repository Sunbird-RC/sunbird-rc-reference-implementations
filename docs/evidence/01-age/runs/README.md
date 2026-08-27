# Captured runs

Verbatim output, kept so a reviewer can see results without running anything, and
so a later run can be diffed against them. Each file carries its own header with
the host, Node version and timestamp.

| File | Command | Result |
|---|---|---|
| [`test-unit.txt`](test-unit.txt) | `npm run test:unit` | 39 passed, 0 failed |
| [`test-e2e.txt`](test-e2e.txt) | `npm run test:e2e` against the live deployment | 50 passed, 0 failed |

## Regenerating them

The unit tests need nothing but the checkout. The end-to-end suite runs against a
live deployment, and its operator endpoints are loopback-only by design, so they
come through a tunnel:

```bash
ssh -L 8089:127.0.0.1:8088 rc@<demo-host>

PUBLIC_URL=https://<demo-host> OPS_URL=http://127.0.0.1:8089 \
  AGE_ISSUER_DID=<from deploy/.env on the host> \
  VERIFIER_DID=<from deploy/.env on the host> \
  UNTRUSTED_ISSUER_DID=<from deploy/.env on the host> \
  DEMO_CITIZEN_PASSWORD=<from deploy/.env on the host> \
  npm run test:e2e
```

Nothing in these files contains a password, token, private key, raw credential or
raw presentation. The suite provisions the untrusted-issuer fixture it needs and
retires it again, so a run leaves the deployment advertising exactly one credential.

## The verification script

`./scripts/verify.sh` is not captured here yet, because its first check is that the
working tree is clean and this work was deliberately left uncommitted for Kartheek
to stage. Its last run against the deployment was **75 of 76 checks passed**, with
that working-tree check as the only failure. Capture it after the commit:

```bash
BASE=https://<demo-host> ./scripts/verify.sh | tee docs/evidence/01-age/runs/verify.txt
```
