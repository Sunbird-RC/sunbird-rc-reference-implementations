# Iteration 02 — Agriculture / Rural Credit: Formal Sign-off

**Decision owner:** Anand

**Date:** 31 August 2026

**Branch:** `iteration/agriculture-02-rural-credit`

**Kartheek's final handoff:** `deefe25`

**Status:** Accepted — authorized to merge into `main`

## Acceptance decision

Iteration 02 is accepted based on the reviewed customer demonstration, the
line-by-line acceptance table, captured automated evidence, Option A algorithm
enforcement, and successful Age regression.

The accepted evidence reports:

- 101 unit tests passed, 0 failed.
- 96 end-to-end tests passed, 0 failed.
- 100 verification checks passed, 0 failed, 0 skipped.
- 39 Age unit and 51 Age end-to-end regression tests passed.
- 136 Sunbird RC fork tests passed.

The six deviations recorded in `docs/evidence/02-agriculture/ACCEPTANCE.md` are
known and accepted for this demo iteration. They must not be represented as
capabilities that were verified when they were not.

## Wallet scope

Inji is removed from the scope of the complete demo programme. The customized
Paradym-based wallet used in the accepted demonstrations is the approved wallet
baseline. No Inji work is deferred to Education.

## Authorization

Kartheek is authorized to merge this branch into `main`. After the merge, he
should synchronize `iteration/education-03-employment` with the updated `main`,
read its `START.md`, and begin the Education iteration under its Product,
Requirements, Design, and Demo inputs. The Education branch must not merge into
`main` without a new explicit sign-off.
