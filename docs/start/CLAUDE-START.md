# Claude Code / Co-work — Start Here

Work with Kartheek to implement **Iteration 01 — Age Verification**.

## First Actions

1. Confirm the active branch is `iteration/age-01-verification`, not `main`.
2. Read the files in this order:

   1. [`PRODUCT.md`](../project/PRODUCT.md) — authoritative product intent, requirements, and exclusions.
   2. [`DESIGN.md`](../design/DESIGN.md) — approved architecture and component boundaries.
   3. [`WORKING-ENGAGEMENT-MODEL.md`](../project/WORKING-ENGAGEMENT-MODEL.md) — ownership, escalation, and acceptance flow.
   4. [`GIT-WORKING-MODEL.md`](../project/GIT-WORKING-MODEL.md) — branch rules and the `main` sign-off gate.
   5. [`Iteration 01 — Age Verification`](../../iterations/01-age/CHARTER.md) — active scope, acceptance criteria, evidence, and exclusions.
   6. [`CLAUDE.md`](../../CLAUDE.md) — mandatory repository-wide coding-agent instructions.
   7. [`COMPATIBILITY.md`](../design/COMPATIBILITY.md) — technical reference only; Kartheek owns wallet and implementation choices.

3. Inspect the repository, current implementation, configuration, and tests before changing anything.
4. Convert the Age charter into a short execution plan and acceptance checklist.
5. Review the plan with Kartheek; resolve normal implementation decisions together without escalating them.
6. Implement, run, test, debug, and document the reproducible demo.
7. Give Kartheek the evidence-based handoff defined in [`CLAUDE.md`](../../CLAUDE.md).

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
