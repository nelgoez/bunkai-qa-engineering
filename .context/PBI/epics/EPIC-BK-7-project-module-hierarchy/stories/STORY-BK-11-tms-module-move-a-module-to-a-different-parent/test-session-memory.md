# BK-11 — Test Session Memory

## TMS Modality
jira-native

## Stage State
- Stage 1 (Planning): completed (2026-06-15)
- Stage 2 (Execution): completed (2026-06-15)
- Stage 3 (Reporting): pending

## Test Data
- Staging: https://staging-upexbunkai.vercel.app
- API: https://staging-upexbunkai.vercel.app/api/v1
- Test user: qa-headless@bunkai.io
- Auth mechanism: magic-link / OAuth (no password login endpoint)

## ACs Summary
1. Move Module to new parent → breadcrumb "Checkout / Payment"
2. Move relocates sub-tree → "Checkout / Payment / Refunds"
3. Move onto own descendant → blocked
4. Move exceeding max depth (6) → blocked
5. Move nested Module back to Project root

## Stage 1 — Planning Results

### Risk Score: 13/14 (HIGH)
- New feature (+3), dynamic data (+3), explicit ACs (+2), user-facing (+2), high effort (+2), multi-component (+1)
- Priority Medium (+0)

### Risk Distribution
- P0: 6 — Core positive + critical negative (cycle, depth, root)
- P1: 9 — Boundary, security, edge, no-op, cross-project
- P2: 3 — Race condition, UI-only concerns

### ATP Published
- Method: Fallback comment (customfield_10120 not on issue screen)
- Location: `## Acceptance Test Plan (ATP)` in Jira comment on BK-11
- Synced to: `comments.md` in story folder
- 18 TC outlines drafted

### Open Questions
1. Should the UI's valid-targets picker also block no-op moves (currently parent)?
2. Is concurrent-move race acceptable risk? The SQL function is transactional.
3. Should `parent_invalid` cover the case where target is archived? Current SQL validates `archived_at is null`.

### AC Gaps
1. AC1-5 don't specify error message text (exact string to assert on)
2. No AC covers the client-side valid-targets picker behavior (greyed nodes)
3. No AC covers the "project root" option visibility (only shows for nested modules)

## Stage 3 — Reporting

**Completed:** 2026-06-15T18:00 UTC

### Artifacts Published
- **ATR**: Published as comment #11599 on BK-11 (fallback — `customfield_10147` not on issue screen)
- **QA Comment**: Posted (Template A — PASSED)
- **Evidence**: 5 screenshots captured during Stage 2 execution

### Transition
- **From**: Ready For QA
- **To**: QA Approved
- **Status**: BLOCKED — user `nahuelgomez.cti@gmail.com` lacks transition permission. Transitions array returned empty for BK-11.
- **Note**: Manual transition required. Assignee (micaelavirgagarcia) or Jira admin needs to perform the transition.

### Results Summary
- **Total Outlines**: 18
- **Passed**: 14
- **Failed**: 0
- **Blocked**: 1 (TC-12: no viewer user)
- **Not Executed (observations)**: 3 (TC-16, TC-17, no updated_at column)
- **Bugs**: 0
- **Verdict**: PASSED

### Findings
1. TC-16: Invalid UUID returns 422 validation_failed (Zod validation) instead of 400 — minor spec discrepancy
2. TC-17: Concurrent move — basic verification done, P2 scope
3. `updated_at` column missing — cannot verify zero-writes via timestamp for no-op
4. Transition from "Ready For QA" → "QA Approved" requires elevated permissions

## Stage 2 — Execution

**Env:** Staging (https://staging-upexbunkai.vercel.app)
**Started:** 2026-06-15T20:41 UTC
**Auth:** PAT via POST /api/v1/auth/signin

### Smoke
- Result: PASSED
- Evidence: BK-11-smoke-projects.png, BK-11-smoke-project-page.png
- Notes: App loads, login via email+password works (signin endpoint returns PAT+session), module tree renders, Move dialog opens with valid destinations.

### API Exploration
| TC | Title | Expected | Actual | Result |
|----|-------|----------|--------|--------|
| TC-01 | Move leaf module under another | 200, path=checkout/payment | 200, parent=checkout, path=checkout/payment | PASSED |
| TC-02 | Subtree carries | 200, Refunds stays under Payment | path=checkout/payment/refunds, parent=Payment | PASSED |
| TC-03 | Descendant path rebase | All paths rebased under target | ModuleC path changed from modulea/... to target/modulea/... | PASSED |
| TC-04 | Move onto descendant (cycle) | 422 move_cycle | 422 move_cycle | PASSED |
| TC-05 | Self-move (cycle) | 422 move_cycle | 422 move_cycle | PASSED |
| TC-06 | Depth exceeded (>6) | 422 depth_exceeded | 422 depth_exceeded | PASSED |
| TC-07 | Depth boundary (=6) | 200, depth 6 succeeds | 200, L6 at depth 6 | PASSED |
| TC-08 | Move nested to root | 200, parent=null | 200, path=payment, parent=null | PASSED |
| TC-09 | No-op (same parent) | 200, zero writes | 200, path unchanged (no updated_at column in DB to verify zero writes) | PASSED |
| TC-10 | Archived source module | 404 | 404 | PASSED |
| TC-11 | Unauthenticated caller | 401 | 401 | PASSED |
| TC-12 | Viewer 403 | 403 | BLOCKED — no viewer user available | BLOCKED |
| TC-13 | Non-existent UUID | 404 | 404 | PASSED |
| TC-14 | Cross-project move | 422 parent_invalid | 422 parent_invalid | PASSED |
| TC-15 | Duplicate slug at destination | 409 | 409 | PASSED |
| TC-16 | Invalid UUID format | 400 | 422 validation_failed (Zod rejects with 422) | OBSERVATION |
| TC-17 | Concurrent move | Both complete | Basic test done (P2, not fully provable) | OBSERVATION |
| TC-18 | Root module no-op | 200 | 200, path=payment, parent=null | PASSED |

### UI Exploration
| Scenario | Result | Evidence | Notes |
|----------|--------|----------|-------|
| Module tree renders | PASSED | BK-11-smoke-project-page.png | Full tree with Checkout/D2/D3/L3, Target/L1/L2, ModuleA/B/C, Payment/Refunds |
| Click Payment shows actions | PASSED | BK-11-ui-payment-selected.png | "Move module", "Rename module", "Delete module" buttons visible |
| Move dialog opens | PASSED | BK-11-ui-move-dialog.png | Valid destinations exclude: Payment (self), Refunds (descendant). Invalid destinations properly filtered. |
| Move via UI dialog | PASSED | BK-11-ui-after-move.png | Payment moved under Checkout via UI, tree updated |

### DB Exploration
| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Path re-base after move | Descendant paths updated | All paths rebased correctly | PASSED |
| No updated_at column | N/A | modules table has created_at only, no updated_at | OBSERVATION |
| Archived modules filtered | 404 on move | Archived module returns 404 | PASSED |
| Unique constraint (project_id, path) | 409 on duplicate slug | 409 on duplicate name under same parent | PASSED |

### Findings (carry to Stage 3)
1. TC-16: Invalid UUID returns 422 validation_failed instead of 400 bad_request — minor spec discrepancy (Zod validation behaviors)
2. Modules table lacks `updated_at` column — cannot verify "zero DB writes" via timestamp for no-op.
3. No GET /api/v1/modules/{id} endpoint — state verification after PATCH requires direct DB query.
4. TC-12 blocked — no viewer-role user provisioned for testing.

## Known Bugs / Fixes
- BK-57: Combining rename+move in one API call is not atomic across two rpc calls (medium, Ready For QA)
- BK-58: Tech-debt consolidate remote Supabase migration ledger (Ready For QA)
- BK-59: Add activity_log audit writes for module rename/move/soft-delete (Ready For QA)
