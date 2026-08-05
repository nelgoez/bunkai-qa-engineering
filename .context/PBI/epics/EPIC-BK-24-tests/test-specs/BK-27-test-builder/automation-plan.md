# Automation Plan — BK-27 Test Builder

## ATCs to Write

| # | ATC ID | Scenario | Component Method | Type |
|---|--------|----------|-----------------|------|
| 1 | TBD-1 | Create test with 3 ATCs, verify chain order + activity log | `createTestSuccessfully` | Positive |
| 2 | TBD-2 | Create test with duplicate ATC in chain | `createTestWithDuplicateAtc` | Positive/Edge |
| 3 | TBD-3 | Empty chain rejected (422) | `createTestEmptyChain` | Negative |
| 4 | TBD-4 | Whitespace/200-char title boundary (422) | `createTestInvalidTitle` | Boundary |
| 5 | TBD-5 | Foreign/nonexistent ATC → uniform 404 | `createTestForeignAtc` | Negative/Security |
| 6 | TBD-6 | Double-submit with same key → 1 Test | `createTestIdempotentRetry` | Idempotency |
| 7 | TBD-7 | No auth → 401 | `createTestUnauthenticated` | Auth |
| 8 | TBD-8 | Viewer PAT → 403 | `createTestForbidden` | Auth |

## Components
- **New:** `TestsApi` (extends ApiBase)
- **Fixture:** Register in `ApiFixture.ts` as `api.tests`

## Test Data
- ATC IDs: use `TEST_DATA.atcIds` from existing fixtures or non-existent UUIDs for negative tests
- Use same `projectId`/`moduleId`/`userStoryId` as ATC tests for consistency
