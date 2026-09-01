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
