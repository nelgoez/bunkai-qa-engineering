# ADR-0005: Auth-in-tests (PAT + storageState)

- Status: Accepted
- Date: 2026-09-15
- Supersedes: —
- Superseded by: —

## Context

Bunkai's `/auth/login` endpoint is broken (BK-177). The UI two-step sign-in returns a PAT
(personal access token) that authenticates `/api/v1/*`. Tests need both a browser session (for
UI) and a token (for API), without logging in on every spec.

## Decision

- `ui-setup` logs in through the UI, intercepts the sign-in response to capture the PAT, then
  saves BOTH `storageState` (cookies/localStorage for UI tests) and `api-state.json` (PAT for
  API calls within E2E) — `tests/setup/ui-auth.setup.ts`.
- `api-setup` authenticates via email/password → JWT and saves `api-state.json` for
  integration tests — `tests/setup/api-auth.setup.ts`.
- `config.testUser` credentials resolve either as PAT or as email+password;
  `config/validateTestEnv.ts` accepts either (`STAGING_USER_PAT` **or**
  `STAGING_USER_EMAIL` + `STAGING_USER_PASSWORD`).

## Consequences

### Positive

- One auth path per concern: UI tests get a session, API tests get a token, E2E gets both from
  a single login.
- The PAT bypasses the broken `/auth/login` (BK-177) without a product fix.

### Negative / trade-off

- Depends on response interception: a sign-in contract change breaks `ui-setup` before any
  test runs.
- Two auth artifacts (`api-state.json` vs `storageState`) must stay in sync across the two
  setup projects.

## Alternatives considered

- **storageState-only** — rejected: no token for API calls.
- **Login-per-test** — rejected: slow, flaky, couples every test to auth.
- **Static env-var token injection** — rejected: no self-serve refresh, tokens go stale.
