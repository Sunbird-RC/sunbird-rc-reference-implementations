# Sunbird RC Demo — Working & Engagement Model

## Purpose

Use a lightweight **Human + Agent** model. Humans provide intent, make material decisions, and approve outcomes; agents carry the work between those gates.

## Delivery Flow

```text
PRODUCT — Anand + ChatGPT
        ↓ approved product baseline
DESIGN — Anand + ChatGPT
        ↓ approved architecture baseline
ITERATION — objective, scope, constraints, acceptance
        ↓
CODE + TEST — Kartheek + Claude Code / Co-work
        ↓ working demo + test evidence
REVIEW — Anand + ChatGPT
        ↓ accept or request changes
NEXT ITERATION
```

The cycle continues until a use case is complete, then repeats for the next use case.

## Ownership

| Stage | Human | Agent | Output / Gate |
|---|---|---|---|
| Product | Anand | ChatGPT | Product intent, scope, and acceptance approved |
| Design | Anand | ChatGPT | Architecture and key decisions approved |
| Iteration definition | Anand | ChatGPT | Objective, scope, constraints, and acceptance |
| Code | Kartheek | Claude Code / Co-work | Working implementation |
| Test and verification | Kartheek | Claude Code / Co-work | Tests and evidence |
| Iteration sign-off | Anand | ChatGPT | Accept or changes required |

Kartheek owns engineering execution and normal implementation decisions. Claude may assist with code, tests, debugging, refactoring, documentation, and validation under Kartheek's supervision.

## Escalation Boundary

Kartheek and Claude should resolve implementation-level questions independently. Bring a decision back to Anand only when it materially affects:

- Product intent, scope, or acceptance criteria.
- Approved architecture.
- Privacy or security.
- Standards or interoperability.

## Iteration Review

At the end of each iteration:

1. Kartheek demonstrates the working implementation and test results.
2. Anand reviews it against the agreed Product, Design, and iteration acceptance criteria.
3. **ACCEPTED:** sign off, merge to the accepted baseline, and begin the next iteration.
4. **CHANGES REQUIRED:** Kartheek and Claude address the identified gaps and return for review.

Code, tests, and the working demonstration are the primary evidence; additional review paperwork is unnecessary unless it adds clear value.

## Working Principles

- Product defines **what and why**.
- Design defines **how at the architecture level**.
- Engineering owns implementation details.
- Build and verify in small, demonstrable iterations.
- Do not begin the next iteration until the current one is accepted.
- Keep human intervention focused on material decisions and sign-off.
- Keep project and agent instructions concise; create only the documentation needed to build, verify, and maintain the showcase.

**Agree intent → Agree design → Build → Test → Demo → Sign off → Continue**
