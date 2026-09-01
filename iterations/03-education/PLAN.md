# Iteration 03 — Education / Employment: requirement-to-test plan

`START.md` asks for this before any coding, and for the line-by-line validation
to be built throughout rather than assembled after the demo. This is the plan;
`docs/evidence/03-education/ACCEPTANCE.md` will grow alongside the code and
becomes the handoff artefact.

**Branch** `iteration/education-03-employment`, synchronised with the accepted
`main` (Agriculture merge `9e51575`, which contains sign-off commit `bc41b8a`).

## What is reused, and what is actually new

`DESIGN.md` §3 limits Education-specific code to entities, issuer configuration,
credential schemas, two verifier websites, fixtures and decision modules. Holding
to that is the point: three iterations sharing one verifier is the showcase's
central claim, and every line of Education-specific verification logic would
weaken it.

Reused unchanged: the registry and credential services, Keycloak-backed
wallet-driven issuance, the vendored wallet and its build script, issuer-scoped
advertisement (`ADVERTISE_OWN_CREDENTIALS_ONLY`), the multi-credential read loop,
issuer-role trust, same-holder binding, the approved-algorithm policy, minimum
disclosure, transaction protections, the public/operator route split, and the
fixture/evidence conventions.

New:

| Area | What |
|---|---|
| Registry | `EducationLearner`, `SchoolRecord`, `CollegeRecord`, `UniversityRecord` — no table shared with Age or Agriculture |
| Issuers | three instances: `oid4vc-school`, `oid4vc-college`, `oid4vc-university`, each with its own DID, subject entity and path prefix |
| Keycloak | an `education` realm, subject claim `nationalId` |
| Verifier | two use cases in the existing `USE_CASES` map — `masters` and `job` — each with three role-labelled queries |
| Decision | `services/verifier/src/domains/education/` — two rule modules over one shared claim set, plus deterministic percentage arithmetic |
| Portals | two static pages, `masters-web` and `job-web`, each talking only to its own namespace |
| Wallet | an Education build whose issuer directory lists only the three issuers |

## The one architectural consequence to settle first

**Two verifiers means two more signing identities, not one.**

A wallet names the requesting party from the key that signed the request object.
Agriculture proved this the hard way: while one `VERIFIER_DID` served both use
cases, a farmer applying for crop credit was asked to trust "Age Check". The fix
was `oid4vc-bank`, a signer that issues nothing.

Education adds **two** distinct parties — the Master's portal and the Job portal —
so each needs its own DID and its own signer instance, or the wallet will name
them identically and the demo will show the wrong institution on the consent
screen. That is `oid4vc-masters` and `oid4vc-job`, mirroring `oid4vc-bank`:
no Keycloak, no registry, no `ISSUER_DID`, published under their own path
prefixes so the `request_uri` in each QR resolves to the instance that signed it.

Consequences to plan for, not discover:

- `bootstrap.sh` mints five new DIDs: three issuers, two verifiers.
- Both new signers need `routes-citizen.conf` entries with an explicit
  `rewrite ... break` (a variable in `proxy_pass` suppresses prefix stripping),
  their `POST /vp/request` and `/vp/status` refused publicly and proxied on
  loopback, and `set` before `rewrite` in every block.
- The wallet needs a trusted DID entry per verifier, and both must sit **before**
  the host-scoped fallback: matching is a prefix match resolved by the first hit,
  so a host-scoped entry claims every DID minted under that host.
- After syncing an nginx conf to a host, **recreate** the container. Single-file
  bind mounts do not survive rsync's rename, and the symptom is a 404 served from
  the static root while `nginx -t` and `-s reload` both report success.

## Requirement-to-test map

Every row is written before the code it covers. `U` = unit, `E` = end-to-end,
`C` = `verify.sh`, `V` = video.

### §1 Issuance

| Requirement | Test |
|---|---|
| Learner selects the clearly named issuer | `E` each issuer names itself; `V` directory shot |
| Authenticates through the Education realm | `E` flow3: `authorization_code` + PKCE against `education`, token carries `nationalId` |
| Issuer resolves National ID to exactly one learner and institution record | `E` claims equal the seeded record; a second learner gets their own |
| The caller cannot select another Learner or Student ID | `E` no-`nationalId` account refused; an Age-realm and an Agriculture-realm token buy nothing |
| Holder-bound SD-JWT VC from the authoritative record | `E` all three bound to one holder key |
| Learner reviews, accepts, stores | `V` parts 1–3 |
| Only the three Education issuers appear | `C` per-issuer advertisement; APK `assets/app.config` read back; `U` wallet-trust |
| No issuance QR or issuer web page | `C` absence check; `V` |

### §2 Identity and data

| Requirement | Test |
|---|---|
| Accounts map deterministically to synthetic National IDs | `cfg` realm export; `E` flow3 |
| Each National ID maps to one Learner ID | `E`; seed script refuses duplicates |
| Each issuer maps to its own Student ID | `cfg` three schemas; `E` |
| One learner fixture consistent across all three | `cfg` seed script |
| Separate, non-overlapping tables | `E` data-isolation extended to Education |
| National ID and Student IDs are not claims | `E` per credential, asserted on the wire |
| Unmapped, missing and cross-learner requests fail safely | `E` three refusal tests |

### §3 Issuers

Separate DIDs/keys/config/roles → `E` three different `iss`; issuer-scoped
advertisement → `C`; reads only its own entity → `cfg` one subject entity per
instance plus `E` cross-issuance refusal; role substitution → `E` a College
credential in the University slot is rejected; names clear in the wallet → `V`.

### §4 Credentials

Claims match PRODUCT → `cfg` schemas plus `E`. Same `learnerId` in all three →
`E`. Percentages decimal 0–100 with deterministic precision → `U` percentage
module, including binary-representation cases. Controlled vocabularies → `cfg`
schema enums plus `U`. Claims from issuer records only → `E`. Same holder key →
`E`.

### §5 and §6 The two portals

| Requirement | Test |
|---|---|
| Cross-device QR for all three credentials | `V`; `E` request shape |
| Wallet shows institution, purpose, credentials, claims, consent | `V` |
| Only policy-required disclosures | `E` per portal, both directions — nothing extra, nothing missing |
| Verify before applying the rule | `C` ordering by line number; `U` verification gate |
| Master's: School ≥60, College ≥60, University ≥70, completed, BACHELOR, accepted field | `U` boundary tests at 59.9/60/60.1 and 69.9/70/70.1; `E` |
| Job: passed School/College, completed BACHELOR in field, University ≥60 | `U` boundaries; `E` |
| Two purposes, two rules, same credentials | `E` one wallet satisfies both requests with different outcomes |
| Eligible wording exact; never `ADMITTED`, never a job offer | `U` asserts the exact strings; `C` greps both portals for forbidden words |

### §7 Disclosure

`E` per portal: the requested set is exactly the policy's, the forbidden list is
never even asked for, and withheld values are unrecoverable salted digests on the
wire. Age and Agriculture credentials in the same wallet must not be matched by
either Education request — `E`.

### §8 Decision and security

Reuses the Agriculture controls, retested for three credentials: algorithm policy
positive and negative (`U` + `E`, including a genuine non-ES256 holder key that
upstream accepts and the verifier refuses); issuer/type per role; same-holder
binding; audience, nonce, response mode, single-use state; tampering and replay;
over-disclosure; missing credentials; mixed holders; mismatched Learner IDs;
role substitution. Verified rule failure → `NOT ELIGIBLE` with a reason;
verification failure → `REJECTED / UNABLE TO VERIFY` with no decision; refusal →
`NO DATA SHARED`. Each asserted to carry no eligibility result.

### §9 Fixtures

Ten, each named by the outcome it produces, seeded deterministically: meets both
rules; job-only (University 60–69); fails Master's School or College 60; fails job
University 60; incomplete School / College / University; unsupported field;
mismatched Learner IDs; different holders; unmapped account and missing records;
and a valid credential from an untrusted issuer **for each of the three roles**.

The untrusted-issuer fixtures are provisioned by the test that needs them and
retired afterwards — never by bootstrap, because issuer metadata is built from
every published schema with no filter, so one created at setup time appears in the
wallet's issuer directory.

### §10 Evidence

Built alongside: `docs/evidence/03-education/` with `ACCEPTANCE.md`, `runs/`
(unit, e2e, verify, **Age and Agriculture regression**), the versions table, and
the recordings. Captured runs are written outside the checkout and moved in,
because `verify.sh` asserts a clean tree.

## Build order

1. Registry entities and schemas; seed script with the ten fixtures; unit tests
   for the percentage arithmetic and both rules. No protocol work yet.
2. Education Keycloak realm; three issuer instances; bootstrap mints five DIDs.
3. Trust policy: three issuer roles, two verifier identities.
4. Verifier: two use cases, two decision modules, published policies.
5. The two portals.
6. Wallet: Education build, trust entries, directory limited to three issuers.
7. Evidence, recordings, line-by-line table, Age and Agriculture regression.

## Decisions I will bring to Anand rather than assume

1. **Two verifier signing identities** (above). It follows from the accepted
   Agriculture architecture rather than changing it, so I will build it that way
   and flag it in the first handoff — but it adds two service instances, which is
   an architecture-shaped change and he should see it named.
2. **One APK per iteration.** The Education build must list only the three
   Education issuers, and all builds share a package name, so installing the
   Education wallet replaces the Agriculture one. Already accepted for
   Agriculture; restating because it now costs on-device re-demonstration of two
   earlier iterations.
3. **Percentage boundaries are inclusive** (`>=`), as PRODUCT states. The tests
   pin 59.9 / 60 / 60.1 and 69.9 / 70 / 70.1 so the boundary is evidence, not
   assumption.

## Progress — 1 September 2026

Build-order items 1 to 5 are done and green on the local stack. Items 6 and 7 are
not, and the wallet has one gap that has to be closed on the demo host rather than
here.

**Done, with the evidence that says so.**

| Item | Built | Proven by |
|---|---|---|
| 1. Entities, schemas, fixtures | 4 registry schemas, `scripts/seed-education.sh` | 42 unit tests; the seed script runs idempotently (38 records unchanged on a second run) |
| 1. Percentage arithmetic | `domains/education/percentage.mjs` | 12 unit tests, boundaries at 59.99 / 60 / 60.01 and 69.99 / 70 / 70.01 |
| 2. Realm and issuers | `realm-education.json` (12 learners), `oid4vc-school` / `-college` / `-university` | `bootstrap.sh` mints 5 DIDs and publishes 3 schemas; all three instances healthy |
| 3. Trust policy | 3 issuer roles in `config/trust/issuers.json` | `/education/*/policy` reports one trusted issuer per role; the wrong-role and untrusted-issuer e2e cases are REJECTED |
| 4. Verifier | `education/masters` and `education/job` use cases | 24 e2e tests against the running stack |
| 5. Portals | `/admissions/` and `/employer/`, one shared `app.js` | driven end to end in a browser with `scripts/wallet-education.sh` |
| §1 Issuance | `flow3-education-issuance.test.mjs` | 14 e2e tests: one Keycloak sign-in, three credentials, three distinct issuer keys, one holder key, and every refusal §2 asks for |
| §8 Security | tampering, replay, cross-verifier replay, single-use state, algorithm allowlist | 9 more e2e tests in `education.test.mjs` |

Two things worth naming because they were found by looking rather than by a test:

* **The admissions screen lied about thresholds it had cleared.** The
  NOT_ELIGIBLE branch returned only `shortfall`, so a learner with a 72% school
  result was told "school — not reached". Fixed by returning the thresholds
  already verified, and now asserted in both the unit and e2e suites. Nothing
  would have caught it: every test passed while the screen was wrong.
* **An institution can be made to sign another institution's credential type.**
  `ADVERTISE_OWN_CREDENTIALS_ONLY` filters issuer metadata but not the credential
  endpoint, so asking the school instance for the college configuration returns a
  credential signed with the College's DID carrying the learner's school
  percentage. It is contained — the `vct` is scoped to the minting instance, so no
  portal's query matches it, and `flow3-education-issuance.test.mjs` proves both
  the mint and the refusal — but a trust boundary resting on URL construction
  rather than an authorization check is not something to leave as a passing test.
  Recorded as finding 16 in `docs/design/COMPATIBILITY.md` and **needs Anand's
  decision**: the fix is a few lines in the fork applying the same `author` filter
  to the credential endpoint, which changes a security guarantee.

* **Over-disclosure is dropped upstream, not refused.** A wallet that reveals a
  claim the request did not ask for gets a DECIDED answer, because DCQL claim
  filtering in `oid4vc-service` strips the extra disclosure before the verifier
  sees it. The relying party cannot learn it and the decision cannot use it —
  both asserted — but the disclosure did reach the protocol façade. Stated
  plainly in `tests/e2e/education.test.mjs` rather than papered over.

Totals on the local stack, 1 September 2026: **158 unit**, **144 e2e** (47 of them
Education), **0 failures**. `verify.sh`: 107 passed, 1 failed, 1 skipped — the
failure is "working tree clean" (the work is uncommitted by design) and the skip is
the pre-existing wallet-trust pinning skip, because the APK targets the demo host
while this `deploy/.env` describes localhost.

## Deployed — 1 September 2026

The demo host runs all three iterations. `bootstrap.sh` **reused** the six existing
DIDs and minted five new ones, so the accepted Age and Agriculture evidence still
describes the deployment it was captured from.

Verified against it over HTTPS from a clean run, captured in
[`../../docs/evidence/03-education/runs/`](../../docs/evidence/03-education/runs/):

- **159 unit**, **144 e2e** (47 Education), **109 `verify.sh`** checks
- **97** Iteration 01 and 02 tests green on the same deployment — the regression
  §10 requires
- Each of the five path-scoped issuers advertises exactly one credential
- Both portals reached over HTTPS in a browser and answered by the hand-driven
  wallet: the same three cards gave **SELECTED FOR INTERVIEW — ROUND 1** from the
  employer and **NOT ELIGIBLE, university 65% short of 70%** from admissions
- The wallet's pinned verifier DID and issuer origin match the live deployment,
  so `verify.sh`'s trust-pinning check now runs and passes instead of skipping

The two Education verifier DIDs are now in the wallet's `trustedDidEntities`,
above the host-scoped fallback, so the consent screens name **University
Admissions** and **Employer** rather than the deployment.

Four things this deployment cost, all now in the runbook or the code:

1. **`docker compose up -d` dropped HTTPS.** The TLS setup is an overlay
   (`docker-compose.tls.yml`), so recreating nginx without `-f` both files served
   plain HTTP on port 80 and stopped listening on 443. Worse, the overlay
   **replaces** nginx's volume list rather than adding to it, so the new
   `education-web` mount had to be added there too or the portals 404 over HTTPS.
2. **`rsync --delete` would have destroyed the host's `deploy/.env`** — its public
   origin and all six existing DIDs — because the file is gitignored and so exists
   on both machines with different contents. Backed up first, then excluded.
3. **A 404 logo silently truncated `verify.sh` at check 41**, so sixty later
   checks never ran and no summary printed: the logo check's `|| exit 1` ran in the
   current shell. `check()` and `gone()` now eval in a subshell, which fixes the
   class rather than the instance.
4. **A half-set environment mixed two deployments.** Exporting `PUBLIC_URL` but not
   `AGE_ISSUER_DID` falls through to the local `deploy/.env`, so offers were
   created on the host and redeemed against localhost — surfacing only as
   `invalid_grant: bad or used code`. `deployEnv()` now refuses that combination
   with the correct invocation in the message.

**Open, and in this order.**

1. **The wallet change is not vendored as a fork commit.** The three issuer
   entries and the two verifier entries are complete and tested, but they sit in
   both working trees rather than in the fork's history — so `scripts/vendor-wallet.sh`
   still names tip `6dc0a3c` and `SUNBIRD-CHANGES.md` has no row for them. The
   sequence: commit in the fork → `./scripts/vendor-wallet.sh --tip <new>` → add
   the row → bump `TIP`. `verify.sh`'s tree-hash check passes today only because
   the edit is identical in both copies.
2. **(done)** Education APK built and installed on the Samsung SM-A055F — three
   institutions in the issuer directory and both new verifier DIDs compiled in,
   both verified by reading them out of the APK. Wallet data cleared, so the app
   is at its onboarding screen awaiting a PIN.

   The mobile verifier also gained two Education channels, because the installed
   Agriculture build was still called **Farm Credit** — the same defect Iteration
   02 was sent back for. `education-masters` is built and installed, verified end
   to end against the deployment, and `Farm Credit` / `Age Check` are absent from
   its resources.

   **Still needs a person and a phone:** set the wallet PIN, collect all three
   credentials through the wallet's own issuer directory, in-app browser and trust
   screens, and present to both portals. The server half of that journey is
   covered by `flow3-education-issuance.test.mjs`, so a device failure can be
   attributed to the wallet rather than to the stack.
3. Evidence pack: the line-by-line acceptance table. The run outputs and the
   Age/Agriculture regression are captured and committed already, but must be
   **recaptured after the commit** — their headers say so, because they were taken
   from a dirty tree.
4. Recordings.
