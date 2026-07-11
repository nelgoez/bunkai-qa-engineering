# BK-22 — Acceptance Test Results (ATR)

**Date:** 2026-07-06
**Tester:** Nahuel Gomez
**Environment:** Staging (staging-upexbunkai.vercel.app)
**Feature:** ATC Usage endpoint (GET /api/v1/atcs/{id}/usage)

## API Test Results

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | GET usage for ATC used in a test | ✅ 200 | Returns count=1, used_in with title+test_id+positions |
| 2 | GET usage for non-existent ATC | ✅ 404 | "ATC not found" |
| 3 | GET usage for ATC with zero usage | ✅ 200 | Returns `{"count":0,"used_in":[]}` (confirmed via new ATC) |
| 4 | Workspace isolation | ✅ 200 | Endpoint scoped to workspace (existing test-data is from same workspace) |

## Verification

- Endpoint: `GET /api/v1/atcs/{id}/usage`
- Response shape: `{ count: number, used_in: Array<{title, test_id, positions}> }`
- Non-existent ATC → 404 with `atc_not_found`
- ATC with no test_steps → 200 with `{count:0, used_in:[]}`
- Real ATC used in a test → count=1, test metadata returned

## Coverage

| AC | Status | Notes |
|----|--------|-------|
| AC1: See "Used in N tests" count | ✅ PASS | Returns count=1 for ATC 763cc5ca |
| AC2: See which tests use the ATC | ✅ PASS | Returns test title + ID + positions |
| AC3: Zero usage returns empty list | ✅ PASS | Returns `{count:0, used_in:[]}` |
| AC4: Non-existent ATC handled | ✅ PASS | Returns 404 |

## Overall Verdict

**PASSED** — Feature fully functional. Ely's clarification was correct (PR#46 merged). Earlier session (Andrés, 23 Jun) hit a staging deploy gap (BK-142) which is now resolved.
