# Iteration 03 — Start Here

## Kartheek

1. Do not start implementation until Iteration 02 is accepted and merged.
2. Synchronize this branch with the resulting `main` without losing its history.
3. Review and obtain approval for Product, Requirements, Design, and Demo inputs.
4. Keep implementation, questions, decisions, evidence, and feedback on this branch.
5. Present the final customer demonstration; coding-agent activity belongs in
   commits and evidence.
6. Do not merge to `main` without Anand's explicit sign-off.

## Coding agent

Read in this order:

1. `iterations/03-education/PRODUCT.md`
2. `iterations/03-education/REQUIREMENTS.md`
3. `iterations/03-education/DESIGN.md`
4. `iterations/03-education/DEMO.md`
5. `CLAUDE.md`
6. Accepted Age and Agriculture evidence and implementation logs

Before coding, produce a requirement-to-test plan. Build the line-by-line
validation and captured evidence throughout the iteration.

## Non-negotiable lessons carried forward

- Do not change Product or Design silently.
- Enforce the approved algorithm policy; do not mark an unenforced control complete.
- Application URLs and real clients must be covered, not only internal helper paths.
- Verify issuer identity per credential role.
- Verify all credentials belong to the same holder before correlation.
- Keep business ineligibility distinct from verification rejection and refusal.
- Keep result wording exact: eligibility is not admission or employment.
- Keep secrets, raw credentials, presentations, and undisclosed claims out of Git.
- Run Age and Agriculture regression before handoff.
- No final demo until clean-checkout setup, tests, evidence, and validation are complete.

## Required handoff

```text
Iteration and final commit
What was built
Line-by-line acceptance results
Tests and captured runs
Demo sequence
Versions and configuration
Known issues and deviations
Regression results
Decisions requiring Anand
```
