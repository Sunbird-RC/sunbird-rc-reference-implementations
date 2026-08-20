# Sunbird RC Demo — Git Working Model

## Purpose

Git is the project's common source of truth.

> **Kartheek controls development. Anand controls acceptance into `main`.**

## Branch Model

`main` is always the latest accepted, working baseline. Each implementation iteration starts from `main` and uses one iteration branch.

```text
main
  ↓
iteration branch
  ↓
Kartheek + Claude Code / Co-work
Build → Test → Debug → Commit
  ↓
Iteration demo + test evidence
  ↓
Feedback closure
  ↓
Anand sign-off
  ↓
Merge to main
  ↓
Next iteration
```

Example branches:

```text
iteration/age-01-issuance
iteration/age-02-verification
iteration/agri-01-multi-issuer
```

## Kartheek — Development Ownership

Kartheek owns branch creation and management, coding, testing, debugging, commits, necessary technical documentation, and preparation of the iteration demo.

Kartheek decides how best to use Claude Code / Co-work within the iteration branch. Anand does not need to review intermediate commits or development activity.

## Claude Code / Co-work Boundaries

Claude must:

- Work only within the active iteration branch.
- Never commit or merge directly to `main`.
- Treat the approved Product, Design, and active iteration definition as authoritative baselines.
- Run and validate relevant tests before declaring an iteration ready.
- Identify unresolved issues that affect acceptance.
- Escalate rather than apply material changes to Product, Design, scope, privacy/security, interoperability, or acceptance criteria.

Within these boundaries, Claude may create code, tests, fixes, documentation, and commits under Kartheek's supervision.

## Anand — `main` Ownership

An iteration may move to `main` only after:

1. Kartheek demonstrates the working iteration.
2. Required tests and evidence are presented.
3. Agreed feedback is addressed.
4. Anand explicitly signs off.

No direct development or merge to `main` is permitted without this gate. The next iteration starts from the updated `main` only after the accepted change is merged.

## Simple Rules

- `main` = accepted working baseline.
- One iteration = one working branch.
- Kartheek owns development and commits on that branch.
- Claude operates only within Kartheek's branch and the approved baselines.
- Build and test before the demo.
- Close feedback before requesting acceptance.
- Anand signs off before any merge to `main`.

**Build → Test → Demo → Feedback → Sign-off → Merge → Next iteration**
