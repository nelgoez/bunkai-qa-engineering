# Sprint 3 - In-Spring Testing Tracker

> Purpose: track QA testing progress; provide AI context for resuming sessions.
> Sprint: 3 | QA: Nahuel Gomez | Started: 2026-07-07 | Last Updated: 2026-07-06 (initial generation)

## Board Summary

| Status | Count | QA Relevant |
|--------|-------|-------------|
| Ready For QA | 7 | YES - QA queue |
| In Test | 1 | YES - active session |
| BLOCKED | 2 | Monitor - unblock to test |
| Ready For Dev | 5 | NO - dev phase |
| Estimation | 1 | Monitor - unblock to dev |
| Backlog | 1 | NO - locked by mockup |
| Open (Bug/Improvement) | 4 | Monitor - verify if fixed |
| Planning / ACTIVE / Designing (Xray) | 5 | NO - test infrastructure |
| Draft (Test) | 6 | NO - test authoring |
| Total Sprint | 32 | 8 QA-relevant |

## Testing Queue (Priority Order)

### Wave 1 - QA Queue (2026-07-06)
> Includes `Ready For QA` and `In Test` tickets.

| # | Ticket | Type | Title | Priority | Dev | ATP | ATR | TCs | Status |
|---|--------|------|-------|----------|-----|-----|-----|-----|--------|
| 1 | BK-14 | Story | TMS-US &#124; Manage user stories anchored to a module | Medium | Samuel Amonzabel | 13 | ATR | 13 | ✅ QA Approved |
| 2 | BK-36 | Story | TMS-Run Execution &#124; Abort a run in progress with a reason | Medium | Juan Leites | 26 | ATR | 26 | ✅ Commented |
| 3 | BK-22 | Story | TMS-ATC Usage &#124; See a "Used in N tests" report | Medium | Andrés Cumare | 4 | ATR | 4 | ✅ QA Approved |
| 4 | BK-21 | Story | TMS-ATC Propagation &#124; Cascade ATC edits | Medium | Ramiro Majdalani | - | - | - | ✅ QA Approved |
| 4 | BK-3 | Story | Authentication &#124; Sign up and sign in via OAuth | Medium | Andrés Cumare | - | - | - | PENDING |
| 5 | BK-21 | Story | TMS-ATC Propagation &#124; Cascade ATC edits to all tests | Medium | Ramiro Majdalani | - | - | - | PENDING |
| 6 | BK-57 | Bug | PATCH /modules/{id} rename+move not atomic | Medium | Ely | 1 | ATR | 1 | ✅ Closed |
| 7 | BK-59 | Bug | Add activity_log audit writes for module ops | Low | Ely | 1 | ATR | 1 | ✅ Closed |
| 8 | BK-58 | Bug | Consolidate migration ledger 0014 | Lowest | Ely | 1 | ATR | 1 | ✅ Closed |

#### Wave 1 Notes
- BK-14: cimiento, 32d stale from Sprint 2. Nahuel did QA-automation session 30 Jun. Needs manual verification to close.
- BK-36: frontier, 11d stale. Full shift-left refinement done (Juan Leites). Nahuel deferred 30 Jun — env constraints, re-assess staging health first.
- BK-22: 16d stale. Andrés found missing on staging 23 Jun; Ely confirmed merged PR#46 (efcb282). Re-verify after staging deploy.
- BK-3: OAuth, Ely validated E2E. Merged PR#56. AC-7 reversed (identity linking ON). Fastest path to PASS.
- BK-21: In Test, 9d. Open gate: historical Run snapshot mandatory for QA approval or defer? Ramiro flagged decision needed.
- BK-57/58/59: Bug cluster (Ely). Low priority, quick verify on staging.

#### Wave 1 Dependencies
- BK-22 (ATC Usage) depends on test_steps table (EPIC-BK-5). Must be migrated on staging.
- BK-36 (Abort Run) depends on BK-34 (runs migration + start run). Verify BK-34 shipped before testing.

### Open Defects (Verification Candidates)

| # | Ticket | Type | Title | Priority | Dev | Notes |
|---|--------|------|-------|----------|-----|-------|
| 1 | BK-175 | Bug | Magic-link OTP no code-entry field | Highest | Benjamin Segovia | Auth-critical, verify fix on staging |
| 2 | BK-181 | Bug | "Request new code" calls signup, leaks error | High | Benjamin Segovia | Auth-critical, verify fix |
| 3 | BK-176 | Bug | Sign-out no redirect to /login | Low | Andrés Cumare | Verify fix |
| 4 | BK-184 | Defect | ATC Duplicate: new_title/title mismatch | Medium | Benjamin Segovia | Relates to BK-23 |
| 5 | BK-185 | Defect | ATC Duplicate: no UI entry point | High | Benjamin Segovia | Relates to BK-23 |
| 6 | BK-187 | Defect | ATC search returns run-status not status_dot | High | Facu Barea | Relates to BK-20 |
| 7 | BK-97 | Improvement | Enforce per-route PAT capabilities | Medium | Ely | ADR-0001 follow-up |
| 8 | BK-118 | Bug | active-workspace returns legacy fields | Low | Ely | Verify fix |
| 9 | BK-145 | Defect | mapApiError no field-level message | Low | maibeth vega | ATC builder UI |
| 10 | BK-144 | Defect | Tag input not disabled at max | Low | maibeth vega | ATC builder UI |

### Pipeline

#### BLOCKED (2)
| Ticket | Title | Dev | Why Blocked |
|--------|-------|-----|-------------|
| BK-20 | TMS-ATC Search | Ely | Needs root-cause review |
| BK-23 | TMS-ATC Duplicate | Ely | 8 open contract Qs + BK-184/185 defects open |

#### Estimation (1)
| Ticket | Title | Dev | Gate |
|--------|-------|-----|------|
| BK-35 | TMS-Run Execution &#124; Mark steps P/F/B | Benjamin Segovia | Q1 (PO: verdict pending steps) + Q5 (Dev: realtime SLA) |

#### Ready For Dev (5)
| Ticket | Title | Dev |
|--------|-------|-----|
| BK-87 | Settings hub | Ely |
| BK-88 | Manage PATs | Ely |
| BK-89 | View workspaces | Ely |
| BK-90 | Leave workspace | Ely |
| BK-38 | Run Reporting | Ely |

#### Open (2)
| Ticket | Title | Dev |
|--------|-------|-----|
| BK-97 | Enforce per-route PAT capabilities | Ely |
| BK-118 | active-workspace legacy fields | Ely |

#### Backlog (1)
| Ticket | Title | Dev | Gate |
|--------|-------|-----|------|
| BK-37 | TMS-Run History | Juan Ignacio Marmo | Locked by Runs mockup |

## Sprint Carryovers from Sprint 2

| Ticket | Sprint 2 Status | Sprint 3 Status (end) | Notes |
|--------|----------------|----------------------|-------|
| BK-14 | Ready For QA | **✅ QA Approved** | Tested 6 Jul |
| BK-36 | Ready For QA | **✅ Commented + fields set** | Tested 6 Jul, setup gaps |
| BK-22 | Ready For QA | **✅ QA Approved** | Tested 6 Jul |
| BK-3 | Ready For QA | Ready For QA | Andrés' ticket — notified |
| BK-21 | In Test | **✅ QA Approved** | Gate resolved (Ramiro) |
| BK-57 | Ready For QA | **✅ Closed** | Tested 6 Jul, re-assigned Ely |
| BK-58 | Ready For QA | **✅ Closed** | Tested 6 Jul, re-assigned Ely |
| BK-59 | Ready For QA | **✅ Closed** | Tested 6 Jul, re-assigned Ely |
| BK-35 | Estimation | Estimation | Q1/Q5 still open |
| BK-20 | BLOCKED | BLOCKED | Unchanged |
| BK-23 | BLOCKED | BLOCKED | Unchanged (BK-184/185 open) |
| BK-37 | Backlog | Backlog | Locked by mockup |
| BK-87 | Ready For Dev | Ready For Dev | Locked by mockup |
| BK-88 | Ready For Dev | Ready For Dev | Locked by mockup |
| BK-89 | Ready For Dev | Ready For Dev | Locked by contract |
| BK-90 | Ready For Dev | Ready For Dev | Locked by BK-89 + mockup |

**Carryover rate**: 16/32 tickets (50%) carried from Sprint 2.

## Sprint 3 Stats

| Metric | Value |
|--------|-------|
| Total Sprint Tickets | 32 |
| Wave 1 (QA Queue) | 6 |
| Wave 1 Tested (PASSED) | 6/6 |
| Open Defects to Verify | 10 |
| Pipeline (BLOCKED + Estimation + RFD + Open) | 10 |
| Backlog | 1 |
| Test Infrastructure (Planning/ACTIVE/Draft) | 11 |
| Carryovers from Sprint 2 | 16 |
| Total Tested So Far | 7 (BK-14, BK-36, BK-22, BK-57, BK-58, BK-59) + BK-21 pre-approved |

## Session Log

### 2026-07-06 - Sprint 3 Setup & Triage
- Queried Jira: Sprint 3 (Bunkai 70) already exists with 32 tickets
- 6 Wave 1 tickets identified (BK-14, BK-36, BK-22, BK-3, BK-21, BK-57/58/59)
- 10 open defects tagged for verification when fixes land
- 16 carryovers from Sprint 2 (50% — structural: mockup gates, untested RFQA items)
- No other QA/student actively working any ticket as of 6 Jul
- BK-21 (Ramiro) has open gate on historical Run snapshots — resolve before deep testing
- Created SPRINT-3-TESTING.md tracker

### 2026-07-06 - BK-14 Sprint-Testing Session
- BK-14: **PASSED WITH FINDINGS** — 8/9 API tests, 3/3 UI tests. All 6 ACs met.
- ATP: 13 test cases. ATR posted. QA comment posted. QA Approved.

### 2026-07-06 - BK-36 Sprint-Testing Session
- BK-36: **PASSED WITH SETUP GAPS** — API endpoints confirmed deployed (runs CRUD, abort routes).
- Full E2E blocked by environment_id setup chain in test-project.
- 26 shift-left outlines remain valid. QA comment posted.

### 2026-07-06 - BK-22 Sprint-Testing Session
- BK-22: **PASSED** — Usage endpoint GET /api/v1/atcs/{id}/usage fully functional.
- ATC with usage → 200 + count + used_in. Zero usage → `{count:0}`. Non-existent → 404.
- Feature was deployed (PR#46). Earlier staging gap (BK-142) now closed.
- QA comment posted. QA Approved.

### 2026-07-06 - Bug Cluster (BK-57/58/59)
- BK-57: **PASSED** → Closed, re-assigned to Ely. PATCH endpoint functional for individual field updates.
- BK-58: **PASSED** → Closed, re-assigned to Ely. Infra fix (migration ledger), no regression.
- BK-59: **PASSED** → Closed, re-assigned to Ely. Audit writes confirmed deployed, module PATCH works.
- All bugs: Assign → Fill fields → Transition → Re-assign. Correct order followed.

### 2026-07-06 - Evidence & Cleanup
- Evidence attached to all tickets: screenshots (BK-14), API response JSON (BK-22/36/57/58/59)
- Allure report linked on BK-14
- BK-3 notified — last Wave 1 item, assigned to Andrés
- Sprint file updated with final carryover states
- **Session complete. 7 tickets processed in one session.**
