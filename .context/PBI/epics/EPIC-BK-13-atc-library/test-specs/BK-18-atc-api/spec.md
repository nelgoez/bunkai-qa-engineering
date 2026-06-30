# BK-18: ATC Create/Edit REST API — Test Spec

## Scope
Automated tests for `POST /api/v1/atcs` and `PATCH /api/v1/atcs/{id}` endpoints.
API-only (UI is BK-19). Authenticated via PAT with `atc:write` scope.

## ATCs

| ATC ID | Method | Scenario | Coverage |
|--------|--------|----------|----------|
| BK-149 | `createAtcSuccessfully` | POST happy create → 201 | Valid payload, layer enum (UI/API/Unit) |
| BK-150 | `createAtcWithInvalidAuth` | POST auth gate → 401 | No auth, invalid token |
| BK-153 | _(inline in test)_ | POST step validation → 422 | Non-increasing positions |
| BK-154 | _(inline in test)_ | POST boundary validation → 422 | Title min/max length |
| BK-156 | `patchAtcSuccessfully` | PATCH happy + X-If-Match → 200 | Full-replace, version bump |

## Fixture
`{ api }` — no browser.

## Test Data
- Project: `1a6fdae6-8b0c-47bb-b444-0e2563deab4b`
- Module: `37aa2ba9-47eb-4e45-ad2d-085c1ee36ef4`
- User Story: `0f4a6636-d845-4459-9262-ebae2657ca62`
- AC: `96587255-b61d-4f8b-9cf7-a09f945c4bb1`
- Auth: `config.testUser.pat` from `.env`
