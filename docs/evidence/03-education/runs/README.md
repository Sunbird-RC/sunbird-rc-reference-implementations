# Captured runs

Verbatim output, kept so a reviewer can see results without running anything, and
so a later run can be diffed against these. Every file carries its own header with
the branch, commit, environment, image and fork tip, Node version and timestamp.

All four were captured on a **clean working tree** at the commit named in their
headers.

| File | Command | Environment | Result |
|---|---|---|---|
| [`test-unit.txt`](test-unit.txt) | `npm run test:unit` | checkout only | **167 passed, 0 failed** |
| [`test-e2e.txt`](test-e2e.txt) | `npm run test:e2e` | demo deployment, HTTPS | **145 passed, 0 failed** |
| [`regression-01-02.txt`](regression-01-02.txt) | Iteration 01 and 02 suites only | demo deployment, HTTPS | **97 passed, 0 failed** |
| [`verify.txt`](verify.txt) | `./scripts/verify.sh --no-tests` | demo deployment, HTTPS | **108 passed, 0 failed, 1 skipped** |

Of the 167 unit tests **62 are Education**; of the 145 end-to-end tests **48 are
Education** — 33 in `tests/e2e/education.test.mjs` and 15 in
`tests/e2e/flow3-education-issuance.test.mjs`.

## Why `verify.sh` was captured with `--no-tests`

`verify.sh` normally runs the unit and end-to-end suites itself. Here it was run
with its own `--no-tests` flag, which is the one skip in that file.

**Because ssh to the demo host stopped answering** partway through the evidence
capture — port 22 timing out while 443 continued to serve normally. The suites need
the operator endpoints, which are loopback-only and reached through an ssh port
forward, so `verify.sh` could no longer run them. A first attempt produced forty
`fetch failed` errors, all of them the dropped tunnel rather than test failures.

The three suites above were captured **before** that, on the same commit, and all
passed. Nothing is hidden by the skip: it is one line in `verify.txt`, the three
suite results are committed beside it, and re-running `./scripts/verify.sh` on a
host you can reach over ssh reproduces the full 111-check run.

## A flaky check worth knowing about

`the wallet trust logos are served` fetches nine PNGs sequentially with an 8-second
cap each. Against a remote host over TLS that occasionally exceeds the cap and the
whole check fails; it failed once and passed on the immediate re-run, with all nine
URLs verified as 200 by hand in between. It is a timing artefact, not drift.

## Reproducing these

The operator endpoints are loopback-only, so the port is forwarded and `OPS_URL`
points at the tunnel. **Both** `PUBLIC_URL` and `AGE_ISSUER_DID` must be exported:
setting only the first falls through to the local `deploy/.env`, which silently
mixes two deployments and fails with `invalid_grant: bad or used code`. The suite
now refuses that combination outright rather than running it.

```bash
ssh -f -N -o ServerAliveInterval=15 -L 8090:127.0.0.1:8088 user@host
get() { ssh user@host "grep -E \"^$1=\" /path/deploy/.env | cut -d= -f2-"; }

export PUBLIC_URL=https://<host> OPS_URL=http://127.0.0.1:8090 BASE=https://<host>
export AGE_ISSUER_DID="$(get AGE_ISSUER_DID)" VERIFIER_DID="$(get VERIFIER_DID)"
export UNTRUSTED_ISSUER_DID="$(get UNTRUSTED_ISSUER_DID)"
export DEMO_CITIZEN_PASSWORD="$(get DEMO_CITIZEN_PASSWORD)"

npm run test:unit && npm run test:e2e && ./scripts/verify.sh
```

`ServerAliveInterval` is not decoration — the tunnel dropping mid-run is what
produced the forty spurious failures described above.

The demo password is read from the host at run time and never written to a file
here; `verify.sh` asserts that no password of any shape we have used is committed.

## A staleness the Age suite catches itself

`AGE-000003` and `AGE-000004` are seeded to turn 18 *today* and *tomorrow*, so they
expire as fixtures. `./scripts/seed-age-citizens.sh` refreshes them, and it was run
before these captures. The suite is written to detect the staleness rather than
quietly pass — which is the only reason the boundary case means anything.
