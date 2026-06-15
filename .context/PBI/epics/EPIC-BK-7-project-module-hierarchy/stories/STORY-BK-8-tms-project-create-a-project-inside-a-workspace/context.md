# BK-8 — Session Context

## Source
- Jira: https://upexgalaxy69.atlassian.net/browse/BK-8
- Epic: BK-7 (Project & Module Hierarchy)
- Status: In Test (12 días)
- Previous test (2026-06-04): FAILED — 3 defects found
- Defects (now Ready For QA):
  - BK-51: Reserved project slugs not rejected (AC-11)
  - BK-52: Project detail route not workspace-scoped
  - BK-53: Non-Latin (CJK/Cyrillic) project names rejected
- Bugs already closed: BK-60/61/62/83/84/96

## Retest session — 2026-06-15
All 3 defects verified as FIXED. Full regression PASS.

### Bug verification results
- **BK-51 (Reserved slugs)**: PASS — 11 reserved words tested (api, new, create, edit, delete, settings, admin, null, undefined, health, docs), all return 422 `slug_reserved`. "me" rejected as name_too_short (2 chars) — correct.
- **BK-52 (Workspace scoping)**: PASS — WS2 project (acme-qa-spaces) returns 404 when accessed from WS1 (qasmoke-20250605) project list and detail page. Scoping confirmed via browser UI + API. Only WS1 projects visible in WS1 context.
- **BK-53 (Non-Latin names)**: PASS — Russian "проект" → 201, Japanese "プロジェクト" → 201, Chinese "测试项目" → 201. 2-char "项目" correctly rejected for length (min 3), NOT for being non-Latin.

### Regression
- Happy path 201 + slug: PASS
- Name validation (min 3 / max 80): PASS (422)
- Duplicate slug: PASS (409 conflict)
- Cross-workspace same slug: PASS (201 in both)
- Description size (5120 ok / 5121 rejected): PASS
- Slug derivation (accents, emoji): PASS
- Frontend project detail page: PASS

### Verdict
**PASS — READY TO CLOSE.** All three bug fixes verified. Regression intact. Story can transition to Tested.
