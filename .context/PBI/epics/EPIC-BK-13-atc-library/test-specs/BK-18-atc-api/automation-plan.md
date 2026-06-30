# BK-18: ATC API — Automation Plan

## Files

| Path | Purpose |
|------|---------|
| `api/schemas/atc.types.ts` | ATC payload/response type definitions |
| `tests/components/api/AtcsApi.ts` | API component with `createAtcSuccessfully`, `patchAtcSuccessfully`, `createAtcWithInvalidAuth` |
| `tests/components/ApiFixture.ts` | Fixture registration (`api.atcs`) |
| `tests/integration/atc/atc-create-edit.sandbox.ts` | 7 test cases (sandbox project until auth fixed) |

## Dependencies
- `STAGING_USER_PAT` in `.env` (read via `config.testUser.pat`)
- Staging seed data: module, US, AC (created via API in setup)
- Auth endpoint (`/auth/login`) currently broken (BK-177)
  → Tests bypass via PAT until BK-175/BK-177 resolved

## Future
When auth is fixed: move to `tests/integration/atc/atc-create-edit.test.ts` under `integration` project, add api-setup dependency. Optionally POST `/tokens` to generate PAT dynamically per test run.
