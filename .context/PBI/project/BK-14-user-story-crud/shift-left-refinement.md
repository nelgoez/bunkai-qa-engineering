# Shift-Left Refinement: BK-14 — User Story CRUD anchored to Module (Markdown body, optional Jira external_id)

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-05-27
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context

- **Primary persona affected**: QA Engineer (Elena), QA Lead (Mateo)
- **Secondary personas (if any)**: AI Agent / CLI (Karim — API consumer)
- **Business value proposition**: User Stories are the traceability anchor for every ATC and every AC in Bunkai. Without full CRUD on User Stories, the "Setup flow" adoption funnel (Journey 1) is broken — users cannot populate their workspace with product intent. The `external_id` field is the bridge to Jira sync (FEAT-011 import, FEAT-013 dedup).
- **KPI(s) influenced**: Time-to-first-ATC (Journey 1), data-model traceability health (% ATCs with valid `user_story_id`)
- **User journey position**: Flow 1 (Setup), Step 5 — after Module tree creation, before ATC authoring

### Technical context

- **Frontend**: User Story editor drawer (`business-feature-map.md` §5.1 — Input + Markdown editor + Card list for linked ACs, Button "Import from Jira"). No dedicated page; US editor opens as right-panel drawer inside Project View.
- **Backend**: `app/api/v1/user-stories/route.ts` (BK-007, POST only). This Story adds nested-resource endpoints under `/api/v1/modules/{id}/user-stories` plus standalone PATCH/DELETE on `/api/v1/user-stories/{id}`. DB table: `user_stories` (`id, module_id, title, body, external_id, position, archived_at, created_at, updated_at` per `business-data-map.md` §2).
- **External services**: Jira REST (only for import — BK-009; this Story does NOT touch Jira, it only reserves `external_id`)
- **Integration points specific to this Story**: Jira import worker (BK-009) writes `external_id` on imported US rows — this Story must enforce `external_id` uniqueness per Project on create/update to prevent duplication on re-import. Soft-delete cascade from Module (BK-006 + BK-039).

### Story complexity

| Axis | Rating | Why |
|------|--------|-----|
| Business logic | Medium | Nested resource routing (Module-scoped), field uniqueness constraint spanning Project scope, Markdown sanitization. |
| Integration | Low | No external API calls. Only DB constraints + FK to `modules`. |
| Data validation | Medium | Markdown body up to 50KB, `external_id` uniqueness per Project, `title` 3–200 chars, position non-negative integer, `module_id` FK with cascade-soft-delete. |
| UI | Medium | Markdown editor + preview, Module selector, position reorder UI, soft-delete confirmation drawer. |

**Estimated test effort**: ~16 outlines (6 positive, 5 negative, 3 boundary, 2 integration). Medium complexity — standard refinement depth.

### Epic-level inheritance (if applicable)

- **Risks restated at Story level**: Soft-delete cascade from Module to US (BK-039 — archived US must still show in Run history). `external_id` dedup cross-Project must gate at DB constraint level (application-only guard loses races).
- **Integration points inherited**: Jira import writes `external_id` (BK-009) — this Story's uniqueness guard is the defense against duplicate import runs. Jira bug-sync (BK-028) does NOT touch US.
- **PO/Dev answers already given at epic level**: FEAT-009 in `business-feature-map.md` documents US CRUD as MVP scope. `business-data-map.md` §2 confirms `external_id` format `[A-Z]+-\d+`.
- **Test strategy inherited**: Master test plan §2.5 (Setup flow) + §8 checklist #14 (soft-delete cascade validation).

---

## Phase 2 — Story Quality Analysis

### Ambiguities

| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|-------------------|---------------------|-------------------|------------------------|
| 1 | AC "body in Markdown" | Which Markdown flavor? CommonMark, GFM, or custom subset? Does it support tables, task lists, images? | Cannot design Markdown sanitization tests without knowing the parser boundaries | Specify: GFM (GitHub Flavored Markdown) with image-render disabled OR CommonMark strict subset without HTML passthrough |
| 2 | AC "Markdown body sanitization before render" | What is sanitized — HTML tags only, or also script injection, data URIs, event handlers? Is sanitization server-side (on save) or client-side (on render)? | Security boundary unclear — RCE risk if sanitization is client-only | Server-side sanitization mandatory (DOMPurify-equivalent). Strip `<script>`, `on*` handlers, `javascript:` URIs, `data:` URIs. Apply on `POST`/`PATCH` save, not on render. |
| 3 | AC "optional external_id for Jira sync" | Can `external_id` be set to `null` after being set? Can it be changed to a different value (re-link to another Jira issue)? | Mutation semantics unclear — immutable-after-set vs editable is a different test matrix | Once set, `external_id` is immutable (only Jira import worker writes it). Manual edit allowed only by admin role. OR: fully editable by `member`+ — specify which |
| 4 | AC "position field for ordering" | What is the default position for new US? Auto-increment at end of Module's US list, or explicit required? Gap-handling on reorder — batch-rebalance or single-move? | Reorder UI behavior undefined — dragging US-3 to position 1 must shift others | New US defaults to `MAX(position) + 1` in Module. Reorder via `PATCH` updates single US position; client re-fetches list and re-renders. No batch-rebalance endpoint in MVP. |
| 5 | API contract "PATCH /api/v1/user-stories/{id}" | Can the Module of an existing US be changed (move US to another Module)? | Cross-Module move introduces AC-linking validation (ACs belong to US, US moves to different Module — ACs stay linked). Does the system reject or allow? | Allow Module reassignment. ACs remain linked to the US — they are US-scoped, not Module-scoped. Module only gates US grouping in tree view. |
| 6 | API contract "DELETE /api/v1/user-stories/{id}" | Does soft-delete cascade to child ACs and ATCs? `business-data-map.md` says "Soft-delete cascade: UPDATE `archived_at` on descendant Modules, US, AC, ATC, Tests." Confirm this Story implements cascade or relies on BK-039 trigger. | Test scope differs — cascade here means this Story's handler must set `archived_at` on linked ACs and ATCs, OR trigger-based cascade handles it. | Soft-delete US sets `archived_at` on: `user_stories`, `acceptance_criteria` (FK `user_story_id`), `atcs` (FK `user_story_id`), `test_steps` where ATC is archived. Single transaction. |

### Gaps (missing info)

| # | Type | Why critical | What to add | Risk if omitted |
|---|------|--------------|-------------|-----------------|
| 1 | AC | No error path defined for `external_id` uniqueness violation on create | Duplicate Jira import runs create duplicate US rows — BK-009 dedup relies on this field | Add error response: 409 `EXTERNAL_ID_CONFLICT` with `{ field: "external_id", existing_us_id: "<id>" }` |
| 2 | AC | No error path for `module_id` referencing non-existent or archived Module | Orphan US with dangling FK breaks tree view and defect heatmap rollup | Add validation: 404 `MODULE_NOT_FOUND` or 400 `MODULE_ARCHIVED` if Module is soft-deleted |
| 3 | Technical detail | No `GET /api/v1/user-stories/{id}` endpoint in designed contract — only Module-scoped list | Individual US fetch is needed for right-panel detail view, deep-link, and API consumer (Karim) discovery | Add `GET /api/v1/user-stories/{id}?expand=acceptance_criteria` to the contract |
| 4 | Business rule | `body` max 50KB documented in `business-feature-map.md` §2.3 but not in original ACs | Missing from ACs means validation test scope undefined | Add explicit AC: "POST/PATCH rejects `body` > 51,200 bytes with 400 `BODY_TOO_LARGE`" |
| 5 | Business rule | No explicit AC for `position` uniqueness within a Module | Two US at same position breaks tree-view ordering and reorder UX | Add validation: positions within same `module_id` must be unique. Server-side rebalance on conflict (409 on create with duplicate position) |
| 6 | AC | No "List" endpoint design for Module-less listing (cross-Module search) | `business-feature-map.md` CRUD matrix says US has ✅ List/Search, but designed API only has Module-scoped list | Confirm: Module-scoped list is sufficient for MVP tree view. Cross-Module search deferred to command palette (BK-031). OR add `GET /api/v1/user-stories?project_id=` as flat list. |

### Edge cases not in Story

| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|----------|-------------------------------|-------------|--------|
| 1 | Create US with `external_id` that matches a soft-deleted US in the same Project | Reject (409) — soft-deleted US still occupies the `external_id` namespace because re-import must be idempotent. OR allow — treat soft-deleted as namespace-released. | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 2 | Create US with `body` containing only whitespace or empty string | Accept as valid (body is optional per the designed API contract). Store empty string or NULL? | Medium | Test only — confirm NULL vs `""` semantics match API contract |
| 3 | PATCH `position` to a value already held by another US in the same Module | Reject 409 `POSITION_CONFLICT` with conflicting US id. OR auto-rebalance (shift conflicting US +1). | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 4 | PATCH `external_id` to a value that belongs to a different Project's US | Allow — uniqueness is per-Project, not global. | Low | Test only — confirm `external_id` constraint is scoped to `project_id` |
| 5 | Create US with `title` at exact 200-char boundary, including Unicode multibyte characters | Accepted if byte-safe; rejected if length validation counts bytes instead of characters | Low | Test only — validation should count characters (grapheme clusters), not bytes |
| 6 | GET list with `?include_archived=true` returns soft-deleted US | Archived US appear in list when flag is set; default list excludes them per BK-039 convention | Medium | Add to AC — consistent with Module list behavior |
| 7 | Concurrent PATCH on same US position by two users in same Module | Last-write-wins. Both PATCHes succeed (200 each), final position is the later request's value. No optimistic lock in MVP. | Medium | Test only — document as known behavior |
| 8 | Create US with `body` containing Markdown that exceeds 50KB AFTER sanitization (sanitizer adds escaping) | Validated on raw input length, not post-sanitization length. Reject at 50KB+1 raw bytes. | Low | Test only — confirm validation gates on input size, not output size |

### Contradictions

No contradictions found between description, ACs, and existing business context docs. The `business-feature-map.md` CRUD matrix shows full CRUD for `user_story` while `business-api-map.md` §4.5 documents only POST — this is a known Gap (#3 in both docs) that this Story closes.

### Testability validation

**Verdict**: Yes

All ACs are testable against REST endpoints with specific status codes and response shapes. Markdown sanitization can be verified by POSTing known-dangerous payloads and reading back the sanitized body. Soft-delete and position ordering are directly observable via GET responses. No blocking testability issues — the only prerequisite is a valid Module ID (will be created as test data).

---

## Phase 3 — Refined Acceptance Criteria

### Original AC1 — US belongs to exactly one Module

#### Scenario 1.1: Should create US with valid module_id (Type: Positive, Priority: Critical)
- **Given**: Module `/cart/add-to-cart` exists in Project, no prior US in that Module
- **When**: `POST /api/v1/modules/{module_id}/user-stories` with `{ title: "Validate discount code application", body: "## Summary\n\nUser enters discount code at checkout.", external_id: null, position: 1 }`
- **Then**:
  - API: 201 `{ success: true, data: { id, module_id, title, body, external_id: null, position: 1, archived_at: null, created_at, updated_at } }`
  - DB: `user_stories` row inserted with correct `module_id` FK
  - System state: `activity_log` row appended (`action: "user_story.created"`)
  - UI: US appears in Module's tree node under Project View

#### Scenario 1.2: Should reject US with non-existent module_id (Type: Negative, Priority: High)
- **Given**: No Module with ID `00000000-0000-0000-0000-000000000000`
- **When**: `POST /api/v1/modules/00000000-0000-0000-0000-000000000000/user-stories` with valid payload
- **Then**: 404 `{ success: false, error: { code: "MODULE_NOT_FOUND", message: "Module not found" } }`

#### Scenario 1.3: Should reject US with archived module_id (Type: Negative, Priority: High)
- **Given**: Module `/cart/legacy` exists but `archived_at` is set
- **When**: `POST /api/v1/modules/{archived_module_id}/user-stories` with valid payload
- **Then**: 400 `{ success: false, error: { code: "MODULE_ARCHIVED", message: "Cannot create User Story in an archived Module" } }`

### Original AC2 — body in Markdown

#### Scenario 2.1: Should store and retrieve Markdown body unchanged (Type: Positive, Priority: Critical)
- **Given**: US exists in Module
- **When**: `POST /api/v1/modules/{module_id}/user-stories` with `body: "# Heading\n\n- item 1\n- item 2\n\n**bold** and `code`"`
- **Then**:
  - API: 201 with `body` containing the exact Markdown string
  - `GET /api/v1/user-stories/{id}`: returns same Markdown
  - UI: Markdown rendered correctly (headings, lists, bold, inline code)

#### Scenario 2.2: Should accept US with no body (body is optional) (Type: Positive, Priority: Medium)
- **Given**: Module exists
- **When**: `POST /api/v1/modules/{module_id}/user-stories` with `{ title: "Minimal US", body: null }`
- **Then**: 201 with `body: null`
- `GET /api/v1/user-stories/{id}` returns `body: null`

#### Scenario 2.3: Should reject body exceeding 50KB (Type: Boundary, Priority: High)
- **Given**: Module exists
- **When**: `POST` with `body` string of 51,201 bytes
- **Then**: 400 `{ success: false, error: { code: "BODY_TOO_LARGE", message: "Body must not exceed 51200 bytes", details: [{ field: "body", message: "Maximum 51200 bytes" }] } }`

#### Scenario 2.4: Should accept body exactly at 50KB boundary (Type: Boundary, Priority: Medium)
- **Given**: Module exists
- **When**: `POST` with `body` string of exactly 51,200 bytes
- **Then**: 201, body stored and retrievable verbatim

### Original AC3 — Markdown body sanitization before render

#### Scenario 3.1: Should strip script tags from body on save (Type: Negative, Priority: Critical)
- **Given**: Module exists
- **When**: `POST /api/v1/modules/{module_id}/user-stories` with `body: "## Title\n\n<script>alert('xss')</script>\n\nNormal text"`
- **Then**: 201, `GET` returns body with `<script>` tag stripped: `"## Title\n\n\n\nNormal text"`. Rendered HTML contains no executable script.

#### Scenario 3.2: Should strip onclick and other event handlers (Type: Negative, Priority: Critical)
- **Given**: Module exists
- **When**: `POST` with `body: "<div onclick='alert(1)'>Click me</div>"`
- **Then**: 201, body stored with `onclick` attribute removed: `"<div>Click me</div>"` (or div fully stripped if no-html policy)

#### Scenario 3.3: Should strip javascript: and data: URIs (Type: Negative, Priority: High)
- **Given**: Module exists
- **When**: `POST` with `body: "[click here](javascript:alert(1))"`
- **Then**: 201, link href sanitized to empty or `#`. Rendered link is non-functional.

### Original AC4 — optional external_id for Jira sync

#### Scenario 4.1: Should create US with valid external_id (Type: Positive, Priority: High)
- **Given**: Module exists, no other US in Project has `external_id = "UPEX-1000"`
- **When**: `POST` with `external_id: "UPEX-1000"`
- **Then**: 201, `external_id` stored as `"UPEX-1000"`

#### Scenario 4.2: Should reject duplicate external_id within same Project (Type: Negative, Priority: Critical)
- **Given**: US-A exists in Module-A with `external_id = "UPEX-999"`
- **When**: `POST` to Module-B with `external_id: "UPEX-999"` (same Project, different Module)
- **Then**: 409 `{ success: false, error: { code: "EXTERNAL_ID_CONFLICT", message: "external_id already exists in this Project", details: [{ field: "external_id", existing_us_id: "<US-A-id>" }] } }`

#### Scenario 4.3: Should accept external_id already used in a different Project (Type: Positive, Priority: Medium)
- **Given**: US in Project-A has `external_id = "UPEX-888"`. Project-B has no US with that external_id.
- **When**: `POST` to Module in Project-B with `external_id: "UPEX-888"`
- **Then**: 201 — uniqueness is scoped to Project, not global. Confirm `business-api-map.md` context: external_id dedup is per Project.

#### Scenario 4.4: Should reject invalid external_id format (Type: Negative, Priority: Medium)
- **Given**: Module exists
- **When**: `POST` with `external_id: "invalid_format"`
- **Then**: 400 `{ success: false, error: { code: "VALIDATION_ERROR", details: [{ field: "external_id", message: "Must match pattern [A-Z]+-\\d+" }] } }`

### Original AC5 — soft-delete support

#### Scenario 5.1: Should soft-delete US and cascade to child ACs and ATCs (Type: Positive, Priority: Critical)
- **Given**: US with 2 linked ACs, 1 ATC referencing the US
- **When**: `DELETE /api/v1/user-stories/{id}`
- **Then**:
  - API: 200 `{ success: true, data: { id, archived_at: "<timestamp>" } }`
  - DB: `user_stories.archived_at` set, `acceptance_criteria.archived_at` set for both ACs, `atcs.archived_at` set for the ATC, `test_steps` where ATC is referenced updated (ATC removed from active chain)
  - `activity_log`: `user_story.archived` entry
  - `GET /api/v1/modules/{module_id}/user-stories` no longer includes this US (default filter `archived_at IS NULL`)

#### Scenario 5.2: Should include archived US when ?include_archived=true (Type: Positive, Priority: Medium)
- **Given**: Module has 1 active US and 1 archived US
- **When**: `GET /api/v1/modules/{module_id}/user-stories?include_archived=true`
- **Then**: 200 with both US in list, archived US has non-null `archived_at`

#### Scenario 5.3: Should reject DELETE on already-archived US (Type: Negative, Priority: Medium)
- **Given**: US already soft-deleted (`archived_at` is set)
- **When**: `DELETE /api/v1/user-stories/{id}`
- **Then**: 409 `{ success: false, error: { code: "ALREADY_ARCHIVED", message: "User Story is already archived" } }` OR 200 (idempotent — confirm with PO). **NEEDS PO/DEV CONFIRMATION**

### Original AC6 — position field for ordering

#### Scenario 6.1: Should create US with explicit position (Type: Positive, Priority: High)
- **Given**: Module exists, no prior US
- **When**: `POST` with `position: 1`
- **Then**: 201, US stored with `position: 1`

#### Scenario 6.2: Should auto-assign position when omitted (Type: Positive, Priority: High)
- **Given**: Module has 3 US at positions 1, 2, 3
- **When**: `POST` without `position` field
- **Then**: 201, US assigned `position: 4` (MAX + 1)

#### Scenario 6.3: Should reorder US via PATCH (Type: Positive, Priority: High)
- **Given**: Module has US-A (pos 1), US-B (pos 2)
- **When**: `PATCH /api/v1/user-stories/{US-A-id}` with `{ position: 2 }` and `PATCH /api/v1/user-stories/{US-B-id}` with `{ position: 1 }` (sequential)
- **Then**: Both succeed (200 each). Final order after both patches: US-B pos 1, US-A pos 2. No auto-rebalance — client handles full reorder.

#### Scenario 6.4: Should reject negative position (Type: Negative, Priority: Medium)
- **Given**: US exists
- **When**: `PATCH` with `position: -1` or `POST` with `position: -1`
- **Then**: 400 `{ success: false, error: { code: "VALIDATION_ERROR", details: [{ field: "position", message: "Position must be >= 0" }] } }`

### New scenarios surfaced from Phase 2 edge cases — NEEDS PO/DEV CONFIRMATION

#### Scenario E1: Should reject external_id that matches a soft-deleted US in same Project (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: behavior inferred — soft-deleted US may or may not release the `external_id` namespace
- **Given**: Project has archived US with `external_id = "UPEX-777"`
- **When**: `POST` new US with same `external_id`
- **Then**: Option A: 409 `EXTERNAL_ID_CONFLICT` (archived US still occupies namespace). Option B: 201 (namespace released on soft-delete). Confirm with PO.

#### Scenario E2: Should handle PATCH position conflict (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: position conflict resolution — reject vs auto-rebalance
- **Given**: Module has US-A (pos 1), US-B (pos 2)
- **When**: `PATCH /api/v1/user-stories/{US-A-id}` with `{ position: 2 }` (US-B already at position 2)
- **Then**: Option A: 409 `POSITION_CONFLICT` with conflicting US id. Option B: succeed, US-B auto-shifted to position 3. Confirm with PO.

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate

| Type | Count | Notes |
|------|-------|-------|
| Positive | 7 | Create with valid data, GET list, GET single, PATCH title/body/position, DELETE cascade, include_archived filter, auto-position |
| Negative | 6 | Invalid module (not found/archived), body too large, external_id conflict, invalid external_id format, negative position, invalid title length |
| Boundary | 3 | Body exactly 50KB, title exactly 200 chars, title exactly 3 chars |
| Integration | 2 | Soft-delete cascade to ACs/ATCs, external_id uniqueness check spans Project scope |
| API | 5 | POST, GET list, GET single, PATCH, DELETE (one per endpoint) |
| **Total** | **23** | (drives PO estimation) |

**Rationale**: Five endpoints × ~4 scenarios each plus cross-cutting cascade and uniqueness checks. Medium complexity — each endpoint has standard CRUD validation (400/404/409) plus US-specific Markdown sanitization and position ordering. Integration outlines cover the soft-delete cascade (US → AC → ATC → test_steps) and cross-Project `external_id` scope.

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive

- **Should create US with full payload** — Pre: valid Module exists. Expected: 201 with all fields populated, `activity_log` row appended.
- **Should create US with minimal payload (title only)** — Pre: valid Module exists. Expected: 201, body=null, external_id=null, position auto-assigned.
- **Should list US for a Module** — Pre: Module has 3 active US at known positions. Expected: 200 with array ordered by `position ASC`; each item has id, title, position.
- **Should list US for a Module with cursor pagination** — Pre: Module has 25 US. Expected: 200 with `?limit=10` returns 10 items + `next_cursor`.
- **Should get single US by id** — Pre: US exists. Expected: 200 with full US object; optional `?expand=acceptance_criteria` returns nested AC array.
- **Should update US title and body via PATCH** — Pre: US exists with original content. Expected: 200 with updated fields, `updated_at` changed, `activity_log` row.
- **Should update US position via PATCH** — Pre: US at position 1. Expected: 200 with `position: 5`, GET list reflects new order.
- **Should soft-delete US and return updated entity** — Pre: US with linked ACs and ATC. Expected: 200, `archived_at` set on US + ACs + ATCs, excluded from default GET list.

#### Negative

- **Should reject create with non-existent module_id** — Pre: invalid UUID. Expected: 404 `MODULE_NOT_FOUND`.
- **Should reject create with archived module_id** — Pre: Module archived. Expected: 400 `MODULE_ARCHIVED`.
- **Should reject create with body exceeding 50KB** — Pre: valid Module. Expected: 400 `BODY_TOO_LARGE`.
- **Should reject create with duplicate external_id in same Project** — Pre: other US has same external_id. Expected: 409 `EXTERNAL_ID_CONFLICT`.
- **Should reject create with invalid external_id format** — Pre: valid Module. Expected: 400 `VALIDATION_ERROR` with pattern message.
- **Should reject create with title shorter than 3 characters** — Pre: valid Module. Expected: 400 `VALIDATION_ERROR` on title field.

#### Boundary

- **Should accept body at exactly 50KB boundary** — Pre: body string = 51,200 bytes. Expected: 201, stored verbatim.
- **Should accept title at exactly 200 characters** — Pre: title = 200 chars. Expected: 201.
- **Should accept title at exactly 3 characters** — Pre: title = "ABC". Expected: 201.

#### Integration

- **Should cascade soft-delete to linked Acceptance Criteria and ATCs** — Pre: US has 2 ACs and 1 ATC. Expected: DELETE sets `archived_at` on US, both ACs, and the ATC in a single transaction.
- **Should enforce external_id uniqueness across all Modules in a Project** — Pre: Project has 2 Modules. Expected: create in Module-B with external_id from Module-A's US → 409.

> **NOT included here** (deferred to in-sprint planning by `/sprint-testing` Stage 1): parametrization tables, per-outline test-data JSON, numbered test steps, Faker generation strategies. Coverage estimate IS included because PO uses it for estimation.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|-----------|-------------------|-------------|--------|
| 1 | external_id matches a soft-deleted US in same Project | No | High | Add to AC (PO confirm: namespace released or retained?) |
| 2 | PATCH position to value already held by another US in same Module | No | High | Add to AC (PO confirm: reject 409 or auto-rebalance?) |
| 3 | Create US with body containing only whitespace | No | Medium | Test only — confirm NULL vs `""` storage |
| 4 | PATCH external_id to value used in different Project | No | Low | Test only — confirm cross-Project allowed |
| 5 | Create US with 200-char title including Unicode multibyte characters | No | Low | Test only — char count vs byte count |
| 6 | GET list with `?include_archived=true` | No | Medium | Add to AC — consistent with Module behavior |
| 7 | Concurrent PATCH on same US position | No | Medium | Test only — last-write-wins |
| 8 | Create US with body that exceeds 50KB AFTER Markdown sanitization | No | Low | Test only — validation gates on input size |
| 9 | Create US in a Module that is subsequently archived — can US still be read? | No | Medium | Test only — US readable but Module parent shows archived status |
| 10 | GET single US with `?expand=acceptance_criteria` when all ACs are archived | No | Low | Test only — archived ACs excluded by default, included with flag |

> Test-data generation strategy + Faker recipes are NOT defined here. They land in `/sprint-testing` Stage 1 when the feature exists.

---

## Story Quality Assessment

**Verdict**: Needs Improvement

**Key findings**:
- Story has solid structural rules (Module anchoring, soft-delete, external_id uniqueness) but misses error-path ACs (MODULE_NOT_FOUND, EXTERNAL_ID_CONFLICT, BODY_TOO_LARGE, ALREADY_ARCHIVED)
- Markdown sanitization scope is undefined — no specification of which elements are stripped, whether sanitization is server-side or client-side
- `external_id` mutability semantics unclear — can it be changed after creation? Can it be set to null?
- Missing `GET /api/v1/user-stories/{id}` endpoint in designed contract — individual US fetch needed for right-panel detail view
- Position conflict resolution undefined — reject vs auto-rebalance on PATCH

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **What is the `external_id` mutability rule?**
   - **Context**: `external_id` is set by Jira import worker (BK-009). Can a user manually edit or clear it? Re-link to a different Jira key?
   - **Impact if unanswered**: Wrong mutation semantics baked into PATCH validation — either over-restrictive (users can't fix typos) or over-permissive (Jira sync integrity broken).
   - **Suggested answer**: Once set (by import or manual create), `external_id` is editable by `member`+ role. The Jira import worker treats it as idempotent (write-once, read thereafter). Manual edit does NOT trigger Jira back-sync.

2. **Does a soft-deleted US release its `external_id` namespace?**
   - **Context**: If US with `external_id = "UPEX-777"` is archived, can a new US claim that same external_id? Re-import from Jira would be idempotent if namespace is retained.
   - **Impact if unanswered**: Duplicate US rows on re-import (BK-009), broken Jira traceability.
   - **Suggested answer**: Soft-deleted US retains the namespace. Re-import finds the archived US and un-archives it rather than creating a duplicate. New US with same external_id → 409.

3. **Position conflict on PATCH — reject or auto-rebalance?**
   - **Context**: If US-A at pos 1 is PATCHed to pos 2, and US-B already at pos 2 — does the server reject, or shift US-B to pos 3 automatically?
   - **Impact if unanswered**: Different UX for the reorder feature (drag-reorder in Project View). Auto-rebalance is complex in MVP; reject is simpler but shifts burden to client.
   - **Suggested answer**: Reject 409 `POSITION_CONFLICT`. Client is responsible for submitting a full reorder (multiple PATCH calls) — this aligns with the "no batch-rebalance endpoint in MVP" principle.

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **Which Markdown sanitization library?** — Server-side sanitization is mandatory (see ambiguity #2). Recommend `rehype-sanitize` + `unified` for server-side, or `DOMPurify` equivalent. Must strip: `<script>`, `on*` handlers, `javascript:` URIs, `data:` URIs, `<iframe>`, `<object>`, `<embed>`. Implementation location: service layer on `POST`/`PATCH` save, NOT on render.

2. **Single transaction for soft-delete cascade?** — Deleting a US must set `archived_at` on US + linked ACs + linked ATCs + affected `test_steps`. If any FK constraint fails (e.g. a Run is currently running on an ATC), should the entire DELETE roll back or succeed partially? Recommend: full transaction with rollback on any failure, 409 with specific error.

3. **Position auto-assignment concurrency?** — `MAX(position) + 1` for new US has a race condition under concurrent POSTs. Recommend: `INSERT ... RETURNING` with `position = COALESCE(NEW.position, (SELECT COALESCE(MAX(position), 0) + 1 FROM user_stories WHERE module_id = NEW.module_id))` in a serializable transaction OR use a sequence-like approach.

4. **`external_id` uniqueness index scope** — Needs a partial unique index: `CREATE UNIQUE INDEX idx_us_external_id ON user_stories (project_id, external_id) WHERE external_id IS NOT NULL AND archived_at IS NULL;` (if namespace released on archive) OR without `archived_at IS NULL` (if namespace retained). Confirm index strategy after PO answers Critical Question #1 and #2.

5. **`PATCH /api/v1/user-stories/{id}` — Module reassignment allowed?** — If yes, the handler must validate the new `module_id` exists, is not archived, and belongs to the same Project as the US (cross-Project move prohibited). ACs remain linked to US regardless of Module.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | No explicit AC for `GET /api/v1/user-stories/{id}` | Add AC: "GET single US by id with optional ?expand=acceptance_criteria" | Completes CRUD surface; needed for right-panel detail view and API consumer discovery |
| 2 | AC "body in Markdown" undefined flavor | Specify: "GitHub Flavored Markdown without HTML passthrough; images rendered as alt-text only" | Removes ambiguity for sanitization boundaries |
| 3 | AC "optional external_id" undefined edit semantics | Specify: "external_id editable by member+; set to null only by admin" | Prevents silent Jira desync |
| 4 | No error-path ACs | Add explicit ACs for all 4xx responses listed in Phase 3 scenarios | Improves testability — QA can assert exact error codes, Dev knows which validators to write |
| 5 | Position AC doesn't cover conflict | Add: "PATCH position to occupied value returns 409 POSITION_CONFLICT" | Defines reorder UX contract |

---

## Data feasibility flags

No data feasibility risks identified.

US entity (`user_stories`) is well-defined in `business-data-map.md` §2 with all required columns documented. Module parent entity exists in ERD. FK relationships are standard. No missing tables or API contracts block this Story's implementation — this Story itself closes Gap #3 (`business-api-map.md` §10) by adding the missing R/U/D/List endpoints for User Stories.

Test data prerequisites for in-sprint testing: one valid Module (not archived) per test case. Module creation is covered by BK-006 — create via `POST /api/v1/modules` as test-data setup.

---

## Recommended testing strategy

### Pre-implementation
- Review Markdown sanitization library choice with Dev — confirm it covers the threat model (script tags, event handlers, URIs)
- Confirm `external_id` uniqueness constraint design (index scope, soft-delete namespace policy) with PO + Dev
- Agree on `position` conflict behavior (reject vs auto-rebalance) to avoid rework

### During implementation
- Validate Zod schemas against all negative scenarios before endpoint coding begins
- Write the unique index for `external_id` (per Project scope) and test with concurrent inserts
- Verify soft-delete cascade transaction rollback behavior with FK violations

### Post-implementation (in-sprint by /sprint-testing)
- Execute all 23 Phase 4 outlines against staging
- Markdown sanitization: POST known XSS payloads (`<script>`, `<img onerror>`, `javascript:` links) and verify sanitized output
- `external_id` uniqueness: create US in Module-A, attempt duplicate in Module-B (same Project), verify 409
- Soft-delete cascade: verify `archived_at` propagates to ACs + ATCs + test_steps; verify archived US excluded from default GET list
- Position ordering: verify auto-assignment on create, reorder via PATCH, verify GET list order matches positions
- Role-gated access: verify `viewer` cannot POST/PATCH/DELETE; verify `member` can perform all CRUD

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|-----------------------------|
| 1 | Markdown sanitization too permissive (XSS vector) | Medium | High | Phase 3 scenarios 3.1–3.3, Phase 4 negative outlines |
| 2 | `external_id` uniqueness race condition (concurrent POST with same external_id) | Medium | High | DB-level unique index, not application-level check |
| 3 | Soft-delete cascade leaves orphan `test_steps` (ATC removed from chain mid-Run) | Low | High | Test during sprint-testing: start a Run, soft-delete US mid-run, verify Run state |
| 4 | Position concurrency: two POSTs auto-assign same MAX+1 | Medium | Medium | Serializable transaction or `INSERT ... SELECT MAX()+1` with lock |
| 5 | Body validation edge: 50KB counted in bytes vs characters (Unicode mismatch) | Low | Low | Boundary outline covers exact-byte payload |

---

## Next steps

- [ ] PO answers Critical Questions before sprint planning (external_id mutability, soft-delete namespace, position conflict)
- [ ] Dev answers Technical Questions before estimation (sanitization library, cascade transaction, external_id index, Module reassignment)
- [ ] Story enters sprint at status `Ready For Dev` once estimated
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected)
