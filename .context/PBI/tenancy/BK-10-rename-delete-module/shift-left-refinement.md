# Shift-Left Refinement: BK-10 — Rename and soft-delete a Module (with cascade)

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-05-27
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context
- **Primary persona affected**: Elena (QA Engineer) — renames Modules to reflect evolving taxonomy, archives Modules that are no longer in scope.
- **Secondary personas (if any)**: Mateo (QA Lead) — archival decisions cascade through the entire traceability chain and affect heatmap rollups. Karim (agent) — archived modules must not appear in agent-driven test discovery.
- **Business value proposition**: Modules are the organizational backbone. The taxonomy must be mutable — teams reorganize after sprints, rename modules to match product changes, and archive dead branches without losing historical Run data. Without rename + soft-delete, the tree becomes a graveyard of stale names OR forces destructive operations. Soft-delete preserves Run history, Bug attribution, and audit trails while cleaning the active workspace.
- **KPI(s) influenced**: Module coverage %, active-module count accuracy, defect heatmap fidelity (archived modules should not count toward active defect density).
- **User journey position**: Flow 1 (Setup), Step 3 (post-creation mutations). After building the Module tree in BK-9, Elena needs ongoing maintenance: rename "Cart" → "Shopping Cart" when PM renames the feature, archive "Legacy Checkout" when the flow is deprecated, restore it if the feature is revived.

### Technical context
- **Frontend**: Module editor (drawer inside Project View). Rename: inline edit or drawer with name field → `PATCH /modules/{id} { name }`. Delete: context menu "Archive Module" with confirmation dialog warning about cascade effects. Restore: "Archived" filter toggle in tree → "Restore" action on archived module. Same components as BK-9 create drawer (Input, validation, success toast).
- **Backend**:
  - `PATCH /api/v1/modules/{id}` — body `{ name }` → 200 `{ id, name, slug?, path?, updated_at }`. Rename triggers slug recomputation (or leaves slug immutable — open question) and, if slug changes, cascading path updates to all descendant modules + ATC slug recomputation.
  - `DELETE /api/v1/modules/{id}` — soft-delete: sets `archived_at = now()` on the module AND cascades to all descendants (child modules, their user_stories, acceptance_criteria, atcs, tests). No rows are deleted. Transforms activity_log row `action="module.archived"`.
  - `POST /api/v1/modules/{id}/restore` — unarchive: clears `archived_at` on the module. Cascade restore behavior is an open question (restore descendants or not?).
  - FR: BK-006 (rename, archive) + BK-039 (soft-delete infrastructure). Auth: Bearer (member+). Side effects: activity_log, Realtime broadcast, materialized path + slug recomputation on rename.
- **DB tables**: `modules` (name, slug, path, archived_at), `user_stories` (archived_at), `acceptance_criteria` (archived_at), `atcs` (archived_at, slug), `tests` (archived_at), `activity_log`. Runs and Bugs are NOT auto-archived (they are execution artifacts, not taxonomy).
- **External services**: None.
- **Integration points specific to this Story**:
  - Auth middleware → member+ required for rename/delete; admin-only for hard-delete (future).
  - Module existence validation → 404 if module not found. 400 if already archived (double-archive).
  - Cascade trigger/procedure → on `modules.archived_at` SET, propagate to descendant modules → user_stories → acceptance_criteria → atcs → tests.
  - Slug uniqueness on rename → same project-scoped uniqueness rule as create (BK-9 AC5).
  - Path recomputation on slug change → update materialized `path` column for the renamed module + ALL descendants.
  - ATC slug recomputation → if module slug changes, every ATC under that module subtree must have its slug recalculated (`{module-slug}/{atc-id-padded}`).
  - Listing endpoints → `archived_at IS NULL` default filter; `?include_archived=true` to see archived items.
  - Realtime broadcast → publish on project channel for tree refresh.
  - Soft-delete cascade worker vs in-transaction → large module trees (100+ entities) may timeout if cascade is in-transaction. Async job may be required.

### Story complexity
| Axis | Rating | Why |
|------|--------|-----|
| Business logic | High | Slug-vs-path-vs-name on rename, cascade policy for archive (which entities? restore?), archived module visibility rules (can US be added? visible in tree?), restore semantics (cascade or module-only?). Multiple open design decisions. |
| Integration | Low | Single internal DB transaction (or async job for large trees). No external service calls. Realtime broadcast is infrastructure-level. |
| Data validation | Medium-High | Rename: same name validation as create (2–80 chars, alphanumeric). Slug uniqueness (project-scoped, same as create). Archive: module existence, not already archived, no active Runs blocking (open question). Restore: module must be archived, parent check (is parent also archived?). |
| UI | Medium | Rename: inline edit or modal (same form as create minus parent selector). Delete: confirmation dialog with cascade warning (count of affected entities). Restore: tree toggle to show archived, restore action button. |

**Estimated test effort**: ~3–4 person-hours (manual exploratory) + ~10–14 person-hours (automated tests, ~45 outlines with parametrization). Rename cascade + archive cascade are structurally similar to ATC edit propagation (BK-012).

### Epic-level inheritance (if applicable)
- **Epic**: EPIC-BK-002 — Project & Module Hierarchy
- **Risks restated at Story level**:
  - Cascade soft-delete touching 100+ entities in a single transaction may timeout or deadlock under Postgres RLS.
  - Slug change on rename triggers ATC slug recomputation for the entire subtree — a bug here silently breaks ATC lookup-by-slug, command palette, and API permalinks.
  - Archive without cascade leaves orphan traceability — user_stories without active modules break the tree view.
  - Restore without cascade leaves archived children unreachable from the restored parent.
- **Integration points inherited**: Supabase Auth, activity log, Realtime, listing endpoints with `archived_at` filter (BK-039).
- **PO/Dev answers already given at epic level**:
  - Soft-delete via `archived_at` with cascade to descendant Modules + child entities (business-data-map §5: "Sets archived_at on descendant Modules, US, AC, ATC, Tests").
  - Listing endpoints default-filter `archived_at IS NULL` (business-feature-map FEAT-046).
  - Hard-delete only via admin endpoint with confirmation header (Phase 2).
- **Test strategy inherited**: Cascade integrity (all children archived, no false positive), tree UI exclusion of archived items, reopen-archive idempotency (archive → restore → archive again).

---

## Phase 2 — Story Quality Analysis

### Ambiguities
| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|-------------------|---------------------|-------------------|------------------------|
| 1 | Story — "Rename a Module" | Does renaming change the `slug` or only the `name`? If slug changes, all descendant modules' materialized `path` values AND all ATC slugs (`{module-slug}/{atc-id-padded}`) must be recomputed — a massive cascade. If slug is immutable on rename, only `name` changes and paths/slugs are untouched. | Determines whether rename is a simple column update or a subtree-wide mutation that touches modules, atcs, and possibly tests. Test scope differs by ~10x. | Slug should be IMMUTABLE on rename. The slug is the stable identifier for API lookups, permalinks, and ATC paths — changing it breaks every bookmarked URL. Rename changes `name` only. Modules that need a slug change → archive + create new. |
| 2 | Story — "soft-delete with cascade" | Cascade to which entities exactly? Child modules (confirmed). User stories in those modules? Acceptance criteria under those US? ATCs under those modules? Tests that chain those ATCs? What about Bugs (anchored to Module — mandatory)? Should Runs on archived Tests be affected? | Determines how many tables the cascade touches and whether the operation needs to be async (if >100 rows in subtree). | Cascade `archived_at` to: child modules → user_stories in subtree → acceptance_criteria in subtree → atcs in subtree → tests in subtree. Do NOT cascade to Bugs (they serve defect tracking, not taxonomy) or Runs (execution history must survive archive). Listed in business-data-map §5 but needs explicit confirmation. |
| 3 | Story — "with cascade" ambiguity on archive | Is archive reversible? The Story mentions no `/restore` endpoint, but the user-provided API contract includes `POST /api/v1/modules/{id}/restore`. Does the Story cover both archive AND restore? | Determines if restore is in scope for this Story. | Confirm scope: ARCHIVE + RESTORE in this Story. The `/restore` endpoint is explicitly in the API design. |
| 4 | Story — restore behavior | Does restoring a module cascade-restore its descendants? Or restore only the module itself, leaving children archived? If cascade-restore, what about children that were archived BEFORE the parent? | Without clear semantics, tests cannot assert correct behavior. Three models: (A) cascade-restore all descendants, (B) restore module only, (C) restore module + children that were archived in the same cascade event (track `archived_by_batch` column). | Model A (simplest, user-expected): restoring a module restores its immediate descendants (modules, US, AC, ATCs, Tests). If a child module was archived independently before the parent, restoring the parent does NOT restore that child. |
| 5 | Story — archived module visibility in tree | Are archived modules visible in the left-pane tree? If yes, with what visual treatment (greyed out, strikethrough, hidden by default with toggle)? Can users expand archived modules to see their archived children? | Determines UI test scenarios for tree rendering. | Archived modules hidden by default in tree. Toggle "Show Archived" in project settings or tree toolbar reveals greyed-out archived modules. Archived modules show archived children (expandable). |
| 6 | Story — operations on archived modules | Can a User Story be added to an archived Module? Can an ATC be created inside an archived Module? Can a Test be created that chains ATCs from archived Modules? | Blocked-entity tests depend on this. | Write operations rejected on archived modules: POST user-story with archived `module_id` → 400 `MODULE_ARCHIVED`. POST atc with archived `module_id` → 400. POST test with archived ATCs in chain → 400 or warn. Runs on Tests that reference archived ATCs → allowed (execution history must survive archive). |
| 7 | Story — rename validation | Does rename enforce the same validation rules as create (2–80 chars, at least one alphanumeric)? Is rename idempotent (PATCH with same name → 200 no change)? | Same validation surface as BK-9 create. Test table expands accordingly. | Yes — same name validation as BK-9 create: 2–80 chars, ≥1 alphanumeric, no slashes. Idempotent: PATCH with current name → 200 no-op. |
| 8 | Story — double-archive idempotency | What happens when `DELETE /modules/{id}` is called on an already-archived module? | Prevents redundant cascade triggers and confusing error messages. | 200 no-op (idempotent) — returns the module as-is with existing `archived_at`. Do NOT reject with 400. This lets idempotent retries work. |
| 9 | Story — restore of non-archived module | What happens when `POST /modules/{id}/restore` is called on an active (non-archived) module? | Defines restore error handling. | 200 no-op (idempotent) — module already active. OR 400 `MODULE_NOT_ARCHIVED`. **Recommend**: 200 no-op for consistency with double-archive idempotency. |
| 10 | Story — restore with archived parent | If Module B (child of Module A) is restored, but Module A is still archived — should this be allowed? The child would have an archived parent, making it invisible in default tree view. | Edge-case behavior for partial restores. | Allow restore of child even if parent is archived. Child appears in default tree under archived parent visualization OR in a "Detached" section. The user knows what they're doing. Alternatively: reject with `PARENT_MODULE_ARCHIVED`. **NEEDS PO/DEV CONFIRMATION**. |
| 11 | Story — slug collision on rename | If slug IS mutable on rename, what happens when renaming "Cart" → "Payment" when "Payment" already exists as a slug? | Same as BK-9 slug uniqueness test. | Reject with 409 `SLUG_NOT_UNIQUE`. Same behavior as create. But since slug is recommended immutable, this ambiguity is moot. |
| 12 | Story — bulk operations | Does this Story cover PATCH /modules/bulk (rename multiple, archive multiple)? bulk-edit endpoint exists per FEAT-037. | Determines if bulk rename/archive is in scope. | Out of scope for BK-10. Bulk operations covered by FEAT-037/BK-030 separately. |

### Gaps (missing info)
| # | Type | Why critical | What to add | Risk if omitted |
|---|------|--------------|-------------|-----------------|
| 1 | AC | Story is a single sentence. No acceptance criteria exist for rename, archive, or restore. | Write 3 AC sets: AC1 (Rename Module), AC2 (Archive Module with cascade), AC3 (Restore Module). Minimum 3 ACs, each with multiple scenarios. | QA cannot design test scenarios. Dev has no contract. |
| 2 | AC | No error responses specified for rename validation or archive/restore edge cases. | Error catalog: 400 VALIDATION_ERROR, 404 MODULE_NOT_FOUND, 409 SLUG_NOT_UNIQUE (if slug mutable), 400 MODULE_ARCHIVED (blocking writes on archived modules), 403 FORBIDDEN (viewer role). | Negative scenarios untestable. Inconsistent error surface. |
| 3 | AC | Cascade scope not specified — which entities get `archived_at` set, which do not. | Explicit cascade list: child modules (recursive), user_stories in subtree, acceptance_criteria in subtree, atcs in subtree, tests in subtree. NOT: bugs, runs, environments, integrations. | Dev may cascade too broadly (archiving runs loses execution history) or too narrowly (orphaned US with no active module). |
| 4 | AC | No AC for what happens when an archived module's descendant list includes entities that were ALREADY archived before the cascade. | Add Scenario: Given module has a child that was manually archived 3 days ago (older `archived_at`), When parent is archived, Then the child's `archived_at` is NOT overwritten (preserve original archive timestamp). | Cascade archive overwriting prior `archived_at` timestamps loses audit data — user cannot tell when each entity was independently archived. |
| 5 | Technical detail | Cascade implementation: in-transaction procedure or async job? Large subtrees (100+ modules × N US/ATC/Tests) may timeout a single transaction. | Specify: synchronous cascade up to ~500 rows (standard Postgres transaction). Beyond that threshold, queue an async job and return 202 `cascade_in_progress` with a polling `job_id`. | Production timeout on large projects blocks the UI. |
| 6 | AC | No AC for rename behavior when slug is mutable — path and ATC slug recomputation. If slug is immutable (recommended), this gap is closed. | If slug mutable: Add Scenario — Given module slug changes, Then all descendant modules' `path` is recomputed AND all ATCs in subtree get new `slug` = `{new-module-slug}/{atc-id-padded}`. | Silent corruption of ATC lookups and module paths — the tree breaks without any error. |
| 7 | Technical detail | Realtime broadcast behavior on cascade archive. Should the system publish individual events per archived entity or a single "subtree-archived" event? | Determine Realtime test scenario. | If 100 entities are individually broadcast, UI may flicker or crash. If a single coalesced event, subscribers must handle subtree-level updates. |
| 8 | AC | No AC for run/tree interaction with archived modules. Can a user start a Run on a Test that chains ATCs from archived modules? | Add Scenario: Test has ATCs from archived module → `POST /runs` with that Test → should be allowed (execution history must survive, and the Test was authored before archive). | Blocking runs on archived-module tests prevents regression execution of legacy test suites. |
| 9 | AC | No AC for bug filing referencing archived modules. Bugs have mandatory `module_id`. Can a bug be filed on an archived module? | Add Scenario: Bug filed on archived module → allowed (bugs are traceability, not taxonomy). Module still exists — just hidden from active tree. | If blocked, historical bugs in archived modules cannot be created for regression analysis. |
| 10 | AC | No AC for restore cascade scope. Does restoring module restore only the module or recursively all descendants? | Add Scenario: Given module with 3 archived children, When parent is restored, Then children are also restored (Model A). Or: Then only parent is restored, children remain archived (Model B). | Without clear semantics, restore does something unexpected and user loses data visibility. |

### Edge cases not in Story
| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|----------|-------------------------------|-------------|--------|
| 1 | Rename module to same name (no-op rename) | 200, no DB change, `updated_at` unchanged or same as before. Idempotent. | Medium | Add to AC |
| 2 | Rename to empty string | 400 VALIDATION_ERROR "name is required" | High | Add to AC |
| 3 | Rename to name with only whitespace | 400 — same as create: whitespace-trimmed length < 2 → VALIDATION_ERROR | High | Add to AC |
| 4 | Rename to name exceeding 80 chars | 400 VALIDATION_ERROR "Must be at most 80 characters" | High | Add to AC |
| 5 | Rename with slug change — path cascade to deep subtree | If slug mutable: rename root module → 50+ descendant paths recomputed in single transaction. Verify atomicity and correctness. If slug immutable: N/A. | Critical (if slug mutable) | Add to AC |
| 6 | Rename with slug change — ATC slug cascade | If slug mutable: rename root module → all ATC slugs in subtree recalculated (`GET /atcs/{old-slug}` → 404, `GET /atcs/{new-slug}` → 200). Redirect from old slug? | Critical (if slug mutable) | Add to AC |
| 7 | Archive leaf module (no children) | 200, `archived_at` set on module only. No cascade needed. | Critical | Add to AC |
| 8 | Archive parent module with 3 child modules, each with US/AC/ATCs/Tests | 200, `archived_at` set on parent + 3 children + all their US + all their AC + all their ATCs + all their Tests. Single transaction. | Critical | Add to AC |
| 9 | Archive module at depth 5 (deep nesting) | 200, cascade traverses full subtree via recursive CTE. All levels archived. | Critical | Add to AC |
| 10 | Archive leaf module, then immediately restore | 200 on archive, 200 on restore, `archived_at` cleared. Module visible in default tree again. | Critical | Add to AC |
| 11 | Archive module, then restore, then archive again (cycle) | Each operation succeeds. `archived_at` reflects most recent archive timestamp, not the first one. | High | Add to AC |
| 12 | Archive module, then attempt to create child module | 400 `PARENT_MODULE_ARCHIVED` (same as BK-9 create scenario 2.4). | High | Add to AC |
| 13 | Archive module, then attempt to create US in that module | 400 `MODULE_ARCHIVED`. Write operations blocked on archived modules. | High | Add to AC |
| 14 | Archive module, then attempt to create ATC in that module | 400 `MODULE_ARCHIVED`. | High | Add to AC |
| 15 | Archive module, file Bug on that module | 201 — Bug created successfully. Bugs are anchored to module for heatmap, not taxonomy. Archived modules still accumulate bugs → heatmap should distinguish active vs archived defect counts. | Medium | Ask PO — should heatmap filter archived modules? |
| 16 | Archive module, then query `GET /projects/{id}/tree` | Archived module NOT in tree by default. With `?include_archived=true` → archived module appears greyed out with archive icon. Children also visible as archived. | Critical | Add to AC |
| 17 | Archive module, then query `GET /modules?project_id=X` (default filter) | Archived module NOT in list. | High | Add to AC |
| 18 | Archive module, then query `GET /modules?project_id=X&include_archived=true` | Archived module appears in list with `archived_at` timestamp. | High | Add to AC |
| 19 | Two concurrent `DELETE` on same module | Both return 200 (idempotent). Same `archived_at` timestamp from first operation. | Medium | Add to AC |
| 20 | Viewer-role user attempting rename or archive | 403 FORBIDDEN. Only member+ can mutate modules. | High | Add to AC |
| 21 | Unauthenticated rename/archive/restore | 401 UNAUTHORIZED. | High | Add to AC |
| 22 | Rename or archive module in a different workspace (cross-tenant via RLS) | 404 (row filtered by RLS — module not visible, treated as not found). | Critical | Add to AC |
| 23 | Restore module, then child module that was independently archived BEFORE the parent archive | Child stays archived. Restore cascade only touches entities archived in the same cascade event or after. In Model B (no cascade), child stays archived regardless. | High | Add to AC — **NEEDS PO/DEV CONFIRMATION** |
| 24 | Restore module when parent module is archived | If allowed: module becomes active but hidden in default tree (parent archived). If blocked: 400 `PARENT_MODULE_ARCHIVED`. **NEEDS PO/DEV CONFIRMATION** — see Ambiguity #10. | Medium | Add to AC |
| 25 | Archive root module of a project with 100+ entities in subtree | If in-transaction: verify no timeout (Postgres default 30s). If async: verify 202 + polling endpoint returns successful cascade. | Medium | Ask Dev — implementation choice. |
| 26 | Module slug change on rename — old API URLs (`/modules/{old-slug}`) after rename | If slug mutable: GET /modules/{old-slug} → 404. Should old slug redirect to new slug? Add `redirect_slug` column or query by `id`? | Medium | Ask Dev if slug mutable. |

### Contradictions
| # | Source A | Source B | Conflict | Resolution needed |
|---|----------|----------|-----------|-------------------|
| 1 | `business-data-map.md` §5: "Soft-delete cascade — On modules archive → Sets archived_at on descendant Modules, US, AC, ATC, Tests" | User request: cascade implications for "child modules, user stories, and ATCs." Tests are included in data-map but not in user's list. | Are Tests included in archive cascade? Data-map says yes; user asks for confirmation. | Include Tests per data-map. Creating a Test that chains archived ATCs should be blocked, but existing Tests referencing those ATCs should be archived as well. |
| 2 | User-provided API: `DELETE /api/v1/modules/{id}` | `business-feature-map.md` §4.4: `DELETE /modules/{module_id}` — "Soft-delete a module" | Endpoint path: `DELETE /api/v1/modules/{id}` (user) vs `DELETE /modules/{module_id}` (feature-map). | Adopt user's design: `/api/v1/modules/{id}`. Consistent with BK-9 endpoint resolution (nested pattern). Update feature-map. |
| 3 | `business-feature-map.md` FEAT-006: Module CRUD includes "rename / move / soft-delete" in one feature | BK-9 covered CREATE only. BK-10 now covers RENAME + SOFT-DELETE. MOVE (changing `parent_module_id`) is still orphaned. | MOVE was recommended as a separate Story by BK-9 refinement. | Confirm MOVE is out of scope for BK-10. MOVE becomes BK-10b or BK-11. |

### Testability validation
**Verdict**: No — Story has zero ACs

Issues:
- **No acceptance criteria** — single-sentence Story provides no testable contract for rename, archive, or restore.
- **Slug mutability on rename is unresolved** — this is the single largest scope decision for the Story. Immutable slug = simple column update. Mutable slug = subtree-wide recomputation of paths + ATC slugs.
- **Cascade scope is underspecified** — which entities are archived, which are not.
- **Restore semantics undefined** — cascade or module-only? Tied to archive cascade design.
- **Archived-module interaction rules missing** — can entities be created under archived modules? Can bugs reference archived modules? Can tests chain archived ATCs?
- **No error catalog** — validation errors, conflict states, and auth failures have no specified codes or messages.

---

## Phase 3 — Refined Acceptance Criteria

> **Note**: ALL scenarios below are inferred from domain context (business-data-map §5, business-feature-map FEAT-006 + FEAT-046, master-test-plan §7, user-provided API contract). Every scenario is marked **NEEDS PO/DEV CONFIRMATION** because the Story has zero original ACs.

### AC1 — Rename a Module (NEEDS PO/DEV CONFIRMATION)

**Design assumption**: Slug is **IMMUTABLE** on rename. Only `name` changes. This avoids path + ATC slug recomputation cascading through the entire subtree. If slug must be mutable, separate Story covers slug-change propagation.

#### Scenario 1.1: Should rename a module with valid name (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**: slug immutability assumption
- **Given**: Module "Cart" exists with id `mod-cart`, slug "cart", name "Cart". Authenticated user is member+. No other module has slug "shopping-cart" in this project.
- **When**: `PATCH /api/v1/modules/mod-cart` with body `{ "name": "Shopping Cart" }`
- **Then**:
  - UI: Module name updates in tree (left pane) without losing its tree position or children. `name` shows "Shopping Cart", collapsed/expanded state preserved.
  - API: `200 { "success": true, "data": { "id": "mod-cart", "name": "Shopping Cart", "slug": "cart", "path": "/cart", "parent_module_id": null, "depth": 0, "position": 1, "children_count": 3, "updated_at": "<ISO>" } }`. Slug "cart" is **unchanged**.
  - DB: `modules.name` = "Shopping Cart", `modules.slug` = "cart" (unchanged), `modules.path` = "/cart" (unchanged). `activity_log` row with `action="module.renamed"`, `payload_summary="Cart → Shopping Cart"`.
  - System state: Realtime broadcast on project channel → tree view refreshes name inline. No cascade to children (slug + path unchanged).

#### Scenario 1.2: Should accept same-name rename (idempotent no-op) (Type: Positive, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" with name "Cart".
- **When**: `PATCH /api/v1/modules/mod-cart` with body `{ "name": "Cart" }`
- **Then**: `200`. `updated_at` unchanged or reflects current time (no meaningful change). No activity_log row (or activity_log with `action="module.renamed"` and `payload_summary="Cart (no change)"`). **NEEDS PO/DEV CONFIRMATION**: should no-op rename log an activity entry?

#### Scenario 1.3: Should reject rename with empty name (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" exists.
- **When**: `PATCH /api/v1/modules/mod-cart` with body `{ "name": "" }`
- **Then**: `400 { "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Module name must be between 2 and 80 characters", "details": [{"field": "name", "message": "Must be at least 2 characters"}] } }`. No DB change.

#### Scenario 1.4: Should reject rename with name too short (1 char) (Type: Boundary, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" exists.
- **When**: `PATCH /api/v1/modules/mod-cart` with body `{ "name": "A" }`
- **Then**: `400` VALIDATION_ERROR. Same as create (BK-9 Scenario 1.2).

#### Scenario 1.5: Should reject rename with name too long (81 chars) (Type: Boundary, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" exists.
- **When**: `PATCH /api/v1/modules/mod-cart` with body `{ "name": "<81 chars>" }`
- **Then**: `400` VALIDATION_ERROR. Same as create (BK-9 Scenario 1.3).

#### Scenario 1.6: Should reject rename with no alphanumeric characters (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" exists.
- **When**: `PATCH /api/v1/modules/mod-cart` with body `{ "name": "!!! @@" }`
- **Then**: `400 { "success": false, "error": { "code": "NAME_NO_ALPHANUMERIC", "message": "Module name must contain at least one alphanumeric character" } }`. No DB change.

#### Scenario 1.7: Should reject rename when module does not exist (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module `mod-999` does not exist.
- **When**: `PATCH /api/v1/modules/mod-999` with body `{ "name": "New Name" }`
- **Then**: `404 { "success": false, "error": { "code": "MODULE_NOT_FOUND", "message": "Module not found" } }`.

#### Scenario 1.8: Should reject rename by viewer-role user (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Sara is a `viewer` in the workspace.
- **When**: `PATCH /api/v1/modules/mod-cart` with body `{ "name": "Hacked" }`
- **Then**: `403 { "success": false, "error": { "code": "FORBIDDEN", "message": "Member role or higher required to modify modules" } }`. No DB change.

#### Scenario 1.9: Should reject unauthenticated rename (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: No auth token.
- **When**: `PATCH /api/v1/modules/mod-cart` with body `{ "name": "New Name" }`
- **Then**: `401 { "success": false, "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }`.

---

### AC2 — Soft-delete (Archive) a Module with cascade (NEEDS PO/DEV CONFIRMATION)

**Design assumption**: Cascade `archived_at` to: child modules (recursive) → user_stories in subtree → acceptance_criteria in subtree → atcs in subtree → tests in subtree. Do NOT cascade to bugs or runs.

#### Scenario 2.1: Should archive a leaf module with no children or entities (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Leaf module "Empty" exists with id `mod-empty`, no children, no US/AC/ATC/Tests. Authenticated user is member+.
- **When**: `DELETE /api/v1/modules/mod-empty`
- **Then**:
  - API: `200 { "success": true, "data": { "id": "mod-empty", "archived_at": "<ISO>", "cascade": { "modules": 1, "user_stories": 0, "acceptance_criteria": 0, "atcs": 0, "tests": 0 } } }`.
  - DB: `modules.archived_at` set to now() for mod-empty only.
  - Activity: `activity_log` row with `action="module.archived"`, `entity_type="module"`, `payload_summary` includes cascade counts.
  - Tree: Module disappears from default tree view. With `?include_archived=true`, module visible as greyed-out.

#### Scenario 2.2: Should archive a parent module and cascade to all descendants (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" (id `mod-cart`) has 2 child modules "Add to Cart" and "Remove from Cart". "Add to Cart" has 1 US → 2 AC → 1 ATC → 1 Test. "Remove from Cart" has 0 entities.
- **When**: `DELETE /api/v1/modules/mod-cart`
- **Then**:
  - API: `200 { "success": true, "data": { "id": "mod-cart", "archived_at": "<ISO>", "cascade": { "modules": 3, "user_stories": 1, "acceptance_criteria": 2, "atcs": 1, "tests": 1 } } }`.
  - DB:
    - `modules.archived_at` set for mod-cart + both children.
    - `user_stories.archived_at` set for the 1 US under "Add to Cart".
    - `acceptance_criteria.archived_at` set for 2 ACs.
    - `atcs.archived_at` set for 1 ATC.
    - `tests.archived_at` set for 1 Test.
    - `bugs` unchanged (not in cascade).
    - `runs` unchanged (not in cascade).
  - Tree: All 3 modules disappear from default tree. With `?include_archived=true`, all appear greyed out in nested structure.

#### Scenario 2.3: Should preserve existing `archived_at` for entities already archived before cascade (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Add to Cart" (child of "Cart") was independently archived 3 days ago (`archived_at = "2026-05-24"`). Module "Cart" is still active. "Remove from Cart" (other child) is active.
- **When**: `DELETE /api/v1/modules/mod-cart` (archive parent)
- **Then**:
  - DB: `modules.archived_at` for "Cart" = `NOW()`. "Remove from Cart" = `NOW()`. "Add to Cart" = `"2026-05-24"` (preserved — original archive timestamp not overwritten).
  - Cascade counts reflect the overwritten entities: `cascade.modules = 2` (Cart + Remove from Cart; Add to Cart was already archived).

#### Scenario 2.4: Should handle archive idempotency — double-archive returns 200 no-op (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" is already archived (`archived_at` is set).
- **When**: `DELETE /api/v1/modules/mod-cart` (second archive attempt)
- **Then**: `200 { "success": true, "data": { "id": "mod-cart", "archived_at": "<original timestamp>", "cascade": { "modules": 0, "user_stories": 0, "acceptance_criteria": 0, "atcs": 0, "tests": 0 } } }`. No DB changes. No activity_log row for redundant operation.

#### Scenario 2.5: Should reject archive when module not found (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module `mod-999` does not exist.
- **When**: `DELETE /api/v1/modules/mod-999`
- **Then**: `404 { "success": false, "error": { "code": "MODULE_NOT_FOUND", "message": "Module not found" } }`.

#### Scenario 2.6: Should reject archive by viewer-role user (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Sara is a `viewer`.
- **When**: `DELETE /api/v1/modules/mod-cart`
- **Then**: `403 FORBIDDEN`. No DB change.

#### Scenario 2.7: Should reject unauthenticated archive (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: No auth token.
- **When**: `DELETE /api/v1/modules/mod-empty`
- **Then**: `401 UNAUTHORIZED`.

#### Scenario 2.8: Should archive module at maximum depth (6) with full cascade (Type: Boundary, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module at depth 6 with 1 US → 1 AC → 1 ATC. Authenticated user.
- **When**: `DELETE /api/v1/modules/<depth-6-module>`
- **Then**: `200`. Module + US + AC + ATC archived. Cascade statistics accurate. No timeout (small subtree).

#### Scenario 2.9: Should reject create-child on archived module (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" is archived.
- **When**: `POST /api/v1/projects/proj-01/modules` with `{ "name": "New Child", "parent_module_id": "mod-cart" }`
- **Then**: `400 { "success": false, "error": { "code": "PARENT_MODULE_ARCHIVED", "message": "Cannot add children to an archived module" } }`. No DB change.

#### Scenario 2.10: Should reject create-US on archived module (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" is archived.
- **When**: `POST /api/v1/user-stories` with `{ "module_id": "mod-cart", "title": "New US" }`
- **Then**: `400 { "success": false, "error": { "code": "MODULE_ARCHIVED", "message": "Cannot create entities in an archived module" } }`. No DB change.

#### Scenario 2.11: Should reject create-ATC on archived module (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" is archived.
- **When**: `POST /api/v1/atcs` with `{ "module_id": "mod-cart", ... }`
- **Then**: `400 MODULE_ARCHIVED`. No DB change.

#### Scenario 2.12: Archived module not visible in default tree query (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" is archived. Project has 5 active modules + "Cart".
- **When**: `GET /api/v1/projects/proj-01/tree` (default — no `include_archived`)
- **Then**: `200 `. Tree contains 5 modules (Cart excluded). No archived modules in default view.

#### Scenario 2.13: Archived module visible with `include_archived=true` (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" is archived.
- **When**: `GET /api/v1/projects/proj-01/tree?include_archived=true`
- **Then**: `200`. Tree contains all 6 modules. "Cart" rendered with `archived: true` flag so UI can grey it out. Archived children nested under archived parent.

#### Scenario 2.14: Archived module children also hidden in default tree (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" (parent) is archived. "Add to Cart" (child) is archived by cascade.
- **When**: `GET /api/v1/projects/proj-01/tree`
- **Then**: Neither "Cart" nor "Add to Cart" appear.

#### Scenario 2.15: Should still allow bug filing on archived module (Type: Positive, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" is archived.
- **When**: `POST /api/v1/bugs` with `{ "module_id": "mod-cart", "title": "Regression in archived feature", "severity": "P1" }`
- **Then**: `201`. Bug created successfully. Bugs are anchored to module for heatmap traceability, not blocked by archive. **NEEDS PO/DEV CONFIRMATION**: should the heatmap show archived-module defects? Filtered by default?

#### Scenario 2.16: Should still allow Run start on Test referencing archived-module ATCs (Type: Positive, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Test "Cart Flow" chains ATCs from module "Cart". "Cart" is now archived.
- **When**: `POST /api/v1/runs` with `{ "test_id": "<cart-flow-test>", "environment": "staging" }`
- **Then**: `201`. Run starts normally. Execution history must survive archive.

#### Scenario 2.17: Concurrent archive on same module from two users (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" is active. User A and User B both click "Archive" simultaneously.
- **When**: Two `DELETE /api/v1/modules/mod-cart` requests arrive within 100ms.
- **Then**: Both return `200`. First sets `archived_at`, cascade fires once. Second is idempotent no-op (returns original timestamp, cascade 0). No double-cascade.

---

### AC3 — Restore (Unarchive) a Module (NEEDS PO/DEV CONFIRMATION)

**Design assumption**: Model A — restoring a module cascade-restores its immediate descendants (child modules, US, AC, ATCs, Tests). If a descendant was independently archived before the parent cascade, its `archived_at` is NOT cleared (it stays archived). This prevents unintentional revival of explicitly retired content.

#### Scenario 3.1: Should restore an archived leaf module (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Leaf module "Empty" is archived (`archived_at` is set). Authenticated user is member+.
- **When**: `POST /api/v1/modules/mod-empty/restore`
- **Then**:
  - API: `200 { "success": true, "data": { "id": "mod-empty", "archived_at": null, "restored": { "modules": 1, "user_stories": 0, "acceptance_criteria": 0, "atcs": 0, "tests": 0 } } }`.
  - DB: `modules.archived_at` = NULL for mod-empty.
  - Activity: `activity_log` row with `action="module.restored"`.
  - Tree: Module reappears in default tree view.

#### Scenario 3.2: Should restore parent module and cascade-restore children (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**: Model A — cascade restore
- **Given**: Module "Cart" was archived 2 days ago. Children "Add to Cart" and "Remove from Cart" were archived by cascade. Their US/AC/ATCs/Tests were also archived by cascade. All share the same archive timestamp ± a few ms.
- **When**: `POST /api/v1/modules/mod-cart/restore`
- **Then**:
  - API: `200 { "success": true, "data": { "id": "mod-cart", "archived_at": null, "restored": { "modules": 3, "user_stories": 1, "acceptance_criteria": 2, "atcs": 1, "tests": 1 } } }`.
  - DB: `archived_at` cleared for all 3 modules, the US, the 2 ACs, the ATC, and the Test.
  - Tree: All 3 modules visible in default tree. US/AC/ATC/Test reappear in their respective tables/lists.

#### Scenario 3.3: Should NOT restore child that was independently archived before parent cascade (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: "Add to Cart" was archived on May 20 (independent archive). "Cart" (parent) was archived on May 25 (cascade archived "Remove from Cart" but NOT "Add to Cart" since it was already archived). "Remove from Cart" has `archived_at = May 25`, "Add to Cart" has `archived_at = May 20`.
- **When**: `POST /api/v1/modules/mod-cart/restore`
- **Then**:
  - "Cart" restored (`archived_at = NULL`).
  - "Remove from Cart" restored (archived by same cascade as parent).
  - "Add to Cart" stays archived (`archived_at = May 20` preserved). Restore count: `modules: 2` (Cart + Remove from Cart).
  - **NEEDS PO/DEV CONFIRMATION**: how does the system track "archived by cascade vs archived independently"? Options: (A) compare timestamps — same second = cascade, (B) separate `archived_reason` column ("manual" vs "cascade"), (C) restore restores ALL children regardless. Recommend Option B for robustness against clock skew.

#### Scenario 3.4: Should handle restore idempotency — restore already-active module returns 200 no-op (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" is active (no `archived_at`).
- **When**: `POST /api/v1/modules/mod-cart/restore`
- **Then**: `200 { "success": true, "data": { "id": "mod-cart", "archived_at": null, "restored": { "modules": 0, "user_stories": 0, "acceptance_criteria": 0, "atcs": 0, "tests": 0 } } }`. No DB changes. No activity_log. Idempotent no-op.

#### Scenario 3.5: Should reject restore when module not found (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module `mod-999` does not exist.
- **When**: `POST /api/v1/modules/mod-999/restore`
- **Then**: `404 { "success": false, "error": { "code": "MODULE_NOT_FOUND", "message": "Module not found" } }`.

#### Scenario 3.6: Should reject restore by viewer-role user (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Sara is a `viewer`. Module "Cart" is archived.
- **When**: `POST /api/v1/modules/mod-cart/restore`
- **Then**: `403 FORBIDDEN`. No DB change.

#### Scenario 3.7: Should reject unauthenticated restore (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: No auth token.
- **When**: `POST /api/v1/modules/mod-cart/restore`
- **Then**: `401 UNAUTHORIZED`.

#### Scenario 3.8: Should restore module and verify entities are accessible for writes again (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" was archived → all US/AC/ATC/Tests archived. Now restored.
- **When**: (a) `POST /api/v1/user-stories` with `module_id = "mod-cart"`, (b) `POST /api/v1/atcs` with `module_id = "mod-cart"`, (c) `PATCH /api/v1/modules/mod-cart` with `{ "name": "Cart V2" }`
- **Then**: All operations succeed. Archived flag no longer blocks writes.

#### Scenario 3.9: Should restore module → archive again → restore again (full cycle) (Type: Boundary, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" is active.
- **When**: Archive → Restore → Archive → Restore (full cycle executed twice)
- **Then**: After final restore: module active, `archived_at = NULL`. Activity log contains 4 entries (2 archived + 2 restored). No cascade artifacts from prior cycles.

#### Scenario 3.10: Should restore when parent module is still archived (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: see Ambiguity #10
- **Given**: "Add to Cart" (child of "Cart") was archived independently. "Cart" is also archived. User restores "Add to Cart" only.
- **When**: `POST /api/v1/modules/<add-to-cart-id>/restore`
- **Then**:
  - **Option A (allow)**: `200`. "Add to Cart" restored. Visible in default tree under "Detached" or under greyed-out "Cart". Write operations allowed on "Add to Cart".
  - **Option B (block)**: `400 { "success": false, "error": { "code": "PARENT_MODULE_ARCHIVED", "message": "Cannot restore a child module when its parent is archived. Restore the parent first." } }`.
  - **Recommend Option A** — user knows what they're doing, allows surgical restores.

---

### New scenarios surfaced from Phase 2 edge cases — NEEDS PO/DEV CONFIRMATION

#### Scenario E1: Should cascade-archive a deep module tree with 50+ entities (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: sync vs async implementation
- **Given**: Module at depth 2 with 10 children, each with 5 US → 3 AC → 2 ATC → 2 Tests. Subtree entity count: ~10 modules + 50 US + 150 AC + 100 ATC + 100 Tests ≈ 410 entities.
- **When**: `DELETE /api/v1/modules/<root>`
- **Then**: If sync: `200` within Postgres transaction timeout. If async: `202 { "job_id": "<uuid>", "status": "cascade_in_progress" }` + polling `GET /api/v1/jobs/{id}` → `"status": "completed", "cascade": { ... } }`.

#### Scenario E2: Should handle rename when slug is mutable — path cascade (Type: Edge, Priority: N/A — depends on design)
- **NEEDS PO/DEV CONFIRMATION**: only relevant if slug is mutable
- **Given**: Module "Cart" (slug "cart", path "/cart") has child "Add to Cart" (slug "add-to-cart", path "/cart/add-to-cart"). Slug mutability enabled.
- **When**: `PATCH /api/v1/modules/mod-cart` with `{ "slug": "shopping-cart" }`
- **Then**: Module slug → "shopping-cart", path → "/shopping-cart". Child path recomputed: "/shopping-cart/add-to-cart". All descendant paths updated in transaction. **NOT in recommended scope for BK-10**.

#### Scenario E3: Activity log should record cascade details for audit (Type: Integration, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Archive operation cascades to 3 modules + 5 US + 10 AC + 3 ATC + 2 Tests.
- **When**: Archive completes.
- **Then**: Single `activity_log` row with `action="module.archived"`, `payload_summary` = `"Archived module 'Cart' + cascade: 3 modules, 5 user stories, 10 acceptance criteria, 3 ATCs, 2 tests"`. NOT one row per archived entity (noisy).

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate
| Type | Count | Notes |
|------|-------|-------|
| Positive | 16 | Rename rename, rename no-op, archive leaf, archive parent+cascade, archive preserve-prior-timestamp, archive idempotent no-op, archive deep subtree, restore leaf, restore parent+cascade, restore not-restore-independently-archived, restore no-op, restore verify-writes, full archive→restore cycle, tree default excludes archived, tree include_archived, bug-on-archived module |
| Negative | 16 | Rename empty, rename too-short, rename too-long, rename no-alpha, rename not-found, archive not-found, archive double no-op (already tested as positive no-op), restore not-found, restore already-active no-op (tested as positive), rename viewer, rename unauthenticated, archive viewer, archive unauthenticated, restore viewer, restore unauthenticated, create-child-on-archived, create-US-on-archived, create-ATC-on-archived |
| Boundary | 8 | Rename name at 2 chars (min), rename name at 80 chars (max), rename name at 1 char (under), rename name at 81 chars (over), archive module depth 6, archive module depth 1 (root), restore then archive again, archive idempotent after-archive |
| Integration | 5 | Archive cascade atomicity (transaction rollback), activity_log entries for rename/archive/restore, Realtime broadcast on project channel, cascade timestamp preservation (independently-archived children), tree query with `?include_archived` filter |
| API | 6 | 200 PATCH response shape, 200 DELETE response shape + cascade counts, 200 POST restore response shape + restored counts, 400 error envelope for validation, 404 error envelope, 401/403 auth error envelope |
| **Total** | **51** | Rename (same validation surface as BK-9 create) + Archive (cascade across 5 entity types) + Restore (inverse cascade with timestamp-based discrimination). High count driven by 3 operations × validation rules + cascade integrity across entity types. |

**Rationale**: BK-10 is effectively three operations (rename, archive, restore) on a tree-structured resource, each with its own validation + cascade behavior. The rename surface mirrors BK-9 (name validation) but removes parent/position complexity. The archive surface is the novel part — cascade propagates `archived_at` across 5 entity types, and correctness depends on atomicity + timestamp preservation. Restore is the inverse and requires distinguishing "archived by cascade" from "archived independently." At ~51 outlines, this is a moderate-to-large Story that should be split if slug mutability is included.

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive
- **Should rename module with valid name** — Pre: module exists, user member+, valid name. Expected: 200, name changed, slug unchanged.
- **Should accept same-name rename as idempotent no-op** — Pre: module "Cart" exists. Expected: 200, no change, slug/path unchanged.
- **Should archive leaf module with no children or entities** — Pre: empty module. Expected: 200, archived_at set, cascade counts = {1,0,0,0,0}.
- **Should archive parent module and cascade to all descendant entities** — Pre: parent module with 2 children, US/AC/ATC/Tests in subtree. Expected: 200, all entities archived_at set, accurate cascade counts.
- **Should preserve existing archived_at for entities already archived before cascade** — Pre: one child pre-archived 3 days ago. Expected: parent + other child archived, pre-archived child timestamp unchanged.
- **Should return 200 no-op on double-archive (idempotent)** — Pre: module already archived. Expected: 200, no cascade, original timestamp returned.
- **Should restore archived leaf module** — Pre: module archived. Expected: 200, archived_at cleared.
- **Should restore parent and cascade-restore children archived by same cascade** — Pre: parent + children archived together. Expected: 200, all restored.
- **Should NOT restore child independently archived before parent cascade** — Pre: child archived May 20, parent archived May 25. Restore parent. Expected: parent + cascade-children restored, pre-archived child stays archived.
- **Should return 200 no-op on restore of already-active module (idempotent)** — Pre: module active. Expected: 200, restore count 0.
- **Should allow write operations on restored module** — Pre: module archived → restored. Expected: POST US, POST ATC, PATCH name all succeed.
- **Should survive full archive→restore→archive→restore cycle** — Pre: active module. Expected: 8 operations, final state = active, 4 activity_log entries.
- **Should exclude archived module from default tree query** — Pre: module archived. Expected: `GET /tree` → module absent.
- **Should include archived module when `?include_archived=true`** — Pre: module archived. Expected: module in tree with `archived: true` flag.
- **Should allow bug filing on archived module** — Pre: module archived. Expected: 201, bug created, module_id = archived module.
- **Should allow Run start on Test referencing archived-module ATCs** — Pre: Test chains archived ATCs. Expected: 201, run starts normally.

#### Negative
- **Should reject rename with empty name** — Pre: name "". Expected: 400 VALIDATION_ERROR.
- **Should reject rename with name too short (1 char)** — Pre: name "A". Expected: 400 VALIDATION_ERROR.
- **Should reject rename with name too long (81 chars)** — Pre: 81-char name. Expected: 400 VALIDATION_ERROR.
- **Should reject rename with no alphanumeric characters** — Pre: name "!!!". Expected: 400 NAME_NO_ALPHANUMERIC.
- **Should reject rename when module not found** — Pre: nonexistent module id. Expected: 404 MODULE_NOT_FOUND.
- **Should reject archive when module not found** — Pre: nonexistent module id. Expected: 404 MODULE_NOT_FOUND.
- **Should reject restore when module not found** — Pre: nonexistent module id. Expected: 404 MODULE_NOT_FOUND.
- **Should reject rename by viewer-role user** — Pre: viewer auth'd. Expected: 403 FORBIDDEN.
- **Should reject archive by viewer-role user** — Pre: viewer auth'd. Expected: 403 FORBIDDEN.
- **Should reject restore by viewer-role user** — Pre: viewer auth'd. Expected: 403 FORBIDDEN.
- **Should reject unauthenticated rename** — Pre: no auth. Expected: 401 UNAUTHORIZED.
- **Should reject unauthenticated archive** — Pre: no auth. Expected: 401 UNAUTHORIZED.
- **Should reject unauthenticated restore** — Pre: no auth. Expected: 401 UNAUTHORIZED.
- **Should reject create-child on archived module** — Pre: parent archived. Expected: 400 PARENT_MODULE_ARCHIVED.
- **Should reject create-US on archived module** — Pre: module archived. Expected: 400 MODULE_ARCHIVED.
- **Should reject create-ATC on archived module** — Pre: module archived. Expected: 400 MODULE_ARCHIVED.

#### Boundary
- **Should accept rename with name at exactly 2 characters** — Pre: name "AB". Expected: 200, name updated.
- **Should accept rename with name at exactly 80 characters** — Pre: 80-char name. Expected: 200, full name stored.
- **Should reject rename with name at 1 character** — Pre: name "A". Expected: 400.
- **Should reject rename with name at 81 characters** — Pre: 81-char name. Expected: 400.
- **Should archive root module (depth 0)** — Pre: root module with 5 children. Expected: 200, all archived, cascade complete.
- **Should archive module at depth 6 (max depth)** — Pre: depth-6 module with entities. Expected: 200, cascade complete.
- **Should archive + restore + archive again (re-archive)** — Pre: active module. Expected: second archive sets fresh timestamp, cascade fires again.
- **Should archive already-archived module return original timestamp** — Pre: module archived at T1. Expected: 200, archived_at = T1 (unchanged).

#### Integration
- **Should rollback entire cascade if any entity update fails** — Pre: simulate DB constraint violation mid-cascade. Expected: no partial archives, transaction rolled back.
- **Should write activity_log row on rename** — Pre: rename succeeds. Expected: activity_log with action "module.renamed", payload "Cart → Shopping Cart".
- **Should write activity_log row on archive with cascade counts** — Pre: archive succeeds. Expected: activity_log with action "module.archived", summary includes cascade counts.
- **Should write activity_log row on restore with restored counts** — Pre: restore succeeds. Expected: activity_log with action "module.restored".
- **Should broadcast Realtime update on project channel after rename/archive/restore** — Pre: mutation succeeds. Expected: project channel subscribers receive update for tree refresh.

#### API
- **Should return 200 with expected shape on PATCH rename** — Pre: valid rename. Expected: { success, data: { id, name, slug, path, ..., updated_at } }.
- **Should return 200 with cascade counts on DELETE archive** — Pre: valid archive. Expected: { success, data: { id, archived_at, cascade: { modules, user_stories, acceptance_criteria, atcs, tests } } }.
- **Should return 200 with restored counts on POST restore** — Pre: valid restore. Expected: { success, data: { id, archived_at: null, restored: { ... } } }.
- **Should return 400 with error envelope for validation failures** — Pre: invalid input. Expected: { success: false, error: { code, message, details? } }.
- **Should return 404 with error envelope for missing resources** — Pre: nonexistent module. Expected: { success: false, error: { code: "MODULE_NOT_FOUND" } }.
- **Should return 401/403 with error envelope for auth failures** — Pre: unauthenticated/forbidden. Expected: { success: false, error: { code: "UNAUTHORIZED" | "FORBIDDEN" } }.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|-----------|-------------------|-------------|--------|
| 1 | Rename to same name (no-op) | No | Medium | Add to AC |
| 2 | Rename to empty/whitespace-only | No | High | Add to AC |
| 3 | Slug change on rename — path cascade to deep subtree | No | Critical (if slug mutable) | Exclude from BK-10 scope — needs separate Story |
| 4 | Slug change on rename — ATC slug recomputation | No | Critical (if slug mutable) | Exclude from BK-10 scope — needs separate Story |
| 5 | Archive leaf module (no children, no entities) | No | Critical | Add to AC |
| 6 | Archive parent with full subtree (modules + US + AC + ATC + Tests) | No | Critical | Add to AC |
| 7 | Archive module at max depth (6) | No | Critical | Add to AC |
| 8 | Double-archive idempotency | No | High | Add to AC |
| 9 | Restore leaf module | No | Critical | Add to AC |
| 10 | Restore parent with cascade-restore of children | No | Critical | Add to AC |
| 11 | Restore does NOT revive independently-archived children | No | High | Add to AC |
| 12 | Restore idempotency (already active) | No | High | Add to AC |
| 13 | Archive → restore → archive again cycle | No | Medium | Add to AC |
| 14 | Restore child when parent is still archived | No | Medium | Add to AC — **NEEDS PO/DEV CONFIRMATION** |
| 15 | Create child/US/ATC on archived module | No | High | Add to AC (Negative) |
| 16 | Bug filing on archived module | No | Medium | Add to AC — **NEEDS PO CONFIRMATION** |
| 17 | Run start on test referencing archived-module ATCs | No | Medium | Add to AC |
| 18 | Concurrent archive from two users | No | Medium | Add to AC |
| 19 | Viewer/unauthenticated access to rename/archive/restore | No | High | Add to AC |
| 20 | Cross-tenant RLS isolation (workspace A cannot archive workspace B's module) | No | Critical | Add to AC |
| 21 | Large subtree archive (100+ entities) — sync vs async | No | Medium | Ask Dev |
| 22 | Activity log should record cascade details in single row | No | Medium | Ask Dev |
| 23 | Realtime broadcast behavior on cascade — individual events or coalesced | No | Low | Ask Dev |
| 24 | Archival timestamp drift — clock skew between archive of parent and cascade to children | No | Low | Test only — verify timestamps within 500ms |

---

## Story Quality Assessment

**Verdict**: **Significant Issues** — single-sentence Story with zero acceptance criteria for three distinct operations (rename, archive, restore), each with cascade implications spanning 5 entity types.

**Key findings**:
- **Slug mutability on rename is the single largest scope decision** — immutable slug (recommended) keeps this Story manageable (~51 outlines). Mutable slug adds path + ATC slug recomputation and at least doubles the test surface.
- **Cascade behavior is well-documented in business-data-map §5** but the Story provides no confirmation. The cascade scope (modules → US → AC → ATC → Tests; NOT bugs or runs) must be codified.
- **Restore semantics are completely undefined** — Model A (cascade restore) vs Model B (module-only) changes test surface by ~40%. Must be resolved before estimation.
- **Archived module interaction rules** (can entities be created under archived modules?) are essential for preventing data-model corruption and are absent from the Story.
- **Three distinct operations** with different validation + cascade profiles suggest this Story could be split: BK-10a (Rename), BK-10b (Archive + Restore). However, the user-provided API contract treats them as one Story.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **Is slug immutable on rename?**
   - **Context**: Changing the slug on rename would require recomputing the materialized `path` for all descendant modules AND all ATC slugs (`{module-slug}/{atc-id-padded}`) in the subtree. This is a massive cascade that doubles the test surface (~51 → ~100+ outlines) and risks breaking ATC lookups, command palette, and permalinks.
   - **Impact if unanswered**: Cannot scope the Story. Immutable slug = rename is a simple name column update. Mutable slug = subtree-wide slug + path + ATC recomputation.
   - **Suggested answer**: Slug is IMMUTABLE on rename. Module name changes are cosmetic; the slug is the stable identifier for API, URLs, and ATC paths. Modules needing a new slug should be archived + re-created. This matches the common pattern (GitHub repo renames preserve the old URL as a redirect).

2. **What is the cascade scope for archive? Which entities get `archived_at` set?**
   - **Context**: Business-data-map §5 says "descendant Modules, US, AC, ATC, Tests." The user request asks for clarification on "child modules, user stories, and ATCs" but omits AC and Tests. Bugs (anchored to module) and Runs (execution history) should NOT be archived.
   - **Impact if unanswered**: Dev may architect a cascade that is too broad (archiving Runs loses history) or too narrow (orphaned US with no active module breaks the tree).
   - **Suggested answer**: Cascade archive to child modules (recursive) → user_stories in subtree → acceptance_criteria in subtree → atcs in subtree → tests in subtree. Do NOT archive bugs, runs, or environments.

3. **Does restoring a module cascade-restore its descendants?**
   - **Context**: Three models: (A) cascade-restore all descendants, (B) restore module only, (C) restore module + children archived in same cascade event. Model A is simplest and most user-expected. Model B is surgically precise but confusing. Model C requires tracking `archived_reason` ("manual" vs "cascade").
   - **Impact if unanswered**: Restore behavior undefined. User restores parent and wonders why children are still archived (Model B) or user restores parent and previously-intentionally-archived children are revived against their will (Model A without timestamp discrimination).
   - **Suggested answer**: Model A + timestamp discrimination — restore parent + all descendants, BUT skip any descendant whose `archived_at` is significantly earlier than the parent's archive timestamp (independently archived). This revives what the cascade killed while respecting prior independent actions.

4. **Can entities (US, ATC, Tests) be created under an archived module?**
   - **Context**: If writes are allowed on archived modules, the "clean active workspace" goal of archiving is undermined. If writes are blocked, the archive gate must be enforced at the API validation layer.
   - **Impact if unanswered**: Without this rule, users create content under archived modules, it's invisible in the default tree, and they think the system lost their work.
   - **Suggested answer**: Write operations BLOCKED on archived modules. POST US/ATC with archived `module_id` → 400 `MODULE_ARCHIVED`. POST test with archived ATCs in chain → 400. Runs on existing tests with archived ATCs → allowed (execution history survives). Bugs on archived modules → allowed (defects in archived features need tracking).

5. **Are archived modules visible in the default tree view?**
   - **Context**: The left-pane tree is the primary navigation. If archived modules appear, they clutter active work. If hidden, users need a toggle to find and restore them.
   - **Impact if unanswered**: UI test scenarios for tree rendering are blocked.
   - **Suggested answer**: Hidden by default. Toggle "Show Archived" reveals greyed-out archived modules with their archived children. Restore action available in context menu when archived module is selected.

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **Sync or async cascade for large subtrees?**
   - **Context**: A module subtree with 100+ entities (modules + US + AC + ATC + Tests) may exceed Postgres transaction timeouts in a single `DELETE` call. Bunkai is a greenfield project with no load data, so this is a design decision, not a retroactive optimization.
   - **Testing impact**: If sync, test with 500-entity subtree to verify no timeout. If async, test 202 + polling endpoint + cascade completion.

2. **How does the system distinguish "archived by cascade" from "archived independently" for restore discrimination?**
   - **Context**: Restore Model A (recommended) needs to skip independently-archived children. Options: (A) timestamp comparison (same second ≈ same cascade — fragile under clock skew), (B) `archived_reason` column ("manual" | "cascade"), (C) `archive_batch_id` linking parent + children in one cascade event.
   - **Testing impact**: Determines how test assertions verify "child stays archived after parent restore."

3. **Does the cascade happen in a Postgres trigger, a stored procedure, or application-layer code?**
   - **Context**: In-transaction correctness depends on this. A trigger cascades atomically but is harder to debug. Application-layer code is more testable but risks partial writes if error handling is incomplete.
   - **Testing impact**: Trigger-based cascade is tested via DB state assertions. App-layer cascade requires integration tests covering error paths.

4. **Is `Idempotency-Key` supported on `PATCH`, `DELETE`, and `POST /restore`?**
   - **Context**: BK-037 applies to "all write endpoints." Archive + restore are destructive in a business sense (even though soft).
   - **Testing impact**: If supported, add idempotency scenarios for retry safety. If not, network retries could double-archive or double-restore.

5. **What is the `modules` table schema for BK-10 relevant columns?**
   - **Context**: BK-9 context.md lists: `id, project_id, parent_module_id, name, slug, path, depth, position, archived_at, created_at, updated_at`. Confirm `archived_at` column type (TIMESTAMPTZ with NULL = active). Any additional columns needed for cascade tracking (`archived_reason`, `archive_batch_id`)?
   - **Testing impact**: DB state assertions need the full column list.

6. **How are `GET /modules` and `GET /projects/{id}/tree` queries affected by `archived_at`?**
   - **Context**: Listing endpoints default-filter `archived_at IS NULL` (FEAT-046). `?include_archived=true` opts in. How is this implemented — WHERE clause in every query, RLS policy, or a view?
   - **Testing impact**: Every list/tree integration test needs to toggle the filter.

7. **Does Realtime broadcast individual events per archived entity or a coalesced event?**
   - **Context**: Archiving a module with 50 child entities could fire 50 Realtime events, causing UI flicker. A coalesced event ("subtree-archived") is gentler on the client.
   - **Testing impact**: Realtime integration test behavior depends on this.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | Single-sentence Story | Write explicit ACs: AC1-Rename, AC2-Archive with cascade, AC3-Restore with cascade (3 ACs, ~25 scenarios total) | Dev has contract. QA can test. PO can estimate. |
| 2 | Slug mutability unresolved | Explicitly state: "Module slug is immutable on rename. Rename changes `name` only." | Removes single largest scope ambiguity. Keeps Story estimable. Slug change becomes a separate Story if needed. |
| 3 | Cascade scope not specified | Explicit cascade list: "Archive sets `archived_at` on: all descendant modules (recursive), user_stories in subtree, acceptance_criteria in subtree, atcs in subtree, tests in subtree." | Dev knows exactly which tables to touch. QA knows exactly what to assert. |
| 4 | No error catalog | Add error codes: 400 NAME_VALIDATION_ERROR, NAME_NO_ALPHANUMERIC; 400 MODULE_ARCHIVED (writes blocked), PARENT_MODULE_ARCHIVED; 404 MODULE_NOT_FOUND; 401 UNAUTHORIZED; 403 FORBIDDEN | Consistent error surface across endpoints. |
| 5 | Restore semantics undefined | Specify: "Restore clears `archived_at` on the target module AND cascades to all descendants archived by the same cascade event. Descendants that were independently archived (significantly earlier timestamp) remain archived." | Clear restore behavior. No ambiguity for Dev or QA. |
| 6 | No DoD items | Add to Definition of Done: "OpenAPI spec updated with PATCH modules/{id}, DELETE modules/{id}, POST modules/{id}/restore", "Cascade logic covered by integration tests", "Tree query supports `?include_archived=true`", "Restore does not revive independently-archived children" | Clear completion criteria. |
| 7 | Consider splitting Story | Split into BK-10a (Rename — simple column update, ~15 outlines) and BK-10b (Archive + Restore — cascade logic, ~36 outlines). | Smaller Stories = faster estimation, lower risk, parallel development. |

---

## Data feasibility flags

- **`modules.archived_at` column must exist** — confirm schema includes this column before implementation. BK-9 create likely sets up the `modules` table; `archived_at` must be part of the schema.
- **`archived_at` columns on `user_stories`, `acceptance_criteria`, `atcs`, `tests`** — these tables must have the `archived_at` column for cascade to work. Must be confirmed as part of schema setup.
- **No pre-existing Module data** — all test data must be generated: create projects (BK-8), create modules with depth chains (BK-9), create US/AC/ATC/Tests inside modules, then test rename/archive/restore against them.
- **Cascade test fixtures require multiple entity types** — test setup needs helper fixtures that create module trees with populated US/AC/ATC/Tests. At least 3 levels deep with varied entity counts for cascade validation.
- **No live staging endpoints** — all testing will be against freshly-implemented endpoints in `/project-bootstrap`.

---

## Recommended testing strategy

### Pre-implementation
- PO must answer the 5 Critical Questions before sprint planning. Slug immutability is the blocker.
- Dev must confirm cascade scope, restore semantics, and `archived_at` column presence on all 5 entity tables.
- Define `api-contracts.yaml` entries for `PATCH /modules/{id}`, `DELETE /modules/{id}`, `POST /modules/{id}/restore`.
- Extract shared name validation (Zod schema) from BK-9 create — reuse the same rules for rename.

### During implementation
- Unit test name validation on PATCH (reuse BK-9 validation suite).
- Integration test: rename module → verify name changed, slug + path unchanged.
- Integration test: archive leaf module → verify `archived_at` set, no cascade.
- Integration test: archive parent with subtree → verify all expected entities archived, cascade counts accurate.
- Integration test: restore parent → verify cascade restore, independently-archived children skipped.
- Integration test: full cycle (archive → restore → archive → restore) → verify final state correct.
- Contract test: validate request/response shapes against OpenAPI spec.

### Post-implementation (in-sprint by /sprint-testing)
- Execute all 51 outlines defined in Phase 4 (with parametrization expanded by sprint-testing).
- End-to-end test: Journey 1 Step 3 mutation — create Project → create Module tree → rename root module → rename child module → archive sub-branch → verify tree excludes it → restore → verify tree includes it.
- Cascade integrity test: create deep module tree with 3 levels × varied entity counts → archive root → query each table → verify all expected `archived_at` set.
- Tree query test: archive branches → query `GET /tree` default → query `GET /tree?include_archived=true` → verify exclusion/inclusion correctness.
- Cross-tenant RLS test: archive module in workspace A → workspace B user attempts same operation on A's module ID → 404.

---

## Next steps

- [ ] PO answers Critical Questions before sprint planning
- [ ] Dev answers Technical Questions before estimation
- [ ] ACs codified from Phase 3 refined scenarios (confirmed by PO)
- [ ] Slug immutability decision documented in Story description
- [ ] Cascade scope confirmed and documented
- [ ] Story enters sprint at status `estimation` once estimated
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected)
