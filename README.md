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
- **IMPLEMENTATION:** next stage; work proceeds through use-case iteration branches.

## Project Documents

- [Product Definition](docs/project/PRODUCT.md)
- [Working & Engagement Model](docs/project/WORKING-ENGAGEMENT-MODEL.md)
- [Git Working Model](docs/project/GIT-WORKING-MODEL.md)
- [Architecture & Design](docs/design/DESIGN.md)
- [Compatibility Baseline](docs/design/COMPATIBILITY.md)
- [Coding Agent Instructions](CLAUDE.md)
- [Iteration 01 — Age Verification](iterations/01-age/CHARTER.md)
- [Kartheek — Start Here](docs/start/KARTHEEK-START.md)
- [Claude Code / Co-work — Start Here](docs/start/CLAUDE-START.md)

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
