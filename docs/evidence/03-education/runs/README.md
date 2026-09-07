# Captured runs

Verbatim output, kept so a reviewer can see results without running anything, and
so a later run can be diffed against these. Every file carries its own header with
the branch, commit, environment, image and fork tip, Node version and timestamp.

Every file was captured on a **clean working tree** at the commit named in its
header.

## The accepted results — the public deployment on `c8beec27`

These are the captures the iteration rests on. The deployment at
`https://135.235.192.9.sslip.io` runs the corrected image on all nine `oid4vc-*`
services, over its real Let's Encrypt certificate.

| File | Command | Result |
|---|---|---|
| [`test-unit-deployment.txt`](test-unit-deployment.txt) | `npm run test:unit` | **175 passed, 0 failed** |
| [`test-e2e-deployment.txt`](test-e2e-deployment.txt) | `npm run test:e2e` | **150 passed, 0 failed** |
| [`verify-deployment.txt`](verify-deployment.txt) | `./scripts/verify.sh --no-tests` | **116 passed, 0 failed, 1 skipped** |
| [`test-fork.txt`](test-fork.txt) | `npx jest` in the fork's `oid4vc-service` | **154 passed, 0 failed** |

The Age and Agriculture regression is **inside** the 150-test end-to-end run —
`regression-01-02-deployment.txt` does not exist because it would add nothing. The
arithmetic and the per-suite evidence are below.

## The earlier local-stack captures, kept for the audit trail

Same code, run before the deployment could be moved. **Not** the accepted
environment — see the SUPERSEDED note further down for why they exist.

| File | Command | Environment | Result |
|---|---|---|---|
| [`test-unit.txt`](test-unit.txt) | `npm run test:unit` | checkout only | **175 passed, 0 failed** |
| [`test-e2e.txt`](test-e2e.txt) | `npm run test:e2e` | local stack, HTTP | **150 passed, 0 failed** |
| [`regression-01-02.txt`](regression-01-02.txt) | Iteration 01 and 02 suites only | local stack, HTTP | **98 passed, 0 failed** |
| [`verify.txt`](verify.txt) | `./scripts/verify.sh --no-tests` | local stack, HTTP | **109 passed, 0 failed, 2 skipped** |

`verify-deployment.txt` is seven checks better than the local capture, and one of
them matters: **the wallet trust-pinning check runs only when the wallet's built
host matches the deployment**, so it is skipped in every local run and passes here.
Its single skip is `--no-tests`, this file's own flag.

That capture needed no ssh tunnel. `verify.sh` makes no live call to the operator
port — its three references to `8088` are static assertions about `nginx.conf` and
the compose files — and the `VERIFIER_DID` it wants was read from the deployment's
own presentation request, since the `client_id` of a `did:web` verifier is public
by construction.

The end-to-end run is the one that matters for this round: it exercises both
review fixes against the public origin over its real certificate, including the
three over-disclosure tests and the three cross-issuer tests listed above.

### The Age and Agriculture regression, against the deployment

There is no separate `regression-01-02-deployment.txt`, because there is nothing
for it to add: **that subset is contained in the 150-test end-to-end capture
above, and every one of its suites passed there.** `npm run test:e2e` runs all of
it, and the split file elsewhere in this directory is a reporting convenience
rather than extra coverage.

The arithmetic closes exactly: 150 total − 52 Education (35 in
`education.test.mjs`, 17 in `flow3-education-issuance.test.mjs`) = **98**, which is
the regression subset's own count. And it is not only arithmetic —
[`test-e2e-deployment.txt`](test-e2e-deployment.txt) lists all 49 top-level suites
as `ok`, among them Age (suites 1–9), Agriculture (10–18), the untrusted-issuer
set (19), the algorithm policy (20), data isolation (21–28), Flow 1 (38–42) and
Flow 2 (43–45).

**Eight of those 98 are local, and saying otherwise would overstate the run.**
`data-isolation.test.mjs` reaches the database with
`docker compose exec … psql` rather than over HTTP, so its eight tests inspect
whichever stack is on *this* machine no matter where `BASE` points — they are
about table separation inside the shared Postgres, which has no public route by
design. So of the 150, **142 exercised the deployment** and 8 inspected the local
database; of the 98-test regression subset, 90 and 8 respectively. The same
distinction applies to `verify.sh` and is written into its capture header.

Worth noting: suite **41**, *Flow 1 — the authorization server accepts what the
issuer advertises*, passes in that capture. It is the one that failed when the
subset was run separately minutes later, which confirms that failure was
Keycloak's brute-force lockout rather than a defect.

A separate subset run would need the ssh tunnel and the host's demo password.
When ssh is reachable, the one-command way to produce it is:

```bash
DEMO_HOST=user@host DEMO_SSH_KEY=~/.ssh/key.pem \
DEMO_DIR=/path/age-demo DEMO_ORIGIN=https://host.sslip.io \
  ./scripts/capture-demo-runs.sh --expect-image c8beec27
```

[`scripts/capture-demo-runs.sh`](../../../../scripts/capture-demo-runs.sh) exists
because this sequence has been needed three times and was fumbled twice — once by
passing `OPS_URL` to a script that reads `BASE`, so the local stack was re-seeded
while the remote was believed to be; and once by the remote `.env` overriding the
image tag. It checks the running image against `--expect-image`, spaces the suites
so brute-force protection does not trip, reads secrets into its own environment
without writing them anywhere, and hardcodes nothing about the host.

Of the 175 unit tests, **54 are in the three Education files** — 30 decision, 12
percentage, 12 fixtures — with further Education cases inside the shared DCQL,
trust and verification-gate suites. Of the 150 end-to-end tests **52 are
Education**: 35 in `tests/e2e/education.test.mjs` and 17 in
`tests/e2e/flow3-education-issuance.test.mjs`.

## The public deployment now runs the corrected image

Anand's item 3. Done on 2 September 2026: all nine `oid4vc-*` services at
`https://135.235.192.9.sslip.io` run `v2.1.0-authcode.c8beec27`, all healthy, and
the two fixes were verified **against that deployment** rather than only locally.

```
oid4vc-service  oid4vc-bank  oid4vc-farmer  oid4vc-land  oid4vc-university-vp
oid4vc-employer-vp  oid4vc-school  oid4vc-college  oid4vc-university   -> c8beec27
```

Verified there, not inferred:

| Test | Result |
|---|---|
| *a claim the job portal never asked for is refused, not quietly dropped* | pass |
| *the refusal names the unrequested claim and never its value* | pass |
| *the same three credentials are accepted when nothing extra is disclosed* | pass |
| *and refuses another institution's, by configuration id* | pass |
| *and refuses it by vct too, which is the shape a wallet sends* | pass |
| *a refused cross-issuer request leaks no registry data* | pass |

So the local stack is **not** proposed as the accepted environment. The public
deployment is, and it is the one these results come from.

### The one thing that made this harder than it should be (now fixed)

Bumping the tag in `deploy/docker-compose.yml` did **not** move the deployment.
The host's generated `deploy/.env` carried its own
`OID4VC_IMAGE=…authcode.9caf3c2b` at line 64, which overrides the compose
default, so the services were recreated with the new environment and the **old
image** — and reported healthy while doing it. `verify.sh` already warns that this
file silently overrides both the compose default and `env.example`; this is that
warning coming true. The line was updated in place, with the file backed up first
and its line count checked before and after.

### Two artefacts in these runs, neither a defect

- **Keycloak brute-force protection.** The realm sets `failureFactor: 20` and
  `waitIncrementSeconds: 30`. Driving several full suites through the same demo
  accounts inside a few minutes trips a temporary lockout, which surfaces as
  *"Keycloak refused the advertised scope … login not accepted (HTTP 200)"* in
  Flow 1. It is the protection working. Space the runs, or expect one suite to
  need a second pass.
- **ssh to the host is intermittent.** Port 22 is restricted by an Azure network
  rule to a specific source network while 80/443 are open to the internet, so it
  comes and goes with the operator's address while the deployment itself stays up
  — `/admissions/` and `/employer/` answered 200 throughout. Every drop in this
  session was that, not an outage. Use `ServerAliveInterval`; an earlier capture
  lost its tunnel mid-run and produced forty spurious `fetch failed` errors.

## SUPERSEDED — the local-stack captures, and why they exist

> **This section is history, kept for the audit trail. Every statement in it about
> the deployment has since been overtaken.** The public deployment runs
> `c8beec27`, the corrected image, and the accepted results are the
> `*-deployment.txt` captures above. `test-e2e.txt`, `regression-01-02.txt` and
> `verify.txt` are the earlier local-stack runs of the same code.

When the fixes first landed, ssh to the demo host was not answering — port 22
times out while 443 continues to serve — so the deployment could not be moved off
the 1 September image and the suites were captured against the local stack over
HTTP instead. That was recorded at the time as a caveat: the runs did not exercise
the real Let's Encrypt certificate or the public origin, though they did exercise
the same code, images and twenty containers.

**Both parts of that caveat are now closed.** ssh came back, the deployment was
moved to `c8beec27`, and the suites were re-run and re-captured against it — see
*The public deployment now runs the corrected image* above. The local-stack files
remain committed because they are the runs that were made, not because they are
the accepted environment.

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

## The two skips in the LOCAL `verify.txt`

Also history: the accepted capture is `verify-deployment.txt`, which has **one**
skip, `--no-tests`, because its trust-pinning check runs and passes against the
deployment. This describes the earlier local `verify.txt`.

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

## Why the 1 September `verify.sh` was captured with `--no-tests`

Also history, from the first evidence round, and left in place because it explains
a skip a reader will otherwise wonder about.

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
