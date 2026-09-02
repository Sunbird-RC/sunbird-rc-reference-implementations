# Captured runs

Verbatim output, kept so a reviewer can see results without running anything, and
so a later run can be diffed against these. Every file carries its own header with
the branch, commit, environment, image and fork tip, Node version and timestamp.

All four were captured on a **clean working tree** at the commit named in their
headers.

| File | Command | Environment | Result |
|---|---|---|---|
| [`test-unit.txt`](test-unit.txt) | `npm run test:unit` | checkout only | **175 passed, 0 failed** |
| [`test-e2e.txt`](test-e2e.txt) | `npm run test:e2e` | local stack, HTTP | **150 passed, 0 failed** |
| [`regression-01-02.txt`](regression-01-02.txt) | Iteration 01 and 02 suites only | local stack, HTTP | **98 passed, 0 failed** |
| [`verify.txt`](verify.txt) | `./scripts/verify.sh --no-tests` | local stack, HTTP | **109 passed, 0 failed, 2 skipped** |
| [`test-fork.txt`](test-fork.txt) | `npx jest` in the fork's `oid4vc-service` | checkout only | **154 passed, 0 failed** |

Of the 175 unit tests, **54 are in the three Education files** — 30 decision, 12
percentage, 12 fixtures — with further Education cases inside the shared DCQL,
trust and verification-gate suites. Of the 150 end-to-end tests **52 are
Education**: 35 in `tests/e2e/education.test.mjs` and 17 in
`tests/e2e/flow3-education-issuance.test.mjs`.

## Read this before testing against the demo host

The demo deployment at `https://135.235.192.9.sslip.io` **does not yet run the
protocol fixes these runs cover.** Its `oid4vc-*` containers are still on
`v2.1.0-authcode.9caf3c2b`, the 1 September image; the two fixes are in fork
commits `1147b904` and `c8beec27`, which came after it. Only the **verifier** was
rebuilt there, which is why the request purpose does work on the host and was
confirmed on a device against it.

So a run pointed at that host today will report failures on
*a claim the job portal never asked for is refused* and on
*an institution issues only its own credential type* — because the host is not
running them, not because they do not hold. The same suites pass against the
local stack, which runs `c8beec27`, and those are the runs committed here.

Finishing the host needs the image moved over ssh (`docker save | ssh docker
load`, ~547 MB) and the nine `oid4vc-*` services recreated. Not done yet.

## These were re-captured for Anand's review, on the LOCAL stack

The 1 September captures ran against the demo deployment over HTTPS. These ran
against the local stack over HTTP, because **ssh to the demo host is still not
answering** — port 22 times out while 443 continues to serve, unchanged since the
first capture. The deployment therefore still runs the 1 September image and does
not yet carry the three fixes below; redeploying it needs the host back.

What that costs, stated rather than glossed: these runs do not exercise the real
Let's Encrypt certificate or the public origin. Everything they do exercise is
the same code, the same images and the same twenty containers, and the two
guarantees the review was about are protocol behaviour rather than transport.

What the re-capture proves that the first one could not:

- an institution is refused another institution's credential type, by
  configuration id and by `vct`
- an unrequested disclosure is refused at the protocol boundary rather than
  dropped behind it
- each Education request carries a purpose inside the **signed** request object,
  equal to the purpose its portal publishes

Two suite results changed for reasons worth naming rather than reading as drift:
Age gained one end-to-end test (the control for its rewritten over-disclosure
case) and its over-disclosure test now asserts a refusal instead of a filtered
decision. Iteration 01 got stronger from an Iteration 03 fix to the shared
service.

## The two skips, and how verify.txt was captured

`verify.sh` is captured with its own `--no-tests` flag, which is one of the two
skips. The other is **wallet trust pinning**: the vendored wallet is built for the
demo host, and this capture ran against `localhost`, so the check declines to
compare a pinned DID against a deployment it was not built for rather than
reporting a false pass or a false failure. Against the demo host it runs and
passes — see the 1 September capture.

It is also written to a path **outside** the working tree and moved in afterwards.
Writing it in place makes check 1, *working tree clean*, fail on the file being
written — which is how the first attempt at this capture reported one failure that
was an artefact of capturing it.

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
