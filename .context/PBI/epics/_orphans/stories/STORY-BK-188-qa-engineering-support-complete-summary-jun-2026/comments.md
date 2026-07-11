# Comments for BK-188

[View in Jira](https://jira.upexgalaxy.com/browse/BK-188)

---

### Nahuel Gomez - 30/6/2026, 22:13:53

***Updated***: BK-166 automated (8 tests). Key discovery: /api/v1/auth/signin works on staging. This supersedes the old /auth/login endpoint (BK-177). Full details in BK-166 comments.

---

### Nahuel Gomez - 30/6/2026, 22:27:49

## Automation Complete — Combined Summary

All tests pass in CI. Framework: Playwright + TypeScript + KATA, sandbox project (no auth dependency).

### Reports

| Report | URL |
| --- | --- |
| Allure (latest) | https://nelgoez.github.io/bunkai-qa-engineering/staging/sanity/ |

### BK-166 — Auth email+password sign-in API (8 tests)

CI run: https://github.com/nelgoez/bunkai-qa-engineering/actions/runs/28486452620

| Scenario | Status |
| --- | --- |
| Sign in with valid credentials → 200 (user+session+PAT) | ✅ |
| Sign in with wrong password → 401 | ✅ |
| Sign in with non-existent email → 401 | ✅ |
| Check email (existing) → {exists:true, confirmed:true} | ✅ |
| Check email (unknown) → {exists:false} | ✅ |
| GET /me with valid PAT → 200 | ✅ |
| GET /me without auth → 401 | ✅ |
| Sign-in PAT authenticates subsequent calls | ✅ |

### BK-4 — Workspace CRUD (4 tests)

CI run: https://github.com/nelgoez/bunkai-qa-engineering/actions/runs/28487034357

| Scenario | Status |
| --- | --- |
| Create workspace with name+slug → 201 | ✅ |
| Name < 3 chars → 422 | ✅ |
| Reserved slug → 422 | ✅ |
| Duplicate slug → 409 | ✅ |

### BK-8 — Project CRUD (4 tests)

| Scenario | Status |
| --- | --- |
| Create project in workspace → 201 | ✅ |
| Name < 3 chars → 422 | ✅ |
| Duplicate slug → 409 | ✅ |
| Non-member → 403 | ✅ |

### BK-18 — ATC API (17 tests + 1 fixme)

Verified locally and in CI (sandbox project).

| Coverage | Status |
| --- | --- |
| 12/12 TC outlines automated | ✅ |
| 17 tests pass, 1 fixme (403 scope) | ✅ |

### Known gaps

- BK-150 403 scope test blocked on STAGING*USER*READONLY_PAT
- Sandbox tests not promoted to integration project (blocked on BK-177: old /auth/login 404s)
- Key discovery: /api/v1/auth/signin works — loginEndpoint config can be updated to fix this

---

### Nahuel Gomez - 30/6/2026, 23:14:29

## QA Automation Session — Complete Report (2026-06-30)

### Tally

| Ticket | Tests | Status |
| --- | --- | --- |
| BK-166 | 8 | ✅ PASS |
| BK-4 | 4 | ✅ PASS |
| BK-8 | 4 | ✅ PASS |
| BK-17 | 6 | ✅ PASS |
| BK-14 | 5 | ✅ PASS |
| BK-18 (prev) | 17 | ✅ PASS |
| ***Total**** | ****44 + 1 fixme*** |  |

### Infrastructure changes

- ***loginEndpoint**** fixed: `/auth/login` → `/api/v1/auth/signin`. The old endpoint 404s (BK-177). The BK-166 endpoint works. ****Integration project is now unblocked.***
- ***AuthApi*** updated to use sign-in PAT (not session token) for API auth — matches BK-166 coexistence pattern.
- ***meEndpoint*** fixed to `/api/v1/me` (actual path).
- ***auth.types.ts*** updated to match real API response shapes.
- ***jira-attach-evidence.ts*** script created for attaching screenshots to Jira tickets via REST API.

### CI/CD

- All tests pass in sandbox project. Allure reports at:

  https://nelgoez.github.io/bunkai-qa-engineering/staging/sanity/

### Known gaps (unchanged)

- BK-150 403 scope test — blocked on restricted-scope PAT
- Sandbox → `.test.ts` promotion — now feasible since api-setup works
- Nightly regression doesn't include sandbox tests yet (PR gate + manual only)

### Next-step candidates

| Priority | Ticket | Summary | Est. time |
| --- | --- | --- | --- |
| 1 | BK-182 | Bearer run can't resolve active workspace | ~15 min |
| 2 | BK-22 | ATC "Used in N tests" report | ~15 min |
| 3 | BK-57 | PATCH /modules/{id} atomicity | ~20 min |
| 4 | BK-36 | Abort a run in progress | ~20 min |

---

### Nahuel Gomez - 3/7/2026, 17:30:10

## Phase 1 Complete — Moved to Shift-Left QA

QA Engineering Support summary populated with all 18 tickets, 44 automated tests, CI/CD status, known gaps, and next-step recommendations. Ready for PO review.

---


_Synced from Jira by sync-jira-issues_
