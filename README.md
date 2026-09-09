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

- **Age verification:** complete — [guide](docs/showcase/use-cases/age-verification.md) · [evidence](docs/evidence/01-age/README.md)
- **Agriculture / rural credit:** complete — [guide](docs/showcase/use-cases/agriculture-rural-credit.md) · [evidence](docs/evidence/02-agriculture/README.md)
- **Education / employment:** complete — [guide](docs/showcase/use-cases/education-employment.md) · [evidence](docs/evidence/03-education/README.md)

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
npm run test:e2e                 # baseline: 150 passed across all three applications
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
wallet-driven through Keycloak, with no QR code.

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

**The Agriculture wallet build must not list the Age issuer.** The issuer
directory is baked in at build time, so pass only the
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

Web QR verification is the customer-facing Agriculture channel. The mobile
verifier shares a package with the Age build, so installing one replaces the other.

One APK cannot satisfy both demos: both builds share the package name, so
installing one replaces the other. See the
[deployment and demo guide](docs/deployment-and-demos.md).

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
Shortlisting". Two channels are provided because Education has two relying
parties—one app named for both would mislabel one of them. The primary verifier
experience is web based. All four builds share a package name, so leaving the
Agriculture build installed puts "Farm Credit" on the home screen during an
Education demo.

| I want to | Read |
|---|---|
| Understand the applications | [docs/showcase/](docs/showcase/README.md) |
| Deploy and demonstrate the applications | [docs/deployment-and-demos.md](docs/deployment-and-demos.md) |
| Run and understand the tests | [docs/testing.md](docs/testing.md) |
| Review the technical profile and limitations | [docs/technical-profile.md](docs/technical-profile.md) |
| See what we changed in the wallet, and what is upstream's | [vendor/paradym-wallet/SUNBIRD-CHANGES.md](vendor/paradym-wallet/SUNBIRD-CHANGES.md) |

## Documentation

Start with the [reference implementation documentation](docs/README.md).
