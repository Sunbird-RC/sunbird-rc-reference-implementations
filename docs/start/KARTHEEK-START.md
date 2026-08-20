# Kartheek — Start Here

You own development, testing, commits, and the iteration demo.

## Start

1. Pull the latest `main`.
2. Create your working branch:

   ```text
   iteration/age-01-verification
   ```

3. Read the files in this order:

   1. [`PRODUCT.md`](../project/PRODUCT.md) — what the showcase must achieve.
   2. [`DESIGN.md`](../design/DESIGN.md) — the approved architecture and boundaries.
   3. [`WORKING-ENGAGEMENT-MODEL.md`](../project/WORKING-ENGAGEMENT-MODEL.md) — roles, decisions, and sign-off flow.
   4. [`GIT-WORKING-MODEL.md`](../project/GIT-WORKING-MODEL.md) — branch and `main` rules.
   5. [`Iteration 01 — Age Verification`](../../iterations/01-age/CHARTER.md) — current scope and acceptance criteria.
   6. [`CLAUDE.md`](../../CLAUDE.md) — repository-wide coding-agent rules.
   7. [`COMPATIBILITY.md`](../design/COMPATIBILITY.md) — optional technical reference; wallet decisions remain yours.

4. Decide how you want to use Claude Code / Co-work and which suitable open-source wallet to use.
5. Give Claude the [`CLAUDE-START.md`](CLAUDE-START.md) instruction.

## During the Iteration

- Make normal engineering decisions independently.
- Keep all work on the iteration branch; do not work on or merge to `main`.
- Build, run, test, and fix until the Age charter is satisfied.
- Escalate only a material change to Product, Design, privacy/security, interoperability, or acceptance.
- Keep concise, reproducible evidence of versions, setup, tests, and known issues.

## Finish

Demonstrate the working wallet and web-verifier flow with test evidence.

After feedback is closed, Anand will explicitly sign off before anything is merged into `main`.
