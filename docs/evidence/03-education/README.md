# Iteration 03 — Education / employment: evidence

> **Functionally accepted by Anand.** All implementation, security,
> purpose-display, reproducibility and deployment feedback is closed with
> committed evidence. **Finding 19** — the wallet's same-device deep-link decoding
> issue — remains a non-blocking wallet backlog item and does not affect the
> Education journey, which is cross-device QR.
>
> Statements from earlier rounds that this work overtook — the fork being
> unpublished, the image not being rebuildable, and the deployment running the old
> `9caf3c2b` image — have been removed or marked SUPERSEDED rather than left to
> mislead. Where a superseded section is kept, it is kept for the audit trail and
> labelled as such.

Everything needed to review this iteration without running it, and everything
needed to run it if you want to.

- **The line-by-line acceptance table:** [`ACCEPTANCE.md`](ACCEPTANCE.md)
- **The demonstration video:** [`Education-Employment-Showcase-01Sep.mp4`](Education-Employment-Showcase-01Sep.mp4)
- **The purpose follow-up segment, 39 s:** [`Education-Purpose-Followup-02Sep.mp4`](Education-Purpose-Followup-02Sep.mp4)
- **Captured runs:** [`runs/`](runs/)
- **Implementation log, with the reasoning:** [`../../../iterations/03-education/IMPLEMENTATION.md`](../../../iterations/03-education/IMPLEMENTATION.md)

## The demonstration video

5 min 32 s, 720×1600, H.264 High + AAC LC 48 kHz stereo, faststart, narration at
−16.0 LUFS. 16.5 MB. Nine parts, and all **six** outcomes.

| Part | At | Shows | Outcome |
|---|---|---|---|
| 1 | 0:34 | a new wallet; the directory offers exactly three institutions | — |
| 2 | 0:46 | three trust screens, one sign-in, three cards stored | — |
| 3 | 1:29 | closed completely, cold-started, all three cards still there | — |
| 4 | 1:44 | cross-device: laptop QR, phone camera, three cards in one consent | **NOT ELIGIBLE** |
| 5 | 2:28 | the same cards to an employer that never asks for two of the marks | **SELECTED FOR INTERVIEW — ROUND 1** |
| 6 | 3:08 | a learner exactly on 60 / 60 / 70 | **ELIGIBLE FOR MASTER'S APPLICATION** |
| 7 | 3:24 | a 55.25 degree against a 60 bar | **NOT ELIGIBLE** |
| 8 | 3:47 | three cards that name two different learners | **REJECTED / UNABLE TO VERIFY** |
| 9 | 4:23 | the installed app, then the learner declines | **NO DATA SHARED** |

Parts 4 and 5 are the iteration's claim: the *same wallet*, the *same three
cards*, nothing re-issued, and two different answers because the two published
rules differ. `EDU-L-006733`'s degree is 65 — short of the university's 70, over
the employer's 60.

The four learners, all synthetic:

| Account | Learner | School / College / University |
|---|---|---|
| `learner.rohan` | EDU-L-006733 | 72 / 68.4 / **65** |
| `learner.fatima` | EDU-L-007841 | **60 / 60 / 70** exactly |
| `learner.kiran` | EDU-L-009315 | 68 / 64 / **55.25** |
| `learner.mismatch` | EDU-L-012550 | college record names **EDU-L-012551** |

How the film was cut, and the six defects found while checking it frame by frame,
are in `RC_video/New_Flow/Edu_Demo/NOTES.md` alongside the build scripts. That
directory is outside this repository, as with the two earlier films.

## What was built

Three independent issuers, one shared verifier with two new use cases, two
portals, and two verifier signing identities.

| | |
|---|---|
| Registry entities | `EducationLearner`, `SchoolRecord`, `CollegeRecord`, `UniversityRecord` |
| Issuers | `oid4vc-school`, `oid4vc-college`, `oid4vc-university` — own path, own DID, own entity |
| Verifier signers | `oid4vc-university-vp`, `oid4vc-employer-vp` — so the two relying parties are two parties to a wallet |
| Verifier use cases | `education/masters`, `education/job`, from one factory over `POLICIES` |
| Portals | `/admissions/` and `/employer/` — two HTML files, **one** `app.js` |
| Keycloak realm | `education`, 12 learner accounts |
| Fixtures | ten, seeded by `scripts/seed-education.sh` |

Three issuers rather than one is what makes the correlation check meaningful: the
rule is *"all three certificates name the same learner"*, and that is only a claim
worth checking if three separate authorities asserted it.

## Acceptance

| Suite | Result | Where |
|---|---|---|
| Unit | **175 passed, 0 failed** (54 in the three Education files) | [`runs/test-unit-deployment.txt`](runs/test-unit-deployment.txt) |
| End-to-end, against the deployment | **150 passed, 0 failed** (52 Education) | [`runs/test-e2e-deployment.txt`](runs/test-e2e-deployment.txt) |
| `verify.sh --no-tests`, against the deployment | **116 passed, 0 failed, 1 skipped** | [`runs/verify-deployment.txt`](runs/verify-deployment.txt) |
| Age + Agriculture regression | **98 passed, 0 failed** — and all 98 again inside the deployment's 150-test run | [`runs/regression-01-02.txt`](runs/regression-01-02.txt) |
| `sunbird-rc-core` fork jest | **154 passed, 0 failed** | run by `verify.sh` |

## What the review sent back, and what closed it

Anand accepted the functional demonstration on 1 September 2026 and asked for
five things. Four are closed here; the fifth is closed in the request and
**unfilmed**.

| # | Asked for | Status |
|---|---|---|
| 1 | Commit the captured test evidence | closed at `8c7949d`, refreshed here |
| 2 | Apply the issuer restriction to the credential endpoint, with positive and negative tests | **closed** — 7 fork tests, 4 end-to-end, 1 `verify.sh` check |
| 3 | Send the request purpose so the wallet displays it | **closed**, and confirmed on the device — see the follow-up segment |
| 4 | Reject an unrequested disclosure at the protocol boundary | **closed** — refused, not dropped |
| 5 | Make the acceptance table and this README accurate | this document and [`ACCEPTANCE.md`](ACCEPTANCE.md) |

A second round of review on 2 September asked for four more closures. **All four
are closed.**

| # | Asked for | Status |
|---|---|---|
| 1 | Publish the fork commits, or commit reproducible patches with instructions | **closed** — [`patches/oid4vc-service/`](../../../patches/oid4vc-service/), seven patches that reproduce the authored tree exactly |
| 2 | Let a reviewer rebuild the `c8beec27` image from shared source | **closed** — shared base is the upstream `v2.1.0` tag; exact build recipe and five `verify.sh` checks |
| 3 | Move the public deployment to the corrected image and re-verify there | **closed** — all nine `oid4vc-*` services on `c8beec27`; unit, end-to-end and `verify.sh` captured against it |
| 4 | Correct the stale 167 unit / 145 E2E line | **closed** — 175 and 150, recounted from the suites |

The **first** round's item 3 changes what a holder sees, so it comes with the short replacement segment
Anand asked for: [`Education-Purpose-Followup-02Sep.mp4`](Education-Purpose-Followup-02Sep.mp4),
39 s, the same screen before and after from real captures, plus the employer's. The 5:32 film is **not**
re-cut — one review item changed one screen, and re-rendering the whole film would
throw away a frame-by-frame check already done twice. The film still shows the old
warning, which is correct for the build it was recorded from.

## The purpose, on the device

Confirmed on the Samsung SM-A055F against the demo deployment on 2 September 2026.
The review screen's *"No information was provided on the purpose of the data
request. Be cautious"* is gone, replaced by a **PURPOSE** panel reading
*"Master's admission eligibility (Computer Science)"* — the exact string
`/api/verifier/education/masters/policy` publishes.

The employer screen is filmed too, and shows more than the purpose: its school
card has **no Percentage row**, because the job policy asks only for `learnerId`
and `completionStatus` there. The two consent screens differ exactly as the two
published policies differ — visible to the holder, not just asserted in a test.
Captured over the cross-device QR journey the charter specifies; a same-device
deep link to that portal cannot be used at all, for the reason in finding 19
below.

Of the four deviations recorded on 1 September, **three are now closed** and are
kept in [`ACCEPTANCE.md`](ACCEPTANCE.md#known-deviations) with what changed rather
than deleted. Part eight's rendered caption remains, and one new finding turned up
while confirming this work:

**Finding 19 — a same-device deep link crashes the wallet for some verifiers.**
**Ruled a wallet backlog item by Anand on 2 September 2026: it does not block this
iteration**, because the required Education journey is cross-device QR.
The wallet base64-encodes its post-unlock redirect path unpadded and decodes it
strictly, so the route survives only when the payload length is a multiple of 4.
Measured, not guessed: the Master's link is 392 characters and worked on every
attempt, the employer link is 390 and failed on every attempt. **No Education
journey is affected** — `DEMO.md` specifies cross-device QR, which does not go
through that code, and part 9's installed app uses the length that works, which is
why two iterations never hit it. The fix is one word in the vendored wallet and is
deliberately not applied: it only takes effect in a rebuilt APK, and every
recorded artefact in all three iterations was produced with the installed `1.20.3`
build, so rebuilding means re-verifying the trust screens on a device before the
evidence can be trusted again. That is a decision, not a tidy-up.

## Versions and configuration

| Component | Version |
|---|---|
| Sunbird RC services | `v2.1.0` (official ghcr images) |
| `oid4vc-service` | `sunbird-rc-oid4vc-service:v2.1.0-authcode.c8beec27` — the ported build, pinned by source commit in its tag |
| Fork branch | `oid4vc-keycloak-as-v2.1.0`, 7 commits off `v2.1.0` — reproducible from [`../../../patches/oid4vc-service/`](../../../patches/oid4vc-service/) |
| Keycloak | `quay.io/keycloak/keycloak:26.0`, `start-dev`, three realms imported |
| Wallet | vendored at `vendor/paradym-wallet`, upstream `2d68168` + nine showcase commits, tip `82b1def` |
| Wallet APK | `id.paradym.wallet.preview` 1.20.3, arm64-v8a, issuer directory limited to the three institutions |
| Mobile verifier APK | `id.sunbird.ageverifier` 1.0.0, `VERIFIER_USE_CASE=education-masters` → "Master's Admissions" |
| Device | Samsung SM-A055F, Android 15 |
| Node | v22.16.0 · Docker 28.5.1 |
| Deployment | `https://135.235.192.9.sslip.io`, real Let's Encrypt certificate |
| Approved algorithms | `ES256` only — [`../../../config/policy/algorithms.json`](../../../config/policy/algorithms.json), enforced |
| Trust allowlist | six issuers, three with Education roles — [`../../../config/trust/issuers.json`](../../../config/trust/issuers.json) |

The two Education verifier DIDs are pinned in the wallet, so `verify.sh`'s
trust-pinning check runs and passes against this deployment rather than skipping.

## Rebuilding the pinned image from shared source

The `oid4vc-service` image this deployment runs, `v2.1.0-authcode.c8beec27`, is
rebuildable by anyone with this repository. Its seven source commits are committed
as patches at [`../../../patches/oid4vc-service/`](../../../patches/oid4vc-service/),
on top of a base that needs nothing from us: the upstream tag `v2.1.0`
(`2ade66c24afc2d5da7d05121e9cbbd082ba83cd1`), reachable from `origin/main` of
`Sunbird-RC/sunbird-rc-core`.

They are not a summary. Applying the series to a pristine `v2.1.0` worktree was
checked to produce a tree **identical** to the authoring checkout's branch tip,
compared by tree hash. Patches `0006` and `0007` are the issuer-authorization and
over-disclosure fixes; the five before them are the pre-existing port, included
because the image cannot be built without them. The exact `git am` and
`docker build` commands, including why `--platform linux/amd64` is not optional,
are in that directory's [`README.md`](../../../patches/oid4vc-service/README.md).

Six `verify.sh` checks keep the patches honest against the running image — the
series is present and complete, it carries apply-and-build instructions, it records
the shared base, and patch `0007`'s commit **is** the one `deploy/docker-compose.yml`
pins.

The fork branch itself is deliberately not pushed: that checkout's only remote is
`https://github.com/Sunbird-RC/sunbird-rc-core.git` — upstream Sunbird RC, not a
fork under this project's control — so pushing it would put showcase commits into
the upstream project, and merging it would alter a released baseline this programme
treats as a controlled input. `verify.sh` asserts that `fork main` still equals
`origin/main` and sits on the `v2.1.0` tag. **The patches make that irrelevant to a
reviewer**, which is why the earlier statement that the image could not be rebuilt
from a clean checkout no longer applies.

## Reproducing it

```bash
cd deploy && docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
../scripts/bootstrap.sh          # mints five DIDs, publishes three schemas
../scripts/seed-education.sh     # ten learners
cd .. && npm run test:unit && npm run test:e2e && ./scripts/verify.sh
```

Against a remote deployment, forward the operator port and export **both**
`PUBLIC_URL` and `AGE_ISSUER_DID` — setting only the first silently mixes two
deployments, and the suite now refuses that outright. The exact invocation is in
[`runs/README.md`](runs/README.md).

With no phone in the loop, collect once and present twice:

```bash
./scripts/wallet-education.sh twoAnswers job     <sessionId>   # INTERVIEW
./scripts/wallet-education.sh twoAnswers masters <sessionId>   # NOT ELIGIBLE
```

That script is the same holder implementation the suite uses — real keys, real
signatures, real key binding. It is supporting protocol evidence and **not** the
customer journey, which is wallet-driven issuance on a real device.

## What is not claimed

- **No mobile verifier channel is required for Education.** `DEMO.md` specifies
  "verifier websites on a separate screen", which is parts 4–7. Part 9's installed
  app is supporting evidence.
- **Inji interoperability is not demonstrated**, and is out of programme scope per
  [`../../reviews/DECISION-03-wallet-scope.md`](../../reviews/DECISION-03-wallet-scope.md).
- **A same-device deep link is not a working channel for every verifier.** See
  finding 19 above. Education's charter journey is cross-device QR, which is
  unaffected.
