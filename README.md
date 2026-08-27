# Sunbird RC Reference Implementations

This repository contains a **Sunbird RC capability showcase** built through progressive credential use cases. It demonstrates reusable, standards-aligned, privacy-preserving credential infrastructure rather than production solutions for the selected domains.

## Showcase Scope

The project demonstrates the complete verifiable credential lifecycle:

**Issue → Store → Request → Consent → Present → Verify → Decide**

The planned use cases progressively showcase:

1. **Age verification** — selective disclosure, holder consent, and data minimisation.
2. **Agriculture / rural credit** — multiple issuers, multiple credentials, correlation, and business rules.
3. **Education / employment** — credential discovery and filtering, domain reuse, and extensibility.

Across these use cases, the showcase includes Inji Wallet interoperability, suitable open-source VC wallets, logically separated issuer data, and both web and mobile verification experiences.

## Project Status

- **PRODUCT:** approved and baselined in `main`.
- **DESIGN:** approved and baselined.
- **IMPLEMENTATION:** Iteration 01 (Age verification) is accepted and merged to
  `main` — Anand's sign-off is in
  [docs/reviews/ITERATION-01-SIGNOFF.md](docs/reviews/ITERATION-01-SIGNOFF.md).
  Iteration 02 (Agriculture / rural credit) is in progress on
  `iteration/agriculture-02-rural-credit`, and nothing reaches `main` before its
  own sign-off.

## Running the Age Verification showcase

A clean checkout to a working stack. Docker and Node 22+ are the only
prerequisites; the registry takes one to four minutes to become healthy on first
start.

```bash
cd deploy && cp env.example .env && docker compose up -d
../scripts/bootstrap.sh          # Vault kv, three did:web identities, schemas, Keycloak realm
../scripts/seed-age-citizens.sh  # deterministic synthetic citizens
cd .. && npm install

npm run test:unit                # 43 tests, no stack needed
npm run test:e2e                 # 50 tests against the running stack
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
- [Iteration 02 — Agriculture Product](iterations/02-agriculture/PRODUCT.md)
- [Iteration 02 — Agriculture Requirements](iterations/02-agriculture/REQUIREMENTS.md)
- [Iteration 02 — Agriculture Design](iterations/02-agriculture/DESIGN.md)
- [Iteration 02 — Final Demo Expectations](iterations/02-agriculture/DEMO.md)

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
