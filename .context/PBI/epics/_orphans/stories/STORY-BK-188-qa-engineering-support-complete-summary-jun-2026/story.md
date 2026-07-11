# QA Engineering Support — Complete Summary (Jun 2026)

**Jira Key:** [BK-188](https://jira.upexgalaxy.com/browse/BK-188)
**Type:** Story
**Status:** Shift-Left QA
**Priority:** Medium
**Story Points:** 1

---

## Overview

## QA Engineering Support — Complete Summary

### Coverage by ticket

| Ticket | Type | Status | QA Work |
| --- | --- | --- | --- |
| BK-4 | Story | Ready For Release | Sprint-testing: full ATP/ATR, QA Approved |
| BK-5 | Story | QA Approved | Sprint-testing: 3 critical bugs found |
| BK-8 | Story | Ready For Release | Sprint-testing: full ATP/ATR |
| BK-11 | Story | Ready For Release | Sprint-testing: full ATP/ATR |
| BK-13 | Epic | Planning | ATC Library — epic context; automation scaffolding for all 12 TCs |
| BK-18 | Story | QA Approved | Full API automation: 12 TC outlines covered, 18 Playwright tests |
| BK-43 | Story | Backlog | Shift-left refinement: defect sync requirements analysis |
| BK-47 | Story | Shift-Left QA | Shift-left refinement: time-to-green metric analysis |
| BK-147 | Story | Ready For Release | Sprint-testing: app-shell tab workbench, 10/11 PASS |
| BK-149 | Test | Candidate | POST /atcs create ATC 201 — automated |
| BK-150 | Test | Candidate | POST /atcs auth rejection 401/403 — automated (403 blocked) |
| BK-151 | Test | Candidate | POST /atcs AC outside user_story → 422 — automated |
| BK-152 | Test | Candidate | POST /atcs module outside subtree → 404 — automated |
| BK-153 | Test | Candidate | POST /atcs step position validation → 422 — automated |
| BK-154 | Test | Candidate | POST /atcs body boundaries → 422 — automated |
| BK-155 | Test | Candidate | POST /atcs non-existent user_story → 404 — automated |
| BK-156 | Test | Candidate | PATCH /atcs version bump + cascade — automated |
| BK-157 | Test | Candidate | PATCH /atcs optimistic locking — automated |
| BK-158 | Test | Candidate | PATCH /atcs non-existent id → 404 — automated |
| BK-159 | Test | Candidate | PATCH /atcs identical payload → 200 — automated |
| BK-160 | Test | Candidate | PATCH /atcs immutable fields — automated |

### Automated tests (12/12 TC outlines covered)

{panel:bgColor=#E8F5E9}
***Framework******:*** Playwright + TypeScript + KATA architecture
***Project******:*** bunkai-qa-engineering (separate QA repo)
***CI/CD******:*** GitHub Actions — build.yml (PR gate), regression.yml (nightly), sanity.yml (manual), smoke.yml (daily)
***Reporting******:*** Allure reports deployed to GitHub Pages
***Reports URL******:*** https://nelgoez.github.io/bunkai-qa-engineering/staging/sanity/
{panel}

All 18 tests pass in CI. They use a Personal Access Token (PAT) for API auth, bypassing the broken /auth/login endpoint (BK-177 REJECTED).

### Known blocks / gaps

| Issue | Blocked on | Severity |
| --- | --- | --- |
| BK-150: 403 scope test | STAGING*USER*READONLY_PAT — need a token without atc:write scope | Medium |
| Tests not in `integration` project | BK-177 — /auth/login REJECTED, can't use api-setup dependency | Low |
| Sandbox tests not in nightly regression yet | Currently only in build.yml (PR) and sanity.yml (manual) | Low |
| Allure gh-pages first-deploy git error | No history branch; self-heals after first successful deploy | Cosmetic |

### CI/CD pipeline status

| Workflow | Trigger | Status |
| --- | --- | --- |
| build.yml | PR to main | Compile + lint + sandbox tests |
| regression.yml | Daily midnight + manual | Integration (broken — BK-177) → E2E → Allure |
| smoke.yml | Daily 2AM + manual | @critical tests → Allure |
| sanity.yml | Manual dispatch | Targeted execution, supports sandbox project |

### Recommendations

1. Fix BK-177 (/auth/login) to unblock `integration` project and enable full regression suite
2. Create a restricted-scope PAT to test BK-150 403 scenario
3. Add sandbox tests to nightly regression.yml once CI credentials are stable
4. Set up cross-repo CI trigger: app repo deploy → QA repo test run

---

## Fields

> Each rich-text field is a separate file in this folder.

- [Acceptance Criteria](./acceptance-criteria.md)

---

## Metadata

- **Created:** 30/6/2026
- **Updated:** 6/7/2026
- **Reporter:** Nahuel Gomez
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
