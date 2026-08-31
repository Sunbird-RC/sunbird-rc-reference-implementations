# Captured runs

Verbatim output, kept so a reviewer can see results without running anything, and
so a later run can be diffed against these. Every file carries its own header with
the branch, commit, environment, image and fork tips, Node version and timestamp.

All four were captured at commit `a0b3abe7718623c011401e6f4be1c39fb48d0f65` on
`iteration/agriculture-02-rural-credit`.

| File | Command | Environment | Result |
|---|---|---|---|
| [`test-unit.txt`](test-unit.txt) | `npm run test:unit` | checkout only | **101 passed, 0 failed** |
| [`test-e2e.txt`](test-e2e.txt) | `npm run test:e2e` | demo deployment | **96 passed, 0 failed** |
| [`verify.txt`](verify.txt) | `./scripts/verify.sh` | demo deployment | **100 passed, 0 failed, 0 skipped** |
| [`age-regression.txt`](age-regression.txt) | Iteration 01 suites only | demo deployment | **39 unit + 51 e2e passed, 0 failed** |

`verify.txt` also runs the `sunbird-rc-core` fork's own jest suite: **136 passed,
136 total**.

## Why verify.txt is captured from outside the repository

`verify.sh` asserts the working tree is clean. Writing its own output into the
repository before it runs would guarantee that check fails, so it is written to a
path outside the checkout and moved in afterwards. The same applies to the other
three for consistency.

## Regenerating them

The unit suite needs nothing but the checkout. The others run against a live
deployment whose operator endpoints are loopback-only by design, so they come
through a tunnel:

```bash
ssh -L 8090:127.0.0.1:8088 rc@<demo-host>

# Values come from deploy/.env ON THE HOST. The DIDs are public identifiers;
# DEMO_CITIZEN_PASSWORD is generated at bootstrap and never committed.
PUBLIC_URL=https://<demo-host> OPS_URL=http://127.0.0.1:8090 \
  AGE_ISSUER_DID=… VERIFIER_DID=… UNTRUSTED_ISSUER_DID=… \
  BANK_VERIFIER_DID=… FARMER_ISSUER_DID=… LAND_ISSUER_DID=… \
  DEMO_CITIZEN_PASSWORD=… \
  npm run test:e2e
```

Two things will make a re-run differ from these files, both benign:

* **The Age boundary fixtures are date-relative.** One citizen turns 18 today and
  one tomorrow, so `./scripts/seed-age-citizens.sh` has to be re-run on the day.
  The suite detects the staleness itself and fails with a message saying so
  rather than passing quietly.
* **The untrusted-issuer fixtures are provisioned by the tests** that need them
  and retired afterwards, so they exist only during the run.

## What is not in these files

Checked, not assumed: no password, token, private key, PEM or JWK secret, raw
credential, raw presentation, National ID, or undisclosed claim value appears in
any of them. The only identifiers present are public ones — `did:web` issuer and
verifier DIDs, and the deployment host.
