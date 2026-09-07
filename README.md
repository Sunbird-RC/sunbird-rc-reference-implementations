# Sunbird RC Reference Implementations

This repository contains a **Sunbird RC capability showcase** built through progressive credential use cases. It demonstrates reusable, standards-aligned, privacy-preserving credential infrastructure rather than production solutions for the selected domains.

## Showcase Scope

The project demonstrates the complete verifiable credential lifecycle:

**Issue → Store → Request → Consent → Present → Verify → Decide**

The three completed reference implementations progressively showcase:

1. **Age verification** — selective disclosure, holder consent, and data minimisation.
2. **Agriculture / rural credit** — multiple issuers, multiple credentials, correlation, and business rules.
3. **Education / employment** — credential discovery and filtering, domain reuse, and extensibility.

Across these use cases, the showcase uses the established customized open-source wallet, logically separated issuer data, and both web and mobile verification experiences. Inji interoperability is not part of the demo programme.

## Project Status

- **PRODUCT:** approved and baselined in `main`.
- **DESIGN:** approved and baselined.
- **ITERATION 01 — AGE VERIFICATION:** accepted and merged to `main`; see the
  [formal sign-off](docs/reviews/ITERATION-01-SIGNOFF.md) and
  [evidence](docs/evidence/01-age/README.md).
- **ITERATION 02 — AGRICULTURE / RURAL CREDIT:** accepted and merged to `main`;
  see the [formal sign-off](docs/reviews/ITERATION-02-SIGNOFF.md) and
  [evidence](docs/evidence/02-agriculture/README.md).
- **ITERATION 03 — EDUCATION / EMPLOYMENT:** accepted and merged to `main` in
  [`7f18e75`](https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations/commit/7f18e756d7d82bfd5e73dad1dbe3947fa0e89f3f);
  every requirement is **MET** in the
  [line-by-line acceptance record](docs/evidence/03-education/ACCEPTANCE.md).

## Running the Age Verification showcase

A clean checkout to a working stack. Docker and Node 22+ are the only
prerequisites; the registry takes one to four minutes to become healthy on first
start.

```bash
cd deploy && cp env.example .env && docker compose up -d
../scripts/bootstrap.sh          # Vault kv, three did:web identities, schemas, Keycloak realm
../scripts/seed-age-citizens.sh  # deterministic synthetic citizens
cd .. && npm install

npm run test:unit                # accepted baseline: 175 passed, no stack needed
npm run test:e2e                 # accepted baseline: 150 passed across all three iterations
./scripts/demo.sh                # headless walkthrough: positive and negative cases
./scripts/verify.sh              # environment and regression checks

# the holder's wallet is vendored at vendor/paradym-wallet (pnpm, not npm)
cd vendor/paradym-wallet && corepack pnpm install --frozen-lockfile
cd ../.. && ./scripts/build-wallet.sh
```

`bootstrap.sh` prints the generated demo password once and writes it to the
gitignored `deploy/.env`. Nothing sensitive is committed.

Then open `http://localhost/verifier/` — "Start age check" shows the presentation
QR and the decision. There is deliberately no issuer web page: issuance is
wallet-driven through Keycloak, with no QR code, as the iteration charter requires.

**For a phone to take part**, the stack needs a public HTTPS origin: `did:web`
mandates https, and the origin is baked into every DID and credential, so it has
to be fixed *before* any demo credential is issued. `scripts/enable-https.sh`
obtains a Let's Encrypt certificate for a host reachable on ports 80 and 443.

## Running the Agriculture / rural credit showcase

The same stack: two more issuers, a second Keycloak realm and the bank page. It
builds on the Age steps above rather than replacing them.

```bash
cd deploy && docker compose up -d          # brings up oid4vc-farmer and oid4vc-land too
../scripts/bootstrap.sh                    # also mints the two registry DIDs and publishes their schemas
../scripts/seed-agriculture.sh             # six farmers, five land records, every decision branch
cd .. && npm run test:e2e                  # includes 27 Agriculture and 11 wallet-driven issuance tests
```

Then open `http://localhost/bank/` and press "Start farm credit check". With no
phone in the loop, answer the request from the same laptop:

```bash
./scripts/wallet-agriculture.sh eligiblePaddy               # collect both credentials
./scripts/wallet-agriculture.sh eligiblePaddy <sessionId>   # ...then apply
```

The session id is printed under the QR. The fixtures are named by the outcome
they produce — `eligiblePaddy`, `eligibleWheat`, `inactiveOwner`, `unfundedCrop`,
`unregistered`, `noLandRecord` — so a demo can pick an outcome instead of
remembering an id. That script is the same holder implementation the test suite
uses: real keys, real signatures, real key binding, nothing stubbed. It is
supporting evidence and not the customer journey, which is wallet-driven issuance
on a real device.

**The Agriculture wallet build must not list the Age issuer** — `DEMO.md`'s
quality gate. The issuer directory is baked in at build time, so pass only the
two registries:

```bash
./scripts/build-wallet.sh --issuer https://<host>/farmer,https://<host>/land
```

The installed mobile verifier is one app with a build-time channel, so an
Agriculture build is named **Farm Credit** and contains no Age option at all:

```bash
cd services/verifier-mobile
VERIFIER_USE_CASE=agriculture VERIFIER_BASE_URL=https://<host> \
  npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

It is **not required** for Iteration 02 acceptance — `REQUIREMENTS.md` §1 makes web
QR verification the customer-facing channel — and it shares a package with the Age
build, so installing one replaces the other.

One APK cannot satisfy both demos: both builds share the package name, so
installing one replaces the other. See
[iterations/02-agriculture/IMPLEMENTATION.md](iterations/02-agriculture/IMPLEMENTATION.md).

## Running the Education / employment showcase

The same stack again: three more issuers, a third Keycloak realm, two more
verifier signing identities, and two portals. It builds on the steps above rather
than replacing them.

```bash
cd deploy && docker compose up -d          # brings up the three institutions and the two VP signers
../scripts/bootstrap.sh                    # mints five more DIDs and publishes three more schemas
../scripts/seed-education.sh               # ten learners, every decision branch
cd .. && npm run test:e2e                  # accepted baseline includes 52 Education tests
```

Then open **either** portal and press Start:

* `http://localhost/admissions/` — the university, which requires 60% school,
  60% college and **70%** university.
* `http://localhost/employer/` — the employer, which requires **60%** university
  and does not ask for the school or college percentage at all.

With no phone in the loop, answer from the same laptop. Collect once, present
twice, and watch the same three cards produce two different answers:

```bash
./scripts/wallet-education.sh twoAnswers job     <sessionId>   # SELECTED FOR INTERVIEW — ROUND 1
./scripts/wallet-education.sh twoAnswers masters <sessionId>   # NOT ELIGIBLE: university 65% < 70%
```

The session id is printed under the QR. Fixtures are named by the outcome —
`bothPolicies`, `twoAnswers`, `onTheBoundary`, `schoolBelow`, `collegeBelow`,
`universityBelow`, `notCompleted`, `wrongField`, `mismatch`, `noUniversity`. A
mismatched SET, which both portals must refuse with REJECTED rather than
NOT ELIGIBLE:

```bash
./scripts/wallet-education.sh mismatch masters <sessionId> --college EDU-L-012551
```

All three cards there are genuinely issued and genuinely held by one wallet key.
Only the learner id disagrees: it is the combination that is wrong, not any card.

**The Education wallet build must list only the three institutions**, the same
quality gate Agriculture has:

```bash
./scripts/build-wallet.sh --issuer https://<host>/school,https://<host>/college,https://<host>/university
```

The installed mobile verifier is one app with a build-time channel, so an Education
build is named for **its own relying party** and contains no Age or Agriculture
option at all:

```bash
cd services/verifier-mobile
VERIFIER_USE_CASE=education-masters VERIFIER_BASE_URL=https://<host> \
  npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

`education-masters` gives "Master's Admissions"; `education-job` gives "Interview
Shortlisting". Two channels because Education has two relying parties — one app
named for both would mislabel one of them. It is **not required** for acceptance:
`DEMO.md` puts the verifier on a website. It exists because all four builds share a
package name, so leaving the Agriculture build installed puts "Farm Credit" on the
home screen during an Education demo.

| I want to | Read |
|---|---|
| Review Iteration 01 against the validation table | [docs/evidence/01-age/VALIDATION.md](docs/evidence/01-age/VALIDATION.md) |
| See what was built, versions, deviations and defects | [docs/evidence/01-age/README.md](docs/evidence/01-age/README.md) |
| See captured test and verification runs | [docs/evidence/01-age/runs/](docs/evidence/01-age/runs/) |
| Build the wallet or the mobile verifier app | [docs/evidence/01-age/README.md](docs/evidence/01-age/README.md#building-the-two-mobile-apps) |
| See what we changed in the wallet, and what is upstream's | [vendor/paradym-wallet/SUNBIRD-CHANGES.md](vendor/paradym-wallet/SUNBIRD-CHANGES.md) |
| Understand a protocol or wallet compatibility finding | [docs/design/COMPATIBILITY.md](docs/design/COMPATIBILITY.md) |

## Project Documents

- [Product Definition](docs/project/PRODUCT.md)
- [Working & Engagement Model](docs/project/WORKING-ENGAGEMENT-MODEL.md)
- [Git Working Model](docs/project/GIT-WORKING-MODEL.md)
- [Architecture & Design](docs/design/DESIGN.md)
- [Compatibility Baseline](docs/design/COMPATIBILITY.md)
- [Coding Agent Instructions](CLAUDE.md)
- [Iteration 01 — Age Verification](iterations/01-age/CHARTER.md)
- [Iteration 01 review feedback](docs/reviews/ITERATION-01-FEEDBACK.md)
- [Iteration 01 review feedback, round 2](docs/reviews/ITERATION-01-FEEDBACK-ROUND2.md)
- [Iteration 01 formal sign-off](docs/reviews/ITERATION-01-SIGNOFF.md)
- [Iteration 01 evidence](docs/evidence/01-age/README.md)
- [Programme wallet-scope decision](docs/reviews/DECISION-03-wallet-scope.md)
- [Iteration 02 formal sign-off](docs/reviews/ITERATION-02-SIGNOFF.md)
- [Iteration 02 — Agriculture Product](iterations/02-agriculture/PRODUCT.md)
- [Iteration 02 — Agriculture Requirements](iterations/02-agriculture/REQUIREMENTS.md)
- [Iteration 02 — Agriculture Design](iterations/02-agriculture/DESIGN.md)
- [Iteration 02 — Final Demo Expectations](iterations/02-agriculture/DEMO.md)
- [Iteration 03 — Education: Start Here](iterations/03-education/START.md)
- [Iteration 03 — Product Definition](iterations/03-education/PRODUCT.md)
- [Iteration 03 — Requirements](iterations/03-education/REQUIREMENTS.md)
- [Iteration 03 — Architecture & Design](iterations/03-education/DESIGN.md)
- [Iteration 03 — Final Demo Expectations](iterations/03-education/DEMO.md)
- [Iteration 03 — Implementation Plan and Progress](iterations/03-education/PLAN.md)
- [Iteration 03 — Implementation Log](iterations/03-education/IMPLEMENTATION.md)
- [Iteration 03 — Recording the demo, end to end](iterations/03-education/IMPLEMENTATION.md#recording-the-demo-end-to-end)
- [Iteration 03 — Acceptance and evidence](docs/evidence/03-education/ACCEPTANCE.md)

These documents are the authoritative project baseline. Architecture and implementation must remain aligned with them.

## Working Model

- Anand and ChatGPT own Product, Design, and iteration acceptance.
- Kartheek owns development and testing with Claude Code / Co-work.
- Kartheek and Claude have freedom within the active iteration branch.
- `main` contains only accepted, working baselines.
- Nothing is merged into `main` without Anand's explicit sign-off after the demonstration, test evidence, and feedback closure.

## Delivery Flow

```text
Product → Design → Iteration → Build/Test → Demo → Feedback → Sign-off → Merge
```

Each new iteration starts from the latest accepted `main` baseline.
