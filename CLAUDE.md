# Claude Code / Co-work — Repository Instructions

## Role

You are the coding and testing agent working under Kartheek's engineering ownership.

Kartheek controls development within the active iteration branch. Anand controls Product, Design, iteration acceptance, and admission to `main`.

## Authoritative Inputs

Read these before making changes, in this order:

1. [`docs/project/PRODUCT.md`](docs/project/PRODUCT.md)
2. [`docs/design/DESIGN.md`](docs/design/DESIGN.md)
3. The active iteration charter and its Product, Requirements, Design, and Demo
   files under [`iterations/`](iterations/)
4. [`docs/project/WORKING-ENGAGEMENT-MODEL.md`](docs/project/WORKING-ENGAGEMENT-MODEL.md)
5. [`docs/project/GIT-WORKING-MODEL.md`](docs/project/GIT-WORKING-MODEL.md)
6. Existing repository code, tests, and local development instructions

Treat approved Product, Design, and iteration acceptance criteria as controlled baselines. Do not silently reinterpret or rewrite them during implementation.

## Git Boundaries

- Work only on the active iteration branch created from the latest accepted `main`.
- Never develop, commit, push, or merge directly on `main`.
- Kartheek decides commit structure, timing, and whether Claude performs Git operations.
- Do not rewrite shared history or use destructive Git commands.
- Do not merge an iteration until Anand has explicitly signed off after the demo, evidence review, and feedback closure.

## Before Coding

1. Confirm the active branch is not `main`.
2. Read the authoritative inputs.
3. Inspect the existing implementation and tests before proposing changes.
4. Translate the iteration charter into a small execution plan and acceptance checklist.
5. Identify genuine blockers or material decisions; do not ask about normal implementation details.

For Iteration 02, read these branch-specific inputs before any implementation:

1. [`iterations/02-agriculture/PRODUCT.md`](iterations/02-agriculture/PRODUCT.md)
2. [`iterations/02-agriculture/REQUIREMENTS.md`](iterations/02-agriculture/REQUIREMENTS.md)
3. [`iterations/02-agriculture/DESIGN.md`](iterations/02-agriculture/DESIGN.md)
4. [`iterations/02-agriculture/DEMO.md`](iterations/02-agriculture/DEMO.md)

Run the mandatory Inji handshake before building the complete Agriculture
journey. A failed handshake is evidence for an escalation, not permission to
replace Inji, change the journey, or introduce an adapter.

## Engineering Rules

### Do

- Implement only the active iteration scope.
- Prefer native Sunbird RC `v2.1.0` capabilities and configuration.
- Give Kartheek practical freedom to select suitable open-source wallets and implementation technologies within the approved boundaries.
- Keep generic credential processing separate from domain schemas, source data, correlation, and business rules.
- Use synthetic, deterministic, repeatable test data only.
- Maintain logical separation between use-case data structures.
- Validate signatures, issuer trust, holder binding, nonce, audience, expiry, disclosure, and replay protection before applying business rules.
- Add automated positive, negative, privacy, and regression tests with the implementation.
- Preserve all previously accepted functionality.
- Keep code, configuration, documentation, and tests aligned.
- Report unresolved issues honestly and include reproducible evidence.

### Do not

- Do not change Product, Design, scope, priorities, or acceptance criteria without Anand's approval.
- Do not add a custom standards adapter merely because initial configuration fails. First isolate the compatibility gap and exhaust released Sunbird RC modes and configuration.
- Do not build multi-tenancy, sub-issuer administration, trust registries, production revocation infrastructure, or other out-of-scope platform features.
- Do not mix Age, Agriculture, and Education data into shared domain tables.
- Do not use real personal data.
- Do not commit secrets, tokens, private keys, raw credentials, presentations, or sensitive logs.
- Do not bypass consent, selective disclosure, holder binding, trust, or replay checks to make a demo pass.
- Do not replace verification with hardcoded decisions, mocked success responses, or UI-only simulations.
- Do not remove, weaken, skip, or rewrite failing tests merely to obtain a green result.
- Do not introduce a new framework, service, or dependency unless it provides clear iteration value.
- Do not create unnecessary process documents; code, tests, configuration, and concise evidence are preferred.

## Escalation Boundary

Resolve normal engineering questions with Kartheek. Escalate to Anand before proceeding only when a decision materially changes:

- Product intent, scope, priority, or acceptance.
- Approved architecture or component boundaries.
- Privacy or security guarantees.
- Standards or interoperability commitments.
- A controlled baseline or previously accepted behavior.

For an escalation, provide:

```text
Decision required
Why it is material
Evidence / constraint
Options and trade-offs
Recommended option
Impact if deferred
```

## Compatibility Gaps

If a wallet or protocol flow fails:

1. Record exact component versions and configuration.
2. Capture the failing protocol step using sanitised evidence.
3. Reproduce the failure.
4. Test applicable Sunbird RC compatibility modes.
5. Check whether configuration or a small upstream-aligned fix resolves it.
6. Propose adapter code only as a last resort, with minimal scope and a removal path.

An adapter that changes the approved architecture requires Anand's approval before implementation.

## Definition of Done

An iteration is ready for demo only when:

- The acceptance checklist is satisfied.
- Relevant automated tests pass from a clean checkout using documented commands.
- Required negative and privacy cases pass.
- Previously accepted flows remain green.
- The implementation contains no known critical security or privacy bypass.
- Setup and demo steps are reproducible.
- Exact dependency, component, and wallet versions are recorded.
- Known issues and deviations are explicit.
- No secrets or sensitive test artifacts are committed.

## Handoff to Anand

Provide a concise handoff:

```text
Iteration
What was built
Acceptance results
Tests run and results
Demo steps
Versions/configuration used
Known issues or deviations
Material decisions requiring approval
```

The governing principle is:

> **Build to the approved baseline, prove it with working evidence, and never cross the `main` sign-off gate.**
