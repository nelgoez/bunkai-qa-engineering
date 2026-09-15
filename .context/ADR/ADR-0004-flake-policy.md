# ADR-0004: Flake policy (no retries, `@critical` smoke)

- Status: Accepted
- Date: 2026-09-15
- Supersedes: —
- Superseded by: —

## Context

Flaky tests erode the trust a CI gate is supposed to provide. The suite needs an explicit
stance on retries, on which tests make up the daily smoke, and on how known-broken behavior is
kept visible without blocking the pipeline.

## Decision

- `retries: 0` — a test is deterministic; a failure is investigated, not masked by a retry.
- `workers: 1`, `fullyParallel: false` — isolation over speed until parallelization is proven.
- The smoke subset is every `@critical`-tagged spec, selected by `grep` in the `smoke` project
  (single source of truth, not a duplicated suite).
- Known-broken product behavior is marked `test.fixme(...)` (e.g. `workspace-project-crud`);
  an endpoint that is not yet deployed is `test.describe.skip(...)` (e.g. `defect-sync`,
  "/defects not deployed").

## Consequences

### Positive

- No green-washing: a red run is always a real regression or a filed, visible known-issue.
- `smoke` is fast and honest — the daily signal carries no retry ambiguity.

### Negative / trade-off

- With `retries: 0`, a single transient environment hiccup reddens the run. Accepted cost: the
  failure is surfaced, classified (regression vs flaky vs environment), and fixed at the root
  rather than hidden behind a retry.

## Alternatives considered

- **`retries: 2`** — rejected: masks flake and delays root-cause.
- **Per-suite tag configs for smoke** — rejected: `grep` over `@critical` is one source of
  truth; per-suite configs drift.
