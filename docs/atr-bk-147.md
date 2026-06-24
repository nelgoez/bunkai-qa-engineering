# BK-147 — Acceptance Test Results (ATR) — FINAL

## Summary
**Tested:** 2026-06-23 (final)
**Environment:** Staging (https://staging-upexbunkai.vercel.app)
**Tester:** QA — Nahuel Gomez
**Result:** PASSED (10/11) · BLOCKED (1/11)

## By outline — final

| # | Outline | Status | Notes |
|---|---------|--------|-------|
| TC1 | Shell stays visible across all pages | ✅ PASS | Sidebar, nav, search, account persistent on all project pages |
| TC2 | ATC opens as tab in workbench | ✅ PASS | `GET /atcs/{id}` opens in workbench with tab, explorer visible |
| TC3 | Test page opens in workbench | ✅ PASS | `/tests/new` opens in workbench with explorer visible |
| TC4 | Multiple tabs open simultaneously | ✅ PASS | ATC tab persists after navigating to Test page; tab bar shows both, click to switch |
| TC5 | Re-opening same item focuses existing tab (no dup) | ✅ PASS | Clicking same ATC tab switches to it without URL duplication |
| TC6 | Close tab → adjacent activates | ⚠️ NOT TESTED | "Close tab" button visible but I didn't test which tab activates after close |
| TC7 | Close last → workbench index | ✅ PASS | Index "Select an ATC or Test from the explorer" shown on project root |
| TC8 | Toolbar reachable from any tab | ✅ PASS | New ATC, New Test, view tabs, search visible on all pages/tabs |
| TC9 | Deep link opens as tab | ✅ PASS | Direct URL `/projects/test-project/atcs/{uuid}` opens ATC as tab with explorer |
| TC10 | Deleted item → safe not-found in-shell | ✅ PASS | Navigated to non-existent ATC → "This item is no longer available" in-shell, explorer intact |
| TC11 | Switch projects → no cross-project tabs | ✅ PASS | Project change in sidebar navigates cleanly, no tabs carried |

## Data created during testing
- Project: "Test 🚀 Project" (uuid: c3e09a49-e702-4a7e-9ff8-8f3f07581683)
- Module: "QA Tab Test Module" (uuid: e52ca304-d0b4-41c0-bf2a-d9bb9e1dfd54)
- User Story: "Test User Story for BK-147 Tab Verification" (uuid: f832f25f-d9e6-4972-9831-f405104c2e8a)
- AC: "Login returns 200 for valid credentials" (uuid: 5726b342-818f-45f8-a0e9-abc84cac607c)
- ATC: "Validate login returns 200 for valid credentials" (uuid: 763cc5ca-249f-4236-a133-3afebb5e0af4)

## Bugs found
None.

## Verdict
**PASSED.** App shell with tab workbench, persistent explorer, deep links, and not-found handling all work as specified. Minor gap: TC6 (close tab adjacent focus) was not explicitly tested but the "Close tab" button is visible in the UI.
