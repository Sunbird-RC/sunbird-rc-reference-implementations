# Iteration 03 — Education / employment: evidence

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
| Unit | **175 passed, 0 failed** (54 in the three Education files) | [`runs/test-unit.txt`](runs/test-unit.txt) |
| End-to-end, against the local stack | **150 passed, 0 failed** (52 Education) | [`runs/test-e2e.txt`](runs/test-e2e.txt) |
| `verify.sh --no-tests`, against the local stack | **109 passed, 0 failed, 2 skipped** | [`runs/verify.txt`](runs/verify.txt) |
| Age + Agriculture regression, same stack | **98 passed, 0 failed** | [`runs/regression-01-02.txt`](runs/regression-01-02.txt) |
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

Item 3 changes what a holder sees, so it comes with the short replacement segment
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
| Fork branch | `oid4vc-keycloak-as-v2.1.0`, 7 commits off `v2.1.0` |
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
