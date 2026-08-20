# Claude Code / Co-work — Start Here

Work with Kartheek to implement **Iteration 01 — Age Verification**.

## First Actions

1. Confirm the active branch is `iteration/age-01-verification`, not `main`.
2. Read, in order:
   - [`../../docs/project/PRODUCT.md`](../project/PRODUCT.md)
   - [`../../docs/design/DESIGN.md`](../design/DESIGN.md)
   - [`../../iterations/01-age/CHARTER.md`](../../iterations/01-age/CHARTER.md)
   - [`../../CLAUDE.md`](../../CLAUDE.md)
3. Inspect the repository and existing tests.
4. Give Kartheek a short implementation plan mapped to the Age acceptance checklist.
5. Implement, run, test, debug, and document the reproducible demo.

## Boundaries

- Work only within the active iteration branch.
- Do not change approved Product, Design, scope, or acceptance criteria.
- Prefer native Sunbird RC `v2.1.0` capabilities.
- Do not build an adapter without an evidenced gap and Anand's approval.
- Use synthetic data only; never commit secrets or sensitive artifacts.
- Do not bypass verification, consent, selective disclosure, holder binding, trust, or replay protection.
- Do not weaken tests to make the build pass.
- Do not commit or merge to `main`.

## Required Outcome

Deliver a working, tested Age flow:

**Sunbird RC issuance → mobile wallet → web QR request → consent → disclose only `ageOver18` → verify → APPROVED/DENIED**

When ready, give Kartheek the concise handoff defined in [`CLAUDE.md`](../../CLAUDE.md). Clearly report any unmet acceptance criterion or material decision.
