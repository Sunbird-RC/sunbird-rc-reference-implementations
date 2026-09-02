# Iteration 03 — Education / employment: evidence

Everything needed to review this iteration without running it, and everything
needed to run it if you want to.

- **The line-by-line acceptance table:** [`ACCEPTANCE.md`](ACCEPTANCE.md)
- **The demonstration video:** [`Education-Employment-Showcase-01Sep.mp4`](Education-Employment-Showcase-01Sep.mp4)
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
| End-to-end, against the deployment | **150 passed, 0 failed** (52 Education) | [`runs/test-e2e.txt`](runs/test-e2e.txt) |
| `verify.sh --no-tests`, against the deployment | **111 passed, 0 failed** | [`runs/verify.txt`](runs/verify.txt) |
| Age + Agriculture regression, same deployment | **98 passed, 0 failed** | [`runs/regression-01-02.txt`](runs/regression-01-02.txt) |
| `sunbird-rc-core` fork jest | **154 passed, 0 failed** | run by `verify.sh` |

## What the review sent back, and what closed it

Anand accepted the functional demonstration on 1 September 2026 and asked for
five things. Four are closed here; the fifth is closed in the request and
**unfilmed**.

| # | Asked for | Status |
|---|---|---|
| 1 | Commit the captured test evidence | closed at `8c7949d`, refreshed here |
| 2 | Apply the issuer restriction to the credential endpoint, with positive and negative tests | **closed** — 7 fork tests, 4 end-to-end, 1 `verify.sh` check |
| 3 | Send the request purpose so the wallet displays it | **closed in the request**; the consent screen is not yet re-filmed |
| 4 | Reject an unrequested disclosure at the protocol boundary | **closed** — refused, not dropped |
| 5 | Make the acceptance table and this README accurate | this document and [`ACCEPTANCE.md`](ACCEPTANCE.md) |

Item 3 changes what a holder sees, so it needs the short replacement segment
Anand asked for. No device was attached when the change landed, so that segment
is **outstanding** and the committed film still shows the old warning screen.

Of the four deviations recorded on 1 September, **three are now closed** and are
kept in [`ACCEPTANCE.md`](ACCEPTANCE.md#known-deviations) with what changed rather
than deleted. What remains: part eight's rendered caption, and the unfilmed
purpose screen above.

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
- **The wallet's consent screen showing the request purpose is not filmed.** The
  request carries it and two suites assert that, including one that decodes the
  signed request object — but the screen has not been re-observed on a device, and
  the committed film shows the old "no purpose provided" warning. Stated in
  [`ACCEPTANCE.md`](ACCEPTANCE.md#known-deviations) as deviation 1.
