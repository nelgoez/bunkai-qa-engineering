# Test-Architecture Decision Records (ADR)

Append-only log of hard-to-reverse **test-architecture** decisions for this repo.
"Architecture" here = the test suite itself (runner, fixtures, isolation, auth-in-tests,
selector contract, flake policy) — not product architecture. A wrong runner / fixture /
isolation choice is among the most expensive things to reverse: you rewrite the suite.

## When to write one

A decision earns an ADR only when it passes **both** gates:

1. **Architectural** — shapes test-suite structure, a cross-cutting test concern, or a test
   invariant (runner/framework lock-in, fixture + data strategy, isolation model,
   auth-in-tests, selector contract, flake/timeout policy).
2. **Hard to reverse** — acting on it means rewriting many tests, migrating fixtures + data,
   or coordinating the QA team.

Fails either gate → not an ADR. Flaky-fix root causes go to engram; a one-off `waitFor`,
renaming a spec, or a ticket-local test decision stays in the ticket's plan.

AI detection + authoring heuristic: `.agents/skills/agentic-qa-core/references/adr-doctrine.md`.

## Status lifecycle

| Status       | Meaning                                                     |
| ------------ | ----------------------------------------------------------- |
| `Proposed`   | Drafted, awaiting human sign-off                            |
| `Accepted`   | Agreed and binding; the decision the suite follows          |
| `Superseded` | Replaced by a newer ADR — never edited, kept as history     |

Append-only: never rewrite or delete an Accepted ADR. To change a decision, write a new ADR
and wire both directions (`Supersedes` / `Superseded by`).

## Template

Copy `ADR-NNNN-template.md` → `ADR-<NNNN>-<slug>.md`. Fill every section: Context,
Decision, Consequences (positive **and** negative), Alternatives considered. Allocate the
number from this Index (`max(existing) + 1`, zero-padded); numbers are never reused.

## Index

| ADR       | Title                                    | Status   | Supersedes | Superseded by |
| --------- | ---------------------------------------- | -------- | ---------- | ------------- |
| ADR-0001  | API fixture isolation (empty storageState) | Accepted | —          | —             |
| ADR-0002  | Playwright runner + project split        | Accepted | —          | —             |
| ADR-0003  | Selector contract (`data-testid`)        | Accepted | —          | —             |
| ADR-0004  | Flake policy (no retries, `@critical` smoke) | Accepted | —       | —             |
| ADR-0005  | Auth-in-tests (PAT + storageState)       | Accepted | —          | —             |
