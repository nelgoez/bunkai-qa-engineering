# ADR-0001: API fixture isolation (empty storageState)

- Status: Accepted
- Date: 2026-09-15
- Supersedes: —
- Superseded by: —

## Context

KATA Layer 4 exposes three fixtures over the same `TestContext`: `api` (API-only, no
browser), `ui` (browser-only), and `test` (hybrid UI + API). In hybrid E2E tests the browser
carries a `storageState` session cookie from the smoke/e2e project. If the `api` fixture
shared that request context, auth-negative assertions — `clearAuthToken()` then expect
`401` — would silently present the session cookie and receive `200`/`201` instead. This
surfaced as BK-310 (unauthenticated) and BK-312 (invalid credentials) failing for the wrong
reason.

## Decision

The `api` fixture always constructs its own isolated request context:

```ts
const request = await playwright.request.newContext({
  storageState: { cookies: [], origins: [] },
});
```

(see `tests/components/TestFixture.ts`). API tests authenticate via Bearer token only, loaded
from `api-state.json`. The smoke project's `storageState` session cookie must never leak into
API requests.

## Consequences

### Positive

- Auth-negative API tests are truthful: `401` means "no valid token", not "no session cookie".
- UI and API authentication are independently verifiable, so a broken UI flow can't mask a
  broken API contract or vice versa.

### Negative / trade-off

- Every API test allocates a fresh request context (minor setup cost per test).
- Hybrid tests cannot reuse the browser session cookie for API calls — they must carry the
  token from `api-state.json`, which is populated by the setup project.

## Alternatives considered

- **Reuse the browser's request context** — rejected: leaks the session cookie into API
  requests and breaks every `401` assertion.
- **Login-per-test** — rejected: slow, flaky, and couples every test to the auth flow.
