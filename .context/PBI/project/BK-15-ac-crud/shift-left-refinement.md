# Shift-Left Refinement: BK-15 — Acceptance Criterion CRUD with position rebalance and ready_to_test gating

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-05-27
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context
- **Primary persona affected**: Elena (QA Engineer) — authors ACs inside a User Story as the atomic testable behaviors that ATCs later anchor to.
- **Secondary personas (if any)**: Mateo (QA Lead) — enforces `ready_to_test` gating to prevent premature "Ready For Dev" transitions; Karim (AI Agent) — consumes AC list via API when building ATC provenance.
- **Business value proposition**: ACs are the **provenance backbone** of Bunkai's structural traceability (business-data-map.md §2: "every ATC links to >=1 AC"). Without AC CRUD, the `atc_acceptance_criteria` M:N join has nothing to link to. `ready_to_test` gating enforces the discipline that a Story is only development-ready when every AC has been declared testable — preventing the "we'll figure out testing later" anti-pattern.
- **KPI(s) influenced**: AC-to-ATC coverage ratio; percentage of Stories blocked at `Estimation` due to `ready_to_test=false` (process-maturity metric); time from Story creation to `Ready For Dev`.
- **User journey position**: Flow 1 (Setup), Step 6 — after US creation, before ATC creation. Fits between BK-14 (User Story CRUD) and the ATC creation flow.

### Technical context
- **Frontend**: Acceptance Criterion cards inside the User Story editor (right panel drawer) — Card component per AC, Input (title), Markdown editor (description), Button (add/sort). `ready_to_test` toggle as a Chip/switch. Reorder via drag or position input. (`business-feature-map.md` §5.1)
- **Backend**: 
  - `POST /api/v1/user-stories/{id}/acceptance-criteria` — create AC under US
  - `GET /api/v1/user-stories/{id}/acceptance-criteria` — list ACs ordered by position
  - `PATCH /api/v1/acceptance-criteria/{id}` — update description/position/ready_to_test
  - `DELETE /api/v1/acceptance-criteria/{id}` — soft-delete + rebalance positions
  - `POST /api/v1/acceptance-criteria/{id}/toggle-ready` — flip ready_to_test
  - DB: `acceptance_criteria` table (`id, user_story_id, description TEXT/Markdown, position INTEGER, ready_to_test BOOLEAN, archived_at TIMESTAMPTZ, created_at, updated_at`)
  - Position rebalance: transaction on insert/delete/reorder — recalculates dense positions (1,2,3,...n) within the scope of a single US
- **External services**: None directly. Indirectly: Jira import worker (BK-17) also creates AC rows via heuristic extraction from imported Stories.
- **Integration points specific to this Story**: 
  - BK-14 (US CRUD) — US soft-delete must cascade `archived_at` to child ACs. This Story's implementation must handle the downstream effect OR rely on BK-039 (soft-delete cascade trigger).
  - BK-10 (ATC create) — `atc_acceptance_criteria` M:N join validates that AC belongs to the same US as the ATC. AC soft-delete must not break this validation for already-existing ATCs (archived ACs still referenced in history).
  - FEAT-012 (`ready_to_test` gating) — the US "Ready For Dev" transition check lives in `PATCH /api/v1/user-stories/{id}` (or wherever status transitions are handled).

### Story complexity
| Axis | Rating | Why |
|------|--------|-----|
| Business logic | Medium | Position rebalance algorithm + `ready_to_test` gating logic across two entities (US transition depends on AC state) |
| Integration | Low | No external services. Internal cross-entity validation only (US existence, position uniqueness, cascade on US delete). |
| Data validation | Medium | Markdown body validation, position integer constraints, `ready_to_test` boolean, US ownership validation, foreign-key integrity on US soft-delete |
| UI | Medium | Inline card editor with drag-reorder, Markdown preview, `ready_to_test` toggle. Position rebalance must reflect instantly in the UI. |

**Estimated test effort**: Medium — 25-30 outlines covering CRUD, position rebalance edge cases, ready_to_test gating transitions, soft-delete cascade, and concurrency.

### Epic-level inheritance (if applicable)
- **Risks restated at Story level**: Soft-delete cascade integrity (BK-039 trigger vs application-layer cascade). Position rebalance race conditions under concurrent edits (two users reordering ACs on the same US simultaneously).
- **Integration points inherited**: BK-14 soft-delete contract (US archive → AC archive). BK-17 Jira import (worker inserts ACs with position — must not collide with manual positions).
- **PO/Dev answers already given at epic level**: FEAT-010 scope = CRUD with sortable position. FEAT-012 scope = ready_to_test guard. Both are in MVP.
- **Test strategy inherited**: Unit tests for position rebalance algorithm (pure function). Integration tests for ready_to_test gating across US+AC endpoints. E2E for the full US → AC → ready_to_test → Ready For Dev flow.

---

## Phase 2 — Story Quality Analysis

### Ambiguities
| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|---|---|---|---|
| 1 | "Position auto-rebalances on insert/delete" | What is the rebalance strategy? **Dense** (1,2,3,4 after every mutation — gap-free) or **sparse** (1000,2000,3000 — gaps allowed, rebalance only on collision)? Dense guarantees predictable ordering but rewrites all sibling positions on every insert/delete. Sparse avoids rewrites but requires periodic compaction. | Determines test data: dense means every insert at position 2 shifts existing 2..n to 3..n+1. Sparse means insert at 1500 between 1000 and 2000 without touching 2000. | Specify: "positions are dense integers 1..n within each US, auto-rebalanced on create/delete/reorder." Recommended: **dense** — simpler mental model, AC count per US is low (<20), performance cost negligible. |
| 2 | "ready_to_test gating: US can't be Ready For Dev" | Where is the gate enforced? Is it checked on `PATCH /api/v1/user-stories/{id}` when transitioning status, or is it a standalone validation that blocks the status transition regardless of the endpoint? | Test targeting differs: if gate is in the US PATCH handler, testing focuses on that handler. If it's a middleware/service-layer check, any status-change path must be tested. | Gate enforced on the US status-transition handler (whatever endpoint moves US from `Estimation` to `Ready For Dev`). Could be `PATCH /api/v1/user-stories/{id}` with `status: "ready_for_dev"` OR a dedicated `POST /api/v1/user-stories/{id}/transition`. Clarify the transition mechanism. |
| 3 | "AC belongs to exactly one User Story" | Can an AC be moved to a different US via `PATCH`? If so, its position must be recalculated in the target US's position space. If not, `user_story_id` is immutable after create. | Moving ACs between US changes test scope — position rebalance in both source and target US. | `user_story_id` is immutable after create. AC is permanently anchored to its US. |
| 4 | `POST /api/v1/acceptance-criteria/{id}/toggle-ready` | What happens when US is already `Ready For Dev` and someone flips an AC's `ready_to_test` from `true` to `false`? Does the US status auto-revert? Who is notified? | Critical: if toggle silently succeeds, US is in `Ready For Dev` with a non-ready AC — the gate has been bypassed retroactively. | Either (a) block the toggle with 409 `US_ALREADY_READY_FOR_DEV` if US status >= ready_for_dev, or (b) allow toggle AND auto-revert US status to `Estimation` with an activity_log entry and Mateo notification. Recommend (b) with notification — otherwise ACs become immutable after US transitions. |
| 5 | `DELETE /api/v1/acceptance-criteria/{id}` | What happens to existing ATCs that reference the deleted AC via `atc_acceptance_criteria`? Does the M:N link get cleaned up? Do ATCs become orphan (lose provenance)? | Structural integrity: if an ATC's last AC is soft-deleted, the ATC technically violates the "ATC must have >=1 AC" rule but the AC still exists (soft-delete). | Soft-delete preserves the FK link. `atc_acceptance_criteria` rows are NOT cleaned up — archived ACs still satisfy provenance. The rule is about existence, not active status. Verified by checking `archived_at IS NULL` on expansion, with `?include_archived=true` opt-in. |

### Gaps (missing info)
| # | Type | Why critical | What to add | Risk if omitted |
|---|---|---|---|---|
| 1 | AC | No explicit AC for `GET /api/v1/acceptance-criteria/{id}` — individual AC fetch. The API design lists nested list under US but no single-AC GET. | Right-panel AC editor needs to fetch a single AC. API consumers (Karim) need direct AC access by id. | Missing endpoint forces clients to fetch full US AC list just to read/edit one AC. |
| 2 | AC | No explicit validation for `description` field: max length, Markdown sanitization, required/optional. | Server must reject oversized descriptions; client needs character count. Markdown XSS vector if not sanitized. | DB truncation or XSS injection via Markdown body. |
| 3 | Business rule | No max AC count per User Story. Can a US have 500 ACs? Position rebalance on 500 rows is a write amplification concern. | Add soft limit (e.g. 50 ACs per US) or document that there is no limit and rebalance handles N rows. | Unbounded growth leads to write-heavy position rebalance on large batches. |
| 4 | Business rule | `ready_to_test` default value on create: `true` or `false`? If `false` by default, every new AC blocks "Ready For Dev" until manually toggled — intentional friction or UX papercut? | Defines the default UX: `false` = explicit opt-in per AC (disciplined), `true` = Stories flow faster but gate loses meaning. | `false` default means Elena must toggle every AC individually before US can move forward — friction if ACs are written after initial creation. |
| 5 | Technical detail | Position rebalance on concurrent writes: two users insert ACs simultaneously on the same US. Without row-level locking on the US, positions can collide or gap. | Race condition produces duplicate positions or gaps that violate the dense-position contract. | Silent position corruption in production under multiple-tab editing. |
| 6 | Technical detail | No `GET /api/v1/user-stories/{id}` endpoint with `?expand=acceptance_criteria` in the designed contract. This endpoint is mentioned in BK-14's shift-left-refinement.md as a gap — if it's handled there, this Story must ensure the expand parameter works. | Test verification for the US+AC relationship depends on this endpoint. | If expand is not implemented, the US detail view in the right panel can't show ACs inline. |

### Edge cases not in Story
| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|---|---|---|---|
| 1 | Insert AC at position 5 when only 3 ACs exist (gap position) | Accept and clamp to `MAX(position) + 1` (positions 1..4, new AC at 4, old 2..3 stay). OR reject 400 `POSITION_OUT_OF_RANGE`. | Medium | Add to AC (NEEDS PO/DEV CONFIRMATION) — clamp vs reject |
| 2 | Insert AC with position <= 0 or non-integer | Reject 400 `INVALID_POSITION` | Medium | Add to AC |
| 3 | PATCH position to same value (no-op) | 200 with unchanged row (idempotent — no position rebalance triggered) | Low | Test only |
| 4 | PATCH position to a value already held by another AC in the same US (after race condition or stale client state) | Shift existing AC at target position +1, then place this AC. Result: dense 1..n. | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 5 | DELETE the last AC of a US that is `Ready For Dev` | US now has zero ACs. FEAT-012 says "US requires >=1 AC." Should this auto-revert US status? The `ready_to_test` gate and the ">=1 AC" gate are separate rules. | High | Add to AC (NEEDS PO/DEV CONFIRMATION) — two separate gates: (a) >=1 AC, (b) all ACs ready_to_test=true |
| 6 | `toggle-ready` on an archived (soft-deleted) AC | Reject 404 or 409 `AC_ARCHIVED`. Toggling readiness on a deleted AC is meaningless. | Medium | Add to AC |
| 7 | US soft-deleted (BK-14) cascades to ACs. Then `toggle-ready` or `PATCH` on an archived AC. | Reject 404 or 409 `AC_ARCHIVED`. Archived ACs are immutable except for hard-delete (admin). | Medium | Test only — depends on BK-039 soft-delete behavior |
| 8 | GET AC list for US with 0 ACs | 200 with `[]` (empty array), not 404. US exists but has no ACs — valid state. | Low | Test only |
| 9 | GET AC list with `?include_archived=true` — archived ACs returned with `archived_at` set, listed after active ACs or mixed by position | Archived ACs should appear in their original position slot (position preserved) so historical context is readable. | Low | Test only |
| 10 | Concurrent `toggle-ready` on the same AC from two sessions | Last write wins on the boolean — no consistency issue since it's a flip. But if both flip from `true`, one ends at `false` and one ends at `true` — the final state depends on order. Acceptable. | Low | Test only |
| 11 | Jira import worker (BK-17) inserts ACs with heuristic positions. User manually created ACs already exist with dense positions 1..n. | Worker should auto-assign positions at the end (MAX+1, MAX+2, ...) to avoid collision with manual positions. | Medium | Add to AC for BK-17 integration contract |
| 12 | Create AC with empty `description` or `description` containing only whitespace | Reject 400 if description is required. Accept if optional (empty description = AC with title only). | Medium | Add to AC (NEEDS PO/DEV CONFIRMATION) — is description required? |
| 13 | Ready_to_test gating when US has NO acceptance criteria at all | Should this also block "Ready For Dev"? FEAT-012 says "US requires >=1 AC." Combined with ready_to_test: US needs >=1 AC AND all ACs must have ready_to_test=true. A Story with 0 ACs fails both checks — gate should return 409 with code `NO_ACCEPTANCE_CRITERIA` | High | Add to AC — two distinct error codes: `AC_NOT_READY` (some ACs have ready_to_test=false) vs `NO_ACCEPTANCE_CRITERIA` (zero ACs) |

### Contradictions
- **API design vs existing contract**: The proposed API nests AC under `/user-stories/{id}/acceptance-criteria` (RESTful sub-resource) but `business-feature-map.md` and `business-api-map.md` declare `POST /acceptance-criteria` as a top-level endpoint. `api-contracts.yaml` v1.0 only documents `POST /acceptance-criteria` standalone. The API design in this Story represents a **deliberate change** to nest AC under US — this must be reconciled. **Recommendation**: use nested design (`/user-stories/{id}/acceptance-criteria`) for create+list (scoped to US), keep PATCH/DELETE/toggle-ready at `/acceptance-criteria/{id}` (resource-level). Update `api-contracts.yaml`.

### Testability validation
**Verdict**: Partial

Issues:
- `ready_to_test` gating endpoint not specified — cannot test the transition blocker without knowing which endpoint triggers it.
- Position rebalance strategy (dense vs sparse) not confirmed — different algorithm, different test assertions.
- Default `ready_to_test` value on create not specified — affects every positive test case.
- `description` validation rules (required, max length, Markdown sanitization) not specified — cannot write negative test cases for invalid descriptions.
- `user_story_id` mutability on PATCH not specified — if mutable, cross-US move tests needed.
- Concurrency behavior on position rebalance not specified — cannot test race conditions without knowing locking strategy.

---

## Phase 3 — Refined Acceptance Criteria

### Original AC1 — AC belongs to exactly one User Story

#### Scenario 1.1: Should create AC linked to an existing User Story (Type: Positive, Priority: High)
- **Given**: User Story US-1 exists in Module `/checkout/cart` with 0 ACs
- **When**: `POST /api/v1/user-stories/US-1/acceptance-criteria` with body `{ "description": "User can apply a valid discount code at checkout", "position": 1 }`
- **Then**: 
  - UI: AC card appears in US editor, position 1, `ready_to_test` = `false` (or configured default)
  - API: 201 `{ id, user_story_id: "US-1", description: "...", position: 1, ready_to_test: false, archived_at: null, created_at, updated_at }`
  - DB: `acceptance_criteria` row with `user_story_id = US-1`, `position = 1`
  - System state: US-1 now has 1 AC

#### Scenario 1.2: Should reject AC creation for non-existent User Story (Type: Negative, Priority: High)
- **Given**: User Story US-999 does not exist
- **When**: `POST /api/v1/user-stories/US-999/acceptance-criteria` with valid body
- **Then**: 404 `USER_STORY_NOT_FOUND`. No DB change.

#### Scenario 1.3: Should reject AC creation with `user_story_id` pointing to a US in a different Project (Type: Negative, Priority: Medium)
- **Given**: User Story US-1 in Project A, User Story US-2 in Project B, authenticated user has access to both
- **When**: `POST /api/v1/user-stories/US-1/acceptance-criteria` (correct) OR somehow crafting a request to link AC to US-2 via US-1's endpoint
- **Then**: If nested route is used, this is not possible (US id is in URL). If standalone create is supported, reject 400 `USER_STORY_NOT_FOUND_IN_PROJECT`.

### Original AC2 — AC has: description (Markdown), position (integer), ready_to_test (boolean)

#### Scenario 2.1: Should create AC with valid Markdown description, integer position, and ready_to_test default (Type: Positive, Priority: High)
- **Given**: US-1 with 0 ACs
- **When**: `POST /api/v1/user-stories/US-1/acceptance-criteria` with `{ "description": "# Heading\n\n- item 1\n- item 2", "position": 2 }`
- **Then**: 201. `description` stored as-is (Markdown preserved). `position` = 2. `ready_to_test` = `false` (default, **NEEDS PO/DEV CONFIRMATION**).

#### Scenario 2.2: Should reject AC creation with `position` = 0 or negative (Type: Negative, Priority: Medium)
- **Given**: US-1 with 2 ACs at positions 1 and 2
- **When**: `POST /api/v1/user-stories/US-1/acceptance-criteria` with `{ "description": "Valid", "position": 0 }` or `"position": -1`
- **Then**: 400 `INVALID_POSITION` with message "Position must be a positive integer". No DB change.

#### Scenario 2.3: Should reject AC creation with `position` as non-integer, float, or string (Type: Negative, Priority: Low)
- **Given**: US-1
- **When**: Post with `"position": 1.5`, `"position": "first"`, or `"position": null`
- **Then**: 400 with validation error. No DB change.

#### Scenario 2.4: Should reject AC creation with `ready_to_test` set to non-boolean (Type: Negative, Priority: Low)
- **Given**: US-1
- **When**: Post with `"ready_to_test": "yes"` or `"ready_to_test": 1`
- **Then**: 400 with validation error. `ready_to_test` only accepts `true`/`false`.

#### Scenario 2.5: Should reject description exceeding maximum length (Type: Boundary, Priority: Medium)
- **Given**: US-1. Max description length is 10KB (inferred from US description = 50KB; AC description likely smaller).
- **When**: Post with description of 10KB + 1 byte
- **Then**: 400 `DESCRIPTION_TOO_LARGE`. No DB change.
- **NEEDS PO/DEV CONFIRMATION**: exact max length for AC description.

### Original AC3 — Position auto-rebalances on insert/delete

#### Scenario 3.1: Should insert AC at position 1 and shift existing ACs (Type: Positive, Priority: High)
- **Given**: US-1 with ACs at positions [1: "Login", 2: "Logout", 3: "Profile"]
- **When**: `POST /api/v1/user-stories/US-1/acceptance-criteria` with `{ "description": "Register", "position": 1 }`
- **Then**: 201. In DB: positions are now [1: "Register", 2: "Login", 3: "Logout", 4: "Profile"]. GET list returns ordered by new positions.

#### Scenario 3.2: Should insert AC without position (append to end) (Type: Positive, Priority: High)
- **Given**: US-1 with ACs at positions 1, 2
- **When**: Post without `position` field (or `position: null`)
- **Then**: 201. AC inserted at position 3. No rebalance needed.
- **NEEDS PO/DEV CONFIRMATION**: is position required or optional on create?

#### Scenario 3.3: Should rebalance positions after soft-delete (Type: Positive, Priority: High)
- **Given**: US-1 with ACs at positions [1: "A", 2: "B", 3: "C"]
- **When**: `DELETE /api/v1/acceptance-criteria/AC-2` (position 2, "B")
- **Then**: 
  - 200. `AC-2.archived_at` set.
  - DB: remaining active ACs rebalanced to positions [1: "A", 2: "C"]. 
  - GET list: returns [AC-1 (pos 1), AC-3 (pos 2)] — AC-2 excluded by default (`archived_at IS NULL` filter).

#### Scenario 3.4: Should rebalance positions after PATCH position change (Type: Positive, Priority: High)
- **Given**: US-1 with ACs at positions [1: "A", 2: "B", 3: "C", 4: "D"]
- **When**: `PATCH /api/v1/acceptance-criteria/AC-4` with `{ "position": 2 }`
- **Then**: 200. Positions rebalanced to [1: "A", 2: "D", 3: "B", 4: "C"]. All other ACs shifted accordingly.

#### Scenario 3.5: Should handle gap position on create (position > max + 1) (Type: Boundary, Priority: Medium)
- **Given**: US-1 with ACs at positions 1, 2
- **When**: Post with `"position": 100`
- **Then**: Either (a) clamp to position 3 (MAX+1) with 201, or (b) reject 400 `POSITION_OUT_OF_RANGE`. **NEEDS PO/DEV CONFIRMATION**.

#### Scenario 3.6: Should handle position rebalance with only 1 AC in the US (Type: Boundary, Priority: Low)
- **Given**: US-1 with AC at position 5 (legacy data or sparse migration)
- **When**: Insert new AC at position 1
- **Then**: Positions become [1: new, 2: existing (was 5)]. Rebalance normalizes to dense.

### Original AC4 — ready_to_test gating: US can't be "Ready For Dev" if any AC has ready_to_test=false

#### Scenario 4.1: Should reject US transition to Ready For Dev when an AC has ready_to_test=false (Type: Positive, Priority: Critical)
- **Given**: US-1 in status `Estimation` with 2 ACs: AC-1 (`ready_to_test=true`), AC-2 (`ready_to_test=false`)
- **When**: `PATCH /api/v1/user-stories/US-1` with `{ "status": "ready_for_dev" }` (or dedicated transition endpoint)
- **Then**: 409 `AC_NOT_READY` with message "All acceptance criteria must have ready_to_test=true before transitioning to Ready For Dev." Body includes AC ids that are not ready: `{ "not_ready_ac_ids": ["AC-2"] }`. US status unchanged.

#### Scenario 4.2: Should allow US transition to Ready For Dev when all ACs have ready_to_test=true (Type: Positive, Priority: Critical)
- **Given**: US-1 in status `Estimation` with 2 ACs: AC-1 (`ready_to_test=true`), AC-2 (`ready_to_test=true`)
- **When**: Transition US to `Ready For Dev`
- **Then**: 200. US status = `ready_for_dev`. Activity log entry recorded.

#### Scenario 4.3: Should reject US transition when US has zero ACs (Type: Negative, Priority: Critical)
- **Given**: US-1 in status `Estimation` with 0 ACs
- **When**: Transition US to `Ready For Dev`
- **Then**: 409 `NO_ACCEPTANCE_CRITERIA` with message "User Story must have at least one acceptance criterion before transitioning to Ready For Dev." US status unchanged.

#### Scenario 4.4: Should allow US transition when all ACs ready but one is soft-deleted (Type: Edge, Priority: High)
- **Given**: US-1 with AC-1 (`ready_to_test=true`), AC-2 (`ready_to_test=false`, `archived_at` set — soft-deleted)
- **When**: Transition US to `Ready For Dev`
- **Then**: 200. Archived ACs excluded from `ready_to_test` check. Only active (`archived_at IS NULL`) ACs are considered for the gate.

#### Scenario 4.5: Should auto-revert US from Ready For Dev when an AC's ready_to_test is toggled to false (Type: Edge, Priority: High)
- **Given**: US-1 in status `Ready For Dev`, both ACs `ready_to_test=true`
- **When**: `POST /api/v1/acceptance-criteria/AC-1/toggle-ready` → flips to `false`
- **Then**: 200. AC-1 `ready_to_test=false`. US status auto-reverts to `Estimation` with `activity_log` entry: `{ action: "us.status_reverted", reason: "ac_not_ready", ac_id: "AC-1" }`. Mateo receives a notification (if notification system exists). **NEEDS PO/DEV CONFIRMATION** — auto-revert behavior.

#### Scenario 4.6: Should block toggle-ready on an AC when US is already in terminal/in-progress status (Type: Boundary, Priority: Medium)
- **Given**: US-1 in status `In Testing` (past `Ready For Dev`)
- **When**: `POST /api/v1/acceptance-criteria/AC-1/toggle-ready` to flip `ready_to_test`
- **Then**: 409 `US_STATUS_IMMUTABLE` — "AC readiness cannot be changed while the User Story is in or past Ready For Dev." OR allow toggle but gate is already passed. **NEEDS PO/DEV CONFIRMATION**.

### Original AC5 — API endpoints for CRUD

#### Scenario 5.1: Should list ACs ordered by position ascending (Type: Positive, Priority: High)
- **Given**: US-1 with 3 ACs at positions [3: "C", 1: "A", 2: "B"] (unsorted in DB insertion order)
- **When**: `GET /api/v1/user-stories/US-1/acceptance-criteria`
- **Then**: 200 with array `[ { id: AC-2, position: 1, description: "A" }, { id: AC-3, position: 2, description: "B" }, { id: AC-1, position: 3, description: "C" } ]`. Ordered by position ASC.

#### Scenario 5.2: Should filter out archived ACs by default, include them with flag (Type: Positive, Priority: Medium)
- **Given**: US-1 with AC-1 (active, pos 1), AC-2 (archived, pos 2), AC-3 (active, pos 3)
- **When**: `GET /api/v1/user-stories/US-1/acceptance-criteria`
- **Then**: 200 with `[AC-1, AC-3]` — archived excluded
- **When**: `GET /api/v1/user-stories/US-1/acceptance-criteria?include_archived=true`
- **Then**: 200 with `[AC-1, AC-2, AC-3]` — all included, positions preserved

#### Scenario 5.3: Should update AC description via PATCH (Type: Positive, Priority: High)
- **Given**: AC-1 with `description: "Old description"`
- **When**: `PATCH /api/v1/acceptance-criteria/AC-1` with `{ "description": "New **Markdown** description" }`
- **Then**: 200 with updated AC. DB: `description` updated. No position change.

#### Scenario 5.4: Should update AC position via PATCH and rebalance (Type: Positive, Priority: High)
- **Given**: US-1 with ACs at positions 1, 2, 3
- **When**: `PATCH /api/v1/acceptance-criteria/AC-3` with `{ "position": 1 }`
- **Then**: 200. DB positions: AC-3=1, AC-1=2, AC-2=3 (shifted).

#### Scenario 5.5: Should toggle ready_to_test from false to true (Type: Positive, Priority: High)
- **Given**: AC-1 with `ready_to_test: false`
- **When**: `POST /api/v1/acceptance-criteria/AC-1/toggle-ready`
- **Then**: 200. `{ ready_to_test: true }`. DB updated.

#### Scenario 5.6: Should toggle ready_to_test from true to false (Type: Positive, Priority: High)
- **Given**: AC-1 with `ready_to_test: true`, US-1 in `Estimation` (not yet Ready For Dev)
- **When**: `POST /api/v1/acceptance-criteria/AC-1/toggle-ready`
- **Then**: 200. `{ ready_to_test: false }`. DB updated.

#### Scenario 5.7: Should soft-delete AC and rebalance positions (Type: Positive, Priority: High)
- **Given**: US-1 with ACs at positions 1, 2, 3
- **When**: `DELETE /api/v1/acceptance-criteria/AC-2`
- **Then**: 200. AC-2 `archived_at` set. Remaining positions: AC-1=1, AC-3=2.

#### Scenario 5.8: Should reject PATCH/GET/DELETE/toggle-ready on non-existent AC (Type: Negative, Priority: High)
- **Given**: AC-999 does not exist
- **When**: `PATCH`, `GET`, `DELETE`, or `POST toggle-ready` on `/api/v1/acceptance-criteria/AC-999`
- **Then**: 404 `ACCEPTANCE_CRITERION_NOT_FOUND`. No DB change.

### New scenarios surfaced from Phase 2 edge cases — NEEDS PO/DEV CONFIRMATION

#### Scenario E1: Should reject AC operations on archived (soft-deleted) ACs (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: Are archived ACs immutable?
- **Given**: AC-1 with `archived_at` set
- **When**: PATCH, toggle-ready, or DELETE on AC-1
- **Then**: 409 `AC_ARCHIVED`. Only `GET` and list with `?include_archived=true` are allowed on archived ACs.

#### Scenario E2: Should handle Jira import inserting ACs alongside manually created ACs (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: Position assignment contract for BK-17 import worker.
- **Given**: US-1 with 2 manual ACs at positions 1, 2. Jira import runs and extracts 2 ACs from the Jira issue.
- **When**: Worker upserts ACs
- **Then**: New ACs appended at positions 3, 4. No collision with manual positions. If an AC was previously imported and now re-extracted (dedup by external_id equivalent), its position is preserved.

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate
| Type | Count | Notes |
|------|-------|-------|
| Positive | 12 | Create, list ordered, update description, update position+rebalance, toggle-ready (both directions), delete+rebalance, gate allows transition, create without position, get single, list with archived flag |
| Negative | 8 | Non-existent US, non-existent AC, archived AC mutations, invalid position values, gate rejects (not-ready ACs), gate rejects (zero ACs), invalid ready_to_test type, max description length |
| Boundary | 6 | Position gap (clamp/reject), 1 AC rebalance, max description length, empty description, toggle-ready on US already Ready For Dev, toggle on archived AC |
| Integration | 5 | US soft-delete cascade, Jira import position collision, ATC M:N join integrity, activity_log on gate/transition, Realtime broadcast on AC changes |
| API | 6 | POST create, GET list, GET single, PATCH update, DELETE soft-delete, POST toggle-ready |
| **Total** | **37** | Includes overlap (API tests validate same scenarios through endpoint layer) |

**Rationale**: Medium complexity — position rebalance is algorithmic (need unit tests on rebalance function), ready_to_test gating spans two entities (US + AC), and soft-delete cascade depends on BK-39/BK-14 contract. 37 outlines cover the CRUD surface plus the cross-entity gating logic.

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive
- **Should create AC with description and position under existing US** — Pre: US exists, 0 ACs. Expected: 201, position=1, ready_to_test default.
- **Should create AC without explicit position (auto-append)** — Pre: US with 2 ACs. Expected: 201, position=3.
- **Should list ACs ordered by position ascending** — Pre: US with ACs at positions 3,1,2. Expected: returns [1,2,3] order.
- **Should get single AC by id** — Pre: AC exists. Expected: 200 with full AC object.
- **Should update AC description via PATCH** — Pre: AC-1 with old description. Expected: 200, description updated, position unchanged.
- **Should update AC position via PATCH with rebalance** — Pre: ACs at 1,2,3. PATCH AC-3 to pos 1. Expected: positions [AC-3=1, AC-1=2, AC-2=3].
- **Should toggle ready_to_test from false to true** — Pre: AC ready_to_test=false. Expected: 200, true.
- **Should toggle ready_to_test from true to false** — Pre: AC ready_to_test=true, US in Estimation. Expected: 200, false.
- **Should soft-delete AC and rebalance remaining positions** — Pre: ACs at 1,2,3. DELETE AC-2. Expected: AC-2 archived, positions [AC-1=1, AC-3=2].
- **Should allow US transition to Ready For Dev when all ACs ready** — Pre: US in Estimation, 2 ACs both ready_to_test=true. Expected: 200, status=ready_for_dev.
- **Should insert AC at position 1 and shift existing ACs** — Pre: ACs at 1,2,3. Insert at pos 1. Expected: positions [new=1, old1=2, old2=3, old3=4].
- **Should list ACs with archived included via flag** — Pre: 2 active + 1 archived AC. `?include_archived=true`. Expected: all 3 returned.

#### Negative
- **Should reject AC creation for non-existent User Story** — Pre: US-999 absent. Expected: 404.
- **Should reject operations on non-existent AC** — Pre: AC-999 absent. Expected: 404 for PATCH/GET/DELETE/toggle.
- **Should reject AC creation with invalid position (negative, zero, non-integer)** — Pre: US exists. Expected: 400 INVALID_POSITION.
- **Should reject description exceeding max length** — Pre: US exists. Expected: 400 DESCRIPTION_TOO_LARGE.
- **Should reject US transition to Ready For Dev when AC has ready_to_test=false** — Pre: US in Estimation, 1 AC not ready. Expected: 409 AC_NOT_READY.
- **Should reject US transition to Ready For Dev when US has zero ACs** — Pre: US in Estimation, 0 ACs. Expected: 409 NO_ACCEPTANCE_CRITERIA.
- **Should reject ready_to_test with non-boolean value on create/PATCH** — Pre: US exists. Expected: 400 validation error.
- **Should reject operations on archived (soft-deleted) AC** — Pre: AC archived_at set. Expected: 409 AC_ARCHIVED for PATCH/DELETE/toggle.

#### Boundary
- **Should handle gap position on create (position > max+1)** — Pre: 2 ACs. Create at pos 100. Expected: clamp to 3 or reject 400. NEEDS PO/DEV CONFIRMATION.
- **Should handle position rebalance with only 1 AC** — Pre: 1 AC at position 5. Insert at pos 1. Expected: positions [new=1, old=2].
- **Should handle empty description (required vs optional)** — Pre: US exists. Expected: reject 400 if required, 201 if optional. NEEDS PO/DEV CONFIRMATION.
- **Should handle description at exact max length** — Pre: US exists. Send exactly max bytes. Expected: 201.
- **Should handle toggle-ready on archived AC** — Pre: AC archived. Expected: 409 AC_ARCHIVED.
- **Should handle toggle-ready when US is already in/past Ready For Dev** — Pre: US in Ready For Dev or In Testing. Expected: 409 or allow. NEEDS PO/DEV CONFIRMATION.

#### Integration
- **Should soft-delete all child ACs when parent US is soft-deleted** — Pre: US-1 with 2 ACs. DELETE US-1 (via BK-14). Expected: both ACs archived_at set.
- **Should prevent ATC creation referencing archived AC** — Pre: AC archived, ATC create with that AC id. Expected: behavior depends on BK-10 validation (allow archived? reject?). Test only.
- **Should log activity on AC CRUD and ready_to_test gating** — Pre: any state-changing AC endpoint. Expected: activity_log row inserted.
- **Should broadcast Realtime event on AC insert/update/delete** — Pre: client subscribed to project channel. Expected: Realtime event received within 3s.
- **Should handle Jira import worker inserting ACs without position collision** — Pre: manual ACs at 1,2. Import extracts 2 ACs. Expected: imported ACs at 3,4.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|-----------|-------------------|-------------|--------|
| 1 | Insert AC at position beyond current max (gap) | No | Medium | Add to AC (PO confirm: clamp vs reject) |
| 2 | Insert AC with position <= 0 or non-integer | No | Medium | Add to AC |
| 3 | PATCH position to value already held by another AC (stale client race) | No | High | Add to AC (PO confirm: shift-conflicting vs reject 409) |
| 4 | DELETE the last AC of a US that is Ready For Dev | No | High | Add to AC (PO confirm: auto-revert US status?) |
| 5 | toggle-ready on archived AC | No | Medium | Add to AC |
| 6 | toggle-ready flips to false while US is Ready For Dev (retroactive gate breach) | No | High | Add to AC (PO confirm: auto-revert US + notify) |
| 7 | US soft-deleted cascades to ACs; subsequent AC mutations blocked | No | Medium | Test only |
| 8 | GET AC list for US with 0 ACs → empty array | No | Low | Test only |
| 9 | GET AC list with archived ACs mixed in via flag | No | Low | Test only |
| 10 | Concurrent position rebalance (two users inserting simultaneously) | No | Medium | Add to AC (Dev confirm: row-level locking on US) |
| 11 | Jira import worker position assignment alongside manual ACs | No | Medium | Cross-Story contract (BK-17) |
| 12 | Create AC with empty/whitespace-only description | No | Medium | Add to AC (PO confirm: required vs optional) |
| 13 | ready_to_test gating when US has zero ACs (distinct error from not-ready ACs) | No | High | Add to AC — separate error code |
| 14 | toggle-ready batch — no batch endpoint exists; user must toggle each AC individually to ready ALL | No | Low | Test only — UX friction |
| 15 | AC description Markdown with XSS payload (script tags, event handlers) | No | Medium | Security: Markdown sanitization must strip dangerous HTML |

---

## Story Quality Assessment

**Verdict**: **Needs Improvement** — the Story has solid structural business rules but 6 ambiguities, 6 gaps, and 15 edge cases that need PO/Dev decisions before implementation.

**Key findings**:
- Position rebalance strategy (dense vs sparse) is the single biggest architectural decision — it determines the write pattern on every insert/delete/reorder.
- `ready_to_test` gating interacts with US status lifecycle in ways the Story doesn't address (toggle-ready on already-Ready-For-Dev US, auto-revert behavior, second gate for ">=1 AC" rule).
- API design nests AC under US (`/user-stories/{id}/acceptance-criteria`) which is a deliberate change from the existing `POST /acceptance-criteria` contract in `api-contracts.yaml` — must be reconciled.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **Position rebalance strategy: dense or sparse?**
   - **Context**: Dense (1,2,3,4) rewrites all sibling positions on every insert/delete/reorder but guarantees predictable, gap-free ordering. Sparse (1000,2000,3000) avoids rewrites but leaves gaps. AC count per US is expected to be low (<20 typically), so dense's write amplification is negligible.
   - **Impact if unanswered**: Cannot implement position rebalance logic. All position-related test scenarios have different expected outcomes.
   - **Suggested answer**: **Dense** — simpler mental model, predictable for UI rendering, low cost given small AC counts per US.

2. **What happens when an AC's `ready_to_test` is toggled to `false` while the US is already `Ready For Dev` or beyond?**
   - **Context**: If toggle is allowed silently, the `ready_to_test` gate is bypassed retroactively — the US is in `Ready For Dev` with a non-ready AC. If toggle is blocked, ACs are effectively frozen once the US advances. If auto-revert, US status rolls back with notification.
   - **Impact if unanswered**: Gate integrity is compromised. Testing cannot verify the gating behavior across the US lifecycle.
   - **Suggested answer**: **Auto-revert US to `Estimation`** with `activity_log` entry and notification to Mateo. This preserves gate integrity while allowing ACs to be corrected. The revert is a signal that the Story needs attention, not a silent corruption.

3. **What is the default `ready_to_test` value when creating an AC?**
   - **Context**: `false` = explicit opt-in per AC (disciplined, gate is meaningful) but creates friction — Elena must toggle every AC manually. `true` = Stories flow faster to `Ready For Dev` but gate loses meaning (everything passes by default).
   - **Impact if unanswered**: All positive test cases need a default assumption. UX flow is undefined.
   - **Suggested answer**: **`false`** — the gate exists to enforce discipline. The friction is intentional: it forces Elena to confirm each AC is genuinely testable before the Story can advance.

---

## Technical Questions for Dev

1. **Where is the `ready_to_test` gating check implemented?** — Is it in the US status-transition handler (`PATCH /api/v1/user-stories/{id}` with status field), a dedicated transition endpoint, or a middleware/service layer? Testing needs to know which endpoint to target.

2. **Is `description` required or optional on AC create?** — If required, what is the minimum length? If optional, what does an AC with no description render in the UI? ACs with only a title and no description seem incomplete for the "testable behavior" role.

3. **Concurrency control on position rebalance** — What locking strategy prevents position collisions when two users insert/reorder ACs on the same US simultaneously? Row-level lock on the US? `SELECT ... FOR UPDATE` on sibling ACs? Serialized transactions?

4. **Soft-delete cascade mechanism** — Does this Story handle cascade of `archived_at` from US to ACs in application code, or is it delegated to BK-039 (soft-delete trigger)? If trigger-based, this Story only needs to set `archived_at` on the AC itself, not its children.

5. **Max AC count per US** — Is there a hard or soft limit? Position rebalance on 500+ ACs in a single US is a write-amplification concern. Suggest soft cap at 50.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | No explicit AC for `GET /api/v1/acceptance-criteria/{id}` | Add single-AC GET endpoint to API design | Completes CRUD surface; needed by right-panel editor and API consumers |
| 2 | `ready_to_test` gating described vaguely ("US can't be Ready For Dev") | Add explicit AC specifying the transition endpoint, error codes (`AC_NOT_READY`, `NO_ACCEPTANCE_CRITERIA`), and response body shape | Removes ambiguity; Dev has clear contract to implement against |
| 3 | No integration AC with BK-14 (US soft-delete cascade) | Add AC: "Soft-deleting a User Story sets archived_at on all child Acceptance Criteria in the same transaction" | Ensures cross-Story contract is explicit |
| 4 | No description validation rules | Add max length (suggest 10KB) and optional/required flag to AC body | Prevents DB truncation and XSS via Markdown |
| 5 | Position rebalance strategy not specified | Add explicit rule: "Positions are dense integers 1..n within each US, auto-rebalanced on create/delete/reorder" | Architects can implement without guesswork |
| 6 | toggle-ready behavior when US is past Ready For Dev not defined | Add rule: "toggle-ready is rejected with 409 when US status >= Ready For Dev" OR "toggle-ready is allowed and auto-reverts US to Estimation" | Gate integrity is explicit in the spec |
| 7 | No `GET /api/v1/user-stories/{id}?expand=acceptance_criteria` endpoint | Add expand parameter to US GET (BK-14 scope) with explicit contract that this Story's AC list endpoint is the canonical source | US detail view can render ACs inline without second request |

---

## Data feasibility flags

- **Entity / fixture missing**: `acceptance_criteria` table does not exist yet — must be created during `/project-bootstrap`. No staging DB available for data discovery.
- **API contract gap**: `api-contracts.yaml` v1.0 only documents `POST /acceptance-criteria` as a standalone endpoint. This Story introduces a nested design — the contract file must be updated.
- **Required pre-work**: BK-14 (User Story CRUD) must be implemented first — ACs require a US to belong to. The `GET /api/v1/user-stories/{id}` endpoint must exist (or this Story's list endpoint is the only read path for ACs).
- **Dependency**: BK-39 (soft-delete cascade) determines whether this Story implements cascade in application code or relies on a database trigger.

---

## Recommended testing strategy

### Pre-implementation
- Finalize position rebalance algorithm with Dev — implement as a pure function (inputs: current positions array, operation type, target position → outputs: new positions map). Unit-test the pure function exhaustively before integrating with DB.
- Agree on `ready_to_test` lifecycle contract (auto-revert vs block vs freeze) so test scenarios match implementation.

### During implementation
- Unit tests on position rebalance function (create at start/middle/end, delete start/middle/end, reorder, edge cases: 1 AC, 0 ACs, gap positions).
- Integration tests on `ready_to_test` gating across US transition and AC toggle endpoints.
- API contract test against the updated OpenAPI spec.

### Post-implementation (in-sprint by /sprint-testing)
- E2E: Full US → AC create → toggle all ready → US transition to Ready For Dev.
- E2E: AC create → toggle-ready false → blocked transition → toggle to true → allowed transition.
- E2E: AC soft-delete → position rebalance verified in UI → remaining ACs ordered correctly.
- Concurrency: Two browser tabs on same US inserting ACs simultaneously — verify no position collisions.
- Cross-Story: BK-14 soft-delete US → verify all ACs archived → ATC provenance still intact for soft-deleted ACs.
- Realtime: Create/update/delete AC in one tab → tree view in another tab reflects change.

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|-----------------------------|
| 1 | Position rebalance race condition under concurrent writes | Medium | High — duplicate positions, corrupted ordering | Integration outline: concurrent position rebalance; unit tests on rebalance function with concurrent simulation |
| 2 | ready_to_test gate bypassed retroactively (toggle after US advances) | Low | High — gate loses all meaning, Stories enter dev with untestable ACs | Boundary outlines: toggle when US >= Ready For Dev; auto-revert or block behavior |
| 3 | Soft-delete cascade inconsistency (US archived but ACs remain active) | Medium | Medium — orphan active ACs without a parent US; data-model integrity broken | Integration outline: US soft-delete cascades to ACs |
| 4 | Jira import worker AC positions collide with manual AC positions | Medium | Medium — position conflicts, need manual fix | Integration outline: import position collision handling |
| 5 | ATC provenance broken when AC is soft-deleted but ATC still references it | Low | Medium — ATCs appear orphan in UI even though AC still exists | Integration outline: ATC M:N join integrity with archived AC |

---

## Next steps

- [ ] PO answers Critical Questions (rebalance strategy, toggle-revert behavior, default ready_to_test) before sprint planning
- [ ] Dev answers Technical Questions (gate location, description required/optional, concurrency strategy, cascade mechanism, max AC count)
- [ ] Update `api-contracts.yaml` with nested AC endpoint design (reconcile with existing standalone `POST /acceptance-criteria`)
- [ ] Implement BK-14 (User Story CRUD) as prerequisite — ACs need a US to belong to
- [ ] Story enters sprint at status `Ready For Dev` once estimated
- [ ] BK-39 (soft-delete cascade) scope clarified — affects whether this Story implements cascade or relies on trigger
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected)
