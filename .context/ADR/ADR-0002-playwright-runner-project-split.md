# ADR-0002: Playwright runner + project split

- Status: Accepted
- Date: 2026-09-15
- Supersedes: —
- Superseded by: —

## Context

The suite must cover both UI and API, with and without a pre-established session, plus a fast
daily smoke. A single runner avoids two frameworks and two configs drifting apart.

## Decision

Playwright + TypeScript is the sole runner. `playwright.config.ts` declares a fixed project
sequence:

- `global-setup` → creates dirs, validates env.
- `ui-setup` + `api-setup` → authenticate once (see ADR-0005), in parallel.
- `e2e` → Desktop Chrome + `storageState` (authenticated UI + API), ignores `e2e/auth`.
- `e2e-auth` → login flow only, fresh context, no pre-auth.
- `integration` → API-only, no browser (Playwright fixtures are lazy).
- `smoke` → `@critical` grep over `e2e` + `integration`.
- `global-teardown` → reports + TMS write-back.

Fixture selection is lazy: `api` opens no browser; `ui`/`test` open one.

## Consequences

### Positive

- Auth happens once in setup, not per test — the steady-state suite never pays a login per
  spec.
- `smoke` reuses the exact same specs via a `@critical` grep, so there is one source of truth
  for "what is critical", not a duplicated smoke suite.
- API tests stay fast (no browser).

### Negative / trade-off

- The dependency chain is a fixed sequence, adding setup latency before the first test.
- `fullyParallel: false` + `workers: 1` = serial execution; isolation is chosen over speed
  until the suite is proven parallelizable.

## Alternatives considered

- **One monolithic project** — rejected: mixes auth states and drivers, forcing per-test
  conditionals.
- **Separate config file per suite** — rejected: config drift and duplicated reporters.
