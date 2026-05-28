# Shift-Left Refinement: BK-9 — Create Modules (with nested sub-modules) inside a Project

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-05-27
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context
- **Primary persona affected**: Elena (QA Engineer) — builds the Module taxonomy under a Project as part of the setup flow
- **Secondary personas (if any)**: Mateo (QA Lead) — may configure Modules for reporting rollup; Karim (agent) — navigates Module tree via API for test discovery
- **Business value proposition**: Modules are the organizational backbone of a Project — every User Story, ATC, Test, and Bug is anchored to a Module. Without Modules, the tree navigation (left pane) is empty, defect heatmaps have no rollup axis, and the "one-edit-many-tests" traceability chain cannot be organized. Module creation is Step 3 of Journey 1 (Setup flow), immediately after Project creation.
- **KPI(s) influenced**: Time-to-first-ATC (cannot create ATCs without a Module), module coverage % (Modules with ≥1 ATC / total Modules), defect heatmap completeness
- **User journey position**: Flow 1 (Setup), Step 3. After creating a Project, Elena builds the Module tree: root-level modules like `/cart`, `/payment`, then nested sub-modules like `/cart/add-to-cart`, `/cart/remove-from-cart`. This is the taxonomy that organizes everything downstream — US, AC, ATC, Tests, Bugs.

### Technical context
- **Frontend**: Module editor (drawer inside Project View). Components: Input (name), Select (parent module — tree browser), position preview (inline at end of sibling list). Form validation: Zod schema, field `project_id` (from URL), `name` (2–80 chars), `parent_module_id?`, `position?`. Route: `/{workspace_slug}/{project_slug}` → open Module create drawer.
- **Backend**: `POST /api/v1/projects/{id}/modules` (or `POST /api/v1/modules` per business-feature-map §4.4). Body: `{ name, parent_module_id?, position? }` → 201 `{ id, name, slug, path, parent_module_id, position, depth, children_count }`. FR: BK-006. Auth: Bearer (member+). Side effects: INSERT `modules` with materialized `path` computed; `activity_log` row; Realtime broadcast on project channel to refresh tree.
- **DB tables**: `modules` (id, project_id, parent_module_id, name, slug, path, depth, position, archived_at, created_at, updated_at), `activity_log`.
- **External services**: None.
- **Integration points specific to this Story**:
  - Auth middleware → verifies user is member+ of the workspace containing the project.
  - Project existence validation → 404 if project not found.
  - Parent module existence + project-scope validation → parent must belong to same project.
  - Tree integrity → depth check (≤6), circular-parent guard, position auto-assignment at end of sibling list.
  - Materialized `path` computation → auto-derived on INSERT/PATCH parent change.
  - `activity_log` append → `action = "module.created"`, `entity_type = "module"`.
  - Realtime broadcast → row published to `project_id` channel for live tree refresh.

### Story complexity
| Axis | Rating | Why |
|------|--------|-----|
| Business logic | Medium | Slug derivation (like workspaces), depth-limit enforcement (≤6), circular-parent detection via recursive lookup, position ordering within sibling list, path materialization. Non-trivial but well-bounded. |
| Integration | Low | Single internal DB transaction (modules + activity_log). No external service calls. Realtime broadcast is infrastructure-level. |
| Data validation | Medium-High | Name validation (2–80 chars, alphanumeric requirement), slug uniqueness (project-scoped), parent validation (exists, same project, not self, not descendant), depth enforcement (≤6), position conflict resolution. |
| UI | Medium | Module create drawer (name + parent selector + position preview). Parent selector is a tree-browser component (select from existing modules in project) — this is the main UI complexity. |

**Estimated test effort**: ~2–3 person-hours (manual exploratory) + ~6–8 person-hours (automated tests, ~30 outlines with parametrization). Informs PO estimation.

### Epic-level inheritance (if applicable)
- **Epic**: EPIC-BK-002 — Project & Module Hierarchy
- **Risks restated at Story level**:
  - Module tree corruption (circular parent, depth overflow) breaks the left-side navigation and renders downstream entities inaccessible.
  - Slug collision within a project creates navigation ambiguity (two modules with URL-identical paths).
- **Integration points inherited**: Supabase Auth (user identity), activity log (audit trail), Realtime (tree refresh).
- **PO/Dev answers already given at epic level**:
  - Module nesting depth ≤ 6, soft warning at 4 (from business-data-map.md §2).
  - Materialized `path` column format: `/parent-slug/child-slug` for breadcrumbs and subtree queries.
  - Soft-delete via `archived_at` with cascade to descendant Modules + child entities (BK-039).
  - Module slug is project-scoped unique (not global like workspace slugs).
- **Test strategy inherited**: Hierarchy validation (depth, circularity, parent scope), tree integrity after CRUD operations, Realtime propagation.

---

## Phase 2 — Story Quality Analysis

### Ambiguities
| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|-------------------|---------------------|-------------------|------------------------|
| 1 | Story is a single sentence: "Create Modules (with nested sub-modules) inside a Project" | What is the complete AC list? The Story has zero explicit acceptance criteria. | Cannot derive test scenarios without ACs. Every scenario below is inferred from domain context. | Write explicit ACs covering: create root module, create nested module, depth limit enforcement, circular parent rejection, slug uniqueness, position behavior, error responses. |
| 2 | Endpoint design mismatch | `business-feature-map.md` §4.4 shows `POST /modules` (root-level resource with `project_id` in body). User-provided contract proposes `POST /api/v1/projects/{id}/modules` (nested resource). Which is canonical? | Frontend route builders and API contract depend on this decision. | Adopt `POST /api/v1/projects/{id}/modules` (nested) — more RESTful, project scope is explicit in URL, matches `POST /workspaces/{id}/invites` pattern. Update `business-feature-map.md` accordingly. |
| 3 | Slug uniqueness scope | Is slug unique within the project OR within the parent module (siblings only)? E.g., can `/cart/add-to-cart` and `/payment/add-to-cart` coexist? | Affects slug collision test data. If project-scoped, two modules cannot share a slug even at different depths. If parent-scoped, only sibling names must differ. | Project-scoped uniqueness (as per business-data-map §2 "module path project-scoped"). The path column makes sibling-level uniqueness irrelevant for routing, but project-scoped slugs prevent confusion in API endpoints like `GET /modules/{module_slug}`. |
| 4 | Position behavior | Is position auto-assigned (last in sibling list) or explicitly supplied? If supplied, what happens on collision — reorder siblings, reject, or shift? | Cannot test position ordering without knowing the insertion strategy. | Auto-assign position = `MAX(position) + 1` within parent when not supplied. If explicitly supplied and collides, shift existing siblings (increment positions ≥ new position). |
| 5 | Path format | The materialized `path` column is described as `/cart/add-to-cart`. Does this include the root? Is it `/module-slug` or just `module-slug` for root modules? | Path assertion in test scenarios depends on exact format. | Root module path = `/{slug}`. Nested module path = `{parent.path}/{slug}`. E.g., root `/cart`, child `/cart/add-to-cart`. |
| 6 | Move operation scope | Does this Story cover module MOVE (changing parent_module_id via PATCH), or only CREATE? The title says "Create Modules" but FEAT-006 includes "move." | If move is out of scope, depth/circularity tests only apply to create. If move is in scope, PATCH validation must also enforce depth + circularity on parent change. | Confirm scope. If CREATE only in this Story, MOVE is a separate Story. If both, this Story should cover both create AND parent-module-change on PATCH. **Recommend**: CREATE only; MOVE as separate Story (BK-9b or BK-10) — it has distinct validation complexity (recompute path, children paths cascade, position rebalance). |
| 7 | Name character restrictions | What characters are allowed in module names? Same as workspace names (alphanumeric + spaces + hyphens)? Are slashes `/` allowed? | Boundary tests for name validation need character class definition. | ASCII alphanumeric + spaces + hyphens + underscores. NO slashes (interfere with path). Same sluggification rules as workspaces (lowercase, kebab-case, accents stripped, no leading/trailing hyphens). |
| 8 | Duplicate name at same level | Can two sibling modules have the same display name if slugs differ? E.g., "Checkout" and "Checkout" → slugs "checkout" and "checkout-1"? | Determines slug dedup strategy. | Default: project-scoped slug uniqueness (Ambiguity #3). If two modules attempt the same slug, reject the second with 409 `SLUG_NOT_UNIQUE` unless auto-suffix is implemented. **NEEDS PO/DEV CONFIRMATION**. |

### Gaps (missing info)
| # | Type | Why critical | What to add | Risk if omitted |
|---|------|--------------|-------------|-----------------|
| 1 | AC | No acceptance criteria exist. The Story is a single sentence. | Write a full AC set: AC1 (Create root module), AC2 (Create nested sub-module), AC3 (Depth limit enforcement), AC4 (Circular parent rejection), AC5 (Slug auto-derivation + uniqueness), AC6 (Position ordering), AC7 (Parent module validation). Minimum 7 ACs. | QA cannot design test scenarios. Dev has no contract to implement against. PO cannot estimate. |
| 2 | AC | No error responses specified for any validation failure. | Error catalog per validation rule: 400 VALIDATION_ERROR (name too short/long, no alphanumeric), 404 PROJECT_NOT_FOUND, 404 PARENT_MODULE_NOT_FOUND, 400 MODULE_CIRCULAR_PARENT, 400 MODULE_MAX_DEPTH, 409 SLUG_NOT_UNIQUE, 401 UNAUTHORIZED. | Negative test scenarios are blocked. Inconsistent error codes across endpoints. |
| 3 | AC | No AC for depth limit enforcement. The business-data-map says depth ≤ 6, soft warning at 4, but there is no testable scenario. | Add Negative scenario: Given a module at depth 6, When user creates a child module, Then reject with 400 `MODULE_MAX_DEPTH`. | Modules could be nested infinitely, breaking tree render performance and the heatmap rollup query. |
| 4 | AC | No AC for circular-parent guard. | Add Negative scenario: Given Module A is a child of Module B, When user attempts to set Module B's parent to Module A (or any descendant), Then reject with 400 `MODULE_CIRCULAR_PARENT`. | Circular module graphs break recursive CTEs (infinite loop), crash the tree view, and corrupt materialized paths. |
| 5 | AC | No AC for parent module belonging to a different project. | Add Negative scenario: Given Module X belongs to Project A, When user creates a module in Project B with `parent_module_id = X`, Then reject with 400 `PARENT_MODULE_WRONG_PROJECT`. | Cross-project module references break RLS isolation and the tree query. |
| 6 | AC | No AC for module slug uniqueness within project. | Add Negative scenario: Given a module with slug "cart" exists in project, When user creates another module named "Cart" in the same project, Then reject with 409 `SLUG_NOT_UNIQUE` (or auto-suffix). | Duplicate slugs break navigation, API lookups by slug, and the command palette. |
| 7 | AC | No AC for path column computation. | Add Positive scenario: Given a root module "cart", When a child "add-to-item" is created, Then `modules.path = "/cart/add-to-item"` is computed and stored. | If path is not computed, breadcrumbs, subtree queries, and the tree view all break. |
| 8 | AC | No AC for the list/tree endpoint. Module creation is meaningless without a way to read it. | Add `GET /api/v1/projects/{id}/modules` — return flat list or tree. Clarify whether this endpoint returns all modules in the project or supports `?parent_id=` filter. | Frontend cannot render the module tree after creation. |
| 9 | Technical detail | `modules` table schema has no `depth` column in the entity quick-reference (business-data-map §2), but depth enforcement is mentioned. How is depth computed — from `parent_module_id` traversal or a stored column? | Implementation and test assertions need to know this. | Dev may compute depth on-the-fly (slow) or store it redundantly (fast, denormalized). Stored depth is recommended for the tree query. |
| 10 | Technical detail | Realtime broadcast mechanism for module tree updates. Is it the same `project_id` channel as for runs/bugs (BK-040)? | Integration tests for Realtime need the channel name. | Confirm: module INSERT/UPDATE publishes on `project_id` channel to all subscribed clients for live tree refresh. |

### Edge cases not in Story
| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|----------|-------------------------------|-------------|--------|
| 1 | Create module with name containing only special characters (e.g., `!!!`, `---`) | Reject with 400 `NAME_NO_ALPHANUMERIC` (same as workspaces) | High | Add to AC |
| 2 | Create module with name producing empty slug (e.g., emoji-only: `😀😀😀`) | Reject with 400 `SLUG_EMPTY` or `NAME_NO_ALPHANUMERIC` | Medium | Add to AC — same pattern as BK-4 workspace creation |
| 3 | Create module with name at exact max length (80 chars) | Accept. Slug truncated to max slug length (60 chars?). Full 80-char name stored. | High | Add to AC (Boundary) |
| 4 | Create module at depth 6 → attempt depth 7 child | Reject with 400 `MODULE_MAX_DEPTH`. Soft warning at depth 4 (UI toast only, not API rejection). | Critical | Add to AC |
| 5 | Create module with `parent_module_id` pointing to self (create root module, then PATCH its own parent to itself) | Reject with 400 `MODULE_CIRCULAR_PARENT` | High | Add to AC |
| 6 | Two concurrent requests creating sibling modules with explicit same position | Both should succeed — second one shifted. If position collision is handled by DB constraint, one should fail gracefully. | Medium | Ask Dev — transaction-level conflict resolution |
| 7 | Create module with `parent_module_id` pointing to a soft-deleted (archived) module | Reject with 400 `PARENT_MODULE_ARCHIVED`. Archived modules cannot have children. | Medium | Add to AC |
| 8 | Create module with name containing slashes (e.g., "cart/checkout") | Slash stripped during sluggification OR rejected. If stripped, name "cart/checkout" → slug "cart-checkout". | Medium | Add to AC — decide strip vs reject |
| 9 | Create module with `position` out of bounds (e.g., 99999 when only 3 siblings exist) | Position clamped to `MAX(position) + 1` OR placed at specified position and gaps ignored. | Low | Ask Dev — position normalization strategy |
| 10 | Create module with no name field in body | Reject with 400 `VALIDATION_ERROR` "name is required" | High | Add to AC |
| 11 | Create module with empty name string | Reject with 400 `VALIDATION_ERROR` "name must be between 2 and 80 characters" | High | Add to AC (Boundary) |
| 12 | Create module with Unicode/accented name (e.g., "Módulo de Prueba") | Accept. Slug = "modulo-de-prueba" (accents stripped, same normalization as workspaces). | Medium | Add to AC |
| 13 | Create module at root level (no `parent_module_id`) | Accept. `depth = 0`. `path = "/{slug}"`. | Critical | Add to AC — this is the primary happy path |
| 14 | Create deeply nested module chain: root → L1 → L2 → L3 → L4 → L5 → L6 | Each level succeeds. Depth 6 is the maximum. | Critical | Add to AC (Boundary) |
| 15 | Rapid double-submit (user clicks "Create" twice) | Idempotency: second request returns existing module row OR is rejected. Does `Idempotency-Key` apply? | Medium | Ask Dev — same idempotency question as BK-4 |

### Contradictions
| # | Source A | Source B | Conflict | Resolution needed |
|---|----------|----------|-----------|-------------------|
| 1 | User-provided contract: `POST /api/v1/projects/{id}/modules` | `business-feature-map.md` §4.4: `POST /modules` (root-level resource) | Endpoint path design — nested vs flat resource. | Adopt nested design (`/projects/{id}/modules`) — consistent with `/workspaces/{id}/invites`, explicit project scope in URL, avoids `project_id` body injection attacks. Update feature-map. |
| 2 | `business-feature-map.md` §5.2: Module form mandatory field `project_id` | `business-feature-map.md` §4.4: `POST /modules` (no `project_id` in path) | If endpoint is `/projects/{id}/modules`, `project_id` comes from the URL, not the body. | Align with nested design. Form Zod schema: `project_id` extracted from route param, not body. |
| 3 | `business-data-map.md` §2: "Module depth ≤ 6, soft warning at 4" | No FR or AC in Story mentions these rules. | The canonical business rule exists but the Story is blank. | Add both rules to AC. Soft warning = UI-level toast only, not API rejection. |

### Testability validation
**Verdict**: No — Story has zero ACs

Issues:
- **No acceptance criteria** — single-sentence Story provides no testable contract.
- **No error catalog** — 7+ validation rules implied by domain context but no error codes, messages, or status codes specified.
- **Endpoint design unresolved** — contradiction between user contract and feature-map.
- **No test data examples** — no valid/invalid name examples, no depth chain examples, no circularity examples.
- **Position strategy unspecified** — auto-assign, explicit, collision handling all undefined.
- **Path format not confirmed** — root module path format (`/slug` or `slug`) unconfirmed.
- **Slug uniqueness scope ambiguous** — project-wide vs sibling-only.

---

## Phase 3 — Refined Acceptance Criteria

> **Note**: ALL scenarios below are inferred from domain context (business-data-map.md §2, business-feature-map.md FEAT-006, user-provided API contract). Every scenario is marked **NEEDS PO/DEV CONFIRMATION** because the Story has zero original ACs.

### AC1 — Create root-level module (NEEDS PO/DEV CONFIRMATION)

#### Scenario 1.1: Should create a root-level module with valid name (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**: entire AC is inferred
- **Given**: Project "Checkout v2" exists with id `proj-01` in workspace "bunkai-team". Authenticated user is a member+. No module with slug "cart" exists in this project.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "Cart" }`
- **Then**:
  - UI: Module appears in the project tree (left pane) as top-level node. Drawer closes with success toast.
  - API: `201 { "success": true, "data": { "id": "<uuid>", "name": "Cart", "slug": "cart", "path": "/cart", "parent_module_id": null, "depth": 0, "position": 1, "children_count": 0, "project_id": "proj-01", "created_at": "<ISO>", "updated_at": "<ISO>" } }`
  - DB: `modules` row with `project_id=proj-01, slug="cart", path="/cart", depth=0, position=<last_in_root_siblings + 1>, parent_module_id=null`. `activity_log` row with `action="module.created"`.
  - System state: Realtime broadcast on `project_id=proj-01` channel → tree view refreshes.

#### Scenario 1.2: Should reject module creation when name is too short (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Project exists. Authenticated user.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "A" }` (1 char)
- **Then**: `400 { "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Module name must be between 2 and 80 characters", "details": [{"field": "name", "message": "Must be at least 2 characters"}] } }`. No DB change.

#### Scenario 1.3: Should reject module creation when name is too long (Type: Boundary, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Project exists. Authenticated user.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "<81 chars>" }`
- **Then**: `400` VALIDATION_ERROR "Must be at most 80 characters". No DB change.

#### Scenario 1.4: Should reject module creation when name has no alphanumeric characters (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Project exists. Authenticated user.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "!!! @@@" }`
- **Then**: `400 { "success": false, "error": { "code": "NAME_NO_ALPHANUMERIC", "message": "Module name must contain at least one alphanumeric character" } }`. No DB change.

#### Scenario 1.5: Should reject module creation when name is empty (Type: Boundary, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Project exists. Authenticated user.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "" }`
- **Then**: `400` VALIDATION_ERROR "name is required". No DB change.

#### Scenario 1.6: Should reject module creation when project does not exist (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Project `proj-999` does not exist. Authenticated user.
- **When**: `POST /api/v1/projects/proj-999/modules` with body `{ "name": "Cart" }`
- **Then**: `404 { "success": false, "error": { "code": "PROJECT_NOT_FOUND", "message": "Project not found" } }`. No DB change.

#### Scenario 1.7: Should reject unauthenticated requests (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: No valid auth token.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "Cart" }`
- **Then**: `401 { "success": false, "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }`. No DB change.

---

### AC2 — Create nested sub-module (NEEDS PO/DEV CONFIRMATION)

#### Scenario 2.1: Should create a child module under an existing parent (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Root module "Cart" exists with id `mod-cart`, slug "cart", path "/cart", depth 0. Authenticated user.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "Add to Cart", "parent_module_id": "mod-cart" }`
- **Then**:
  - API: `201 { "id": "<uuid>", "name": "Add to Cart", "slug": "add-to-cart", "path": "/cart/add-to-cart", "parent_module_id": "mod-cart", "depth": 1, "position": 1, "children_count": 0 }`
  - DB: `modules` row with `parent_module_id=mod-cart, path="/cart/add-to-cart", depth=1`. Parent module `children_count` incremented to 1.

#### Scenario 2.2: Should reject creation when parent module does not exist (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module `mod-999` does not exist.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "Test", "parent_module_id": "mod-999" }`
- **Then**: `404 { "success": false, "error": { "code": "PARENT_MODULE_NOT_FOUND", "message": "Parent module not found" } }`. No DB change.

#### Scenario 2.3: Should reject creation when parent module belongs to a different project (Type: Negative, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" exists in Project A (proj-01). Project B (proj-02) exists. Authenticated user.
- **When**: `POST /api/v1/projects/proj-02/modules` with body `{ "name": "Test", "parent_module_id": "<mod-cart-from-proj-01>" }`
- **Then**: `400 { "success": false, "error": { "code": "PARENT_MODULE_WRONG_PROJECT", "message": "Parent module does not belong to this project" } }`. No DB change.

#### Scenario 2.4: Should reject creation when parent module is archived (Type: Negative, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Legacy" is soft-deleted (`archived_at` is set). Authenticated user.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "Child", "parent_module_id": "<legacy-module-id>" }`
- **Then**: `400 { "success": false, "error": { "code": "PARENT_MODULE_ARCHIVED", "message": "Cannot add children to an archived module" } }`. No DB change.

---

### AC3 — Depth limit enforcement (NEEDS PO/DEV CONFIRMATION)

#### Scenario 3.1: Should reject creation at depth 7 (exceeds max depth of 6) (Type: Negative, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: A module chain exists with depth 6: root(L0) → L1 → L2 → L3 → L4 → L5 → L6. L6 is `mod-depth6`.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "Too Deep", "parent_module_id": "mod-depth6" }` (would be depth 7)
- **Then**: `400 { "success": false, "error": { "code": "MODULE_MAX_DEPTH", "message": "Maximum module nesting depth of 6 exceeded" } }`. No DB change.

#### Scenario 3.2: Should allow creation at depth 6 (max allowed depth) (Type: Boundary, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: A module chain exists: root(L0) → L1 → L2 → L3 → L4 → L5 (depth 5). L5 is `mod-depth5`.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "Deepest", "parent_module_id": "mod-depth5" }` (would be depth 6)
- **Then**: `201`. Module created at depth 6. Path = `"/root/l1/l2/l3/l4/l5/deepest"`.

#### Scenario 3.3: Should show soft warning at depth 4 (Type: Positive, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: is this a UI-only concern?
- **Given**: Module at depth 3. Authenticated user in UI.
- **When**: User creates a child module at depth 4.
- **Then**: API returns `201` normally. UI shows soft warning toast: "Module nesting is getting deep (level 4). Consider flattening your hierarchy." **API does NOT reject**.

---

### AC4 — Circular-parent guard (NEEDS PO/DEV CONFIRMATION)

#### Scenario 4.1: Should reject direct circular parent (self-reference) (Type: Negative, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" exists with id `mod-cart`.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "X", "parent_module_id": "mod-cart" }` and then `PATCH /api/v1/modules/mod-cart` with `{ "parent_module_id": "<new-child-id>" }` — attempting to make "Cart" a child of its own child.
- **Then**: `400 { "success": false, "error": { "code": "MODULE_CIRCULAR_PARENT", "message": "Cannot set parent to a descendant module" } }`. No DB change.
- **Note**: direct self-reference (`parent_module_id` = own `id`) is trivially rejected.

#### Scenario 4.2: Should reject indirect circular parent (descendant becomes parent) (Type: Negative, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Chain: "Cart" (L0) → "Add to Cart" (L1) → "Form" (L2).
- **When**: Attempt to `PATCH /api/v1/modules/<cart-id>` with `{ "parent_module_id": "<form-id>" }` (Cart becomes child of Form, which is its grandchild).
- **Then**: `400 MODULE_CIRCULAR_PARENT`. Recursive CTE detects the loop. No DB change.

---

### AC5 — Slug auto-derivation and uniqueness (NEEDS PO/DEV CONFIRMATION)

#### Scenario 5.1: Should auto-derive kebab-case slug from name (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Project exists. Authenticated user.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "My Module Name" }`
- **Then**: Server derives slug `"my-module-name"`. Same sluggification rules as workspaces: lowercase, spaces → hyphens, accents stripped, leading/trailing hyphens trimmed, max 60 chars.

#### Scenario 5.2: Should reject creation when slug already exists in the same project (Type: Negative, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" exists with slug "cart" in project proj-01.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "CART" }` (different case, same slug)
- **Then**: `409 { "success": false, "error": { "code": "SLUG_NOT_UNIQUE", "message": "A module with this slug already exists in the project" } }`. No DB change.

#### Scenario 5.3: Should allow same slug in different projects (Type: Positive, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" (slug "cart") exists in Project A. Project B exists.
- **When**: `POST /api/v1/projects/proj-B/modules` with body `{ "name": "Cart" }`
- **Then**: `201`. Slug "cart" is unique per project, not global.

#### Scenario 5.4: Should compute materialized path from parent path + slug (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Parent module with path "/cart". New slug = "add-item".
- **When**: Module created with `parent_module_id = <cart-id>` and `name = "Add Item"`.
- **Then**: `modules.path = "/cart/add-item"`. Path is derived, not user-input.

---

### AC6 — Position ordering within parent (NEEDS PO/DEV CONFIRMATION)

#### Scenario 6.1: Should auto-assign position at end of sibling list when not specified (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" has 2 children at positions 1 and 2.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "New Child", "parent_module_id": "<cart-id>" }` (no position)
- **Then**: `201`. New module gets `position = 3` (MAX + 1).

#### Scenario 6.2: Should accept explicit position and shift existing siblings (Type: Positive, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: does the API shift siblings or reject on collision?
- **Given**: Module "Cart" has 3 children at positions 1, 2, 3.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "Priority", "parent_module_id": "<cart-id>", "position": 2 }`
- **Then**: `201`. New module inserted at position 2. Existing siblings at positions ≥ 2 shifted: 2→3, 3→4. New order: pos1, new(pos2), old-pos2(pos3), old-pos3(pos4). **NEEDS PO/DEV CONFIRMATION**.

#### Scenario 6.3: Should handle position at 0 or negative (Type: Boundary, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Valid parent exists.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "Test", "parent_module_id": "<id>", "position": 0 }` or `position: -1`
- **Then**: `400 { "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Position must be a positive integer" } }`. No DB change.

---

### AC7 — List modules in project (NEEDS PO/DEV CONFIRMATION)

#### Scenario 7.1: Should list all modules in a project (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Project proj-01 has 3 modules: "Cart" (root), "Add to Cart" (child of Cart), "Payment" (root). Authenticated user.
- **When**: `GET /api/v1/projects/proj-01/modules`
- **Then**: `200 { "success": true, "data": [...] }`. Response includes all 3 modules with full details (id, name, slug, path, parent_module_id, depth, position, children_count). **NEEDS PO/DEV CONFIRMATION**: flat list or nested tree? Include `?format=tree` vs `?format=flat` query param?

#### Scenario 7.2: Should return empty list for project with no modules (Type: Boundary, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Project proj-01 has zero modules.
- **When**: `GET /api/v1/projects/proj-01/modules`
- **Then**: `200 { "success": true, "data": [] }`. No error.

---

### New scenarios surfaced from Phase 2 edge cases — NEEDS PO/DEV CONFIRMATION

#### Scenario E1: Should create module with Unicode name (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: normalization strategy same as workspaces?
- **Given**: Project exists. Authenticated user.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "Módulo de Prueba" }`
- **Then**: `201`. Slug = `"modulo-de-prueba"` (NFKD normalization, accents stripped).

#### Scenario E2: Should reject name with slashes (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: strip or reject?
- **Given**: Project exists. Authenticated user.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "cart/checkout" }`
- **Then**: Either `201` with slug `"cart-checkout"` (slash → hyphen) OR `400` with "name cannot contain slashes". **Recommend reject**: slashes in names are confusing in the tree.

#### Scenario E3: Should create module with max-length name (80 chars) (Type: Boundary, Priority: High)
- **Given**: Project exists. Authenticated user.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "<80 alphanumeric chars>" }`
- **Then**: `201`. Full name stored. Slug may be truncated at 60 chars.

#### Scenario E4: Should handle rapid duplicate creation (idempotency) (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: `Idempotency-Key` support?
- **Given**: User clicks "Create" twice before first response returns.
- **When**: Two `POST` requests with same body arrive within 100ms.
- **Then**: With `Idempotency-Key`: second request returns `200` with the same module. Without: one succeeds, second gets `409 SLUG_NOT_UNIQUE`. **Recommend**: support Idempotency-Key per BK-037.

#### Scenario E5: Should reject viewer-role user from creating modules (Type: Negative, Priority: High)
- **Given**: Sara is a `viewer` in the workspace.
- **When**: `POST /api/v1/projects/proj-01/modules` with body `{ "name": "Cart" }`
- **Then**: `403 { "success": false, "error": { "code": "FORBIDDEN", "message": "Member role or higher required to create modules" } }`. No DB change.

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate
| Type | Count | Notes |
|------|-------|-------|
| Positive | 8 | Create root module, create nested module, create at max depth (6), create with explicit position, slug derivation (kebab, accents), path computation, list modules, Unicode name |
| Negative | 14 | Name too short, name too long, name empty, name no alphanumeric, name with slashes, project not found, parent not found, parent wrong project, parent archived, depth 7 rejection, circular parent (direct + indirect), slug not unique, unauthenticated, viewer forbidden |
| Boundary | 7 | Name at 2 chars (min), name at 80 chars (max), name at 81 chars (over), name at 1 char (under), depth 6 success, depth 7 rejection, position 0 rejection |
| Integration | 3 | Activity log write on create, Realtime tree broadcast, transaction atomicity (parent count + path + module insert) |
| API | 5 | 201 response shape validation, 400 error envelope, 404 error envelope, 409 error envelope, GET /modules flat vs tree format |
| **Total** | **37** | High count driven by the Data Validation + Tree Integrity complexity — every depth level, every parent validation rule, and every slug derivation rule is a distinct test surface |

**Rationale**: Module creation is a tree-structured resource with 7+ validation rules (name, slug, parent, depth, circularity, position, project scope). Each rule has Positive + Boundary + Error paths. The tree operations (depth limit, circularity detection, path materialization) are structural — a bug in any one of them corrupts the navigation hierarchy. The 37-outline count reflects this: ~3 tests per validation rule × 7 rules + tree-specific boundaries + integration points.

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive
- **Should create root-level module with valid name** — Pre: project exists, user is member+, name "Cart". Expected: 201, slug "cart", path "/cart", depth 0, position assigned.
- **Should create nested child module under existing parent** — Pre: parent module "Cart" exists. Expected: 201, path "/cart/add-to-cart", depth 1, parent children_count incremented.
- **Should create module at max allowed depth 6** — Pre: chain at depth 5. Expected: 201, depth 6, full path computed.
- **Should auto-assign position at end of sibling list** — Pre: parent has 3 children at positions 1-3. Expected: 201, new module at position 4.
- **Should derive kebab-case slug from name** — Pre: name "My Module Name". Expected: slug "my-module-name".
- **Should strip accents during slug derivation** — Pre: name "Módulo". Expected: slug "modulo".
- **Should compute materialized path from parent path** — Pre: parent path "/cart", slug "add-item". Expected: path "/cart/add-item" stored.
- **Should list all modules in project** — Pre: project has 3 modules. Expected: 200, array length 3, all fields present.

#### Negative
- **Should reject name shorter than 2 characters** — Pre: name "A". Expected: 400 VALIDATION_ERROR.
- **Should reject name longer than 80 characters** — Pre: name of 81 chars. Expected: 400 VALIDATION_ERROR.
- **Should reject empty name** — Pre: name "". Expected: 400 "name is required".
- **Should reject name with no alphanumeric characters** — Pre: name "!!!". Expected: 400 NAME_NO_ALPHANUMERIC.
- **Should reject name containing slashes** — Pre: name "cart/checkout". Expected: 400 or 201 with slug "cart-checkout" (NEEDS PO CONFIRM).
- **Should reject when project does not exist** — Pre: nonexistent project_id. Expected: 404 PROJECT_NOT_FOUND.
- **Should reject when parent module does not exist** — Pre: nonexistent parent_module_id. Expected: 404 PARENT_MODULE_NOT_FOUND.
- **Should reject when parent belongs to different project** — Pre: parent from project A, URL targets project B. Expected: 400 PARENT_MODULE_WRONG_PROJECT.
- **Should reject when parent module is archived** — Pre: parent has archived_at set. Expected: 400 PARENT_MODULE_ARCHIVED.
- **Should reject at depth 7** — Pre: parent is at depth 6. Expected: 400 MODULE_MAX_DEPTH.
- **Should reject circular parent — direct self-reference** — Pre: attempt parent_module_id = own id. Expected: 400 MODULE_CIRCULAR_PARENT.
- **Should reject circular parent — indirect descendant loop** — Pre: attempt to make parent a child of its grandchild. Expected: 400 MODULE_CIRCULAR_PARENT.
- **Should reject duplicate slug within same project** — Pre: slug "cart" exists. Expected: 409 SLUG_NOT_UNIQUE.
- **Should reject viewer-role user from creating modules** — Pre: viewer auth'd. Expected: 403 FORBIDDEN.

#### Boundary
- **Should accept name at exactly 2 characters** — Pre: name "AB". Expected: 201, slug "ab".
- **Should accept name at exactly 80 characters** — Pre: 80-char name. Expected: 201, full name stored.
- **Should reject name at 81 characters** — Pre: 81-char name. Expected: 400 VALIDATION_ERROR.
- **Should reject name at 1 character** — Pre: name "A". Expected: 400 VALIDATION_ERROR.
- **Should accept module at depth 6** — Pre: parent at depth 5. Expected: 201, depth 6.
- **Should reject module at depth 7** — Pre: parent at depth 6. Expected: 400 MODULE_MAX_DEPTH.
- **Should reject position value of 0 or negative** — Pre: position 0 or -1. Expected: 400 VALIDATION_ERROR.

#### Integration
- **Should write activity_log row on successful creation** — Pre: module created. Expected: activity_log row with action "module.created".
- **Should broadcast module via Realtime on project channel** — Pre: module created. Expected: Realtime subscription receives row on project_id channel.
- **Should rollback transaction if path computation or parent update fails** — Pre: simulate DB error on parent children_count update. Expected: no module row persisted.

#### API
- **Should return 201 with full response body shape** — Pre: valid creation request. Expected: { success: true, data: { id, name, slug, path, parent_module_id, depth, position, children_count, project_id, created_at, updated_at } }.
- **Should return 400 with error envelope for validation failures** — Pre: invalid input. Expected: { success: false, error: { code, message, details? } }.
- **Should return 404 with error envelope for missing resources** — Pre: nonexistent project or parent. Expected: { success: false, error: { code: "PROJECT_NOT_FOUND" | "PARENT_MODULE_NOT_FOUND" } }.
- **Should return 409 with error envelope for slug conflict** — Pre: duplicate slug. Expected: { success: false, error: { code: "SLUG_NOT_UNIQUE" } }.
- **Should enforce rate limit on module creation endpoint** — Pre: 100+ POST in 1 min. Expected: 429 + Retry-After.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|-----------|-------------------|-------------|--------|
| 1 | Name with only special characters (no alphanumeric) | No | High | Add to AC (Scenario 1.4) |
| 2 | Name producing empty slug (emoji only, all hyphens) | No | Medium | Add to AC (reuse BK-4 SLUG_EMPTY pattern) |
| 3 | Name at exact max and min boundaries | No | High | Add to AC (Boundary outlines) |
| 4 | Module at depth 6 → child at depth 7 rejected | No | Critical | Add to AC (Scenario 3.1, 3.2) |
| 5 | Soft warning at depth 4 (UI only) | No | Medium | Add to AC (Scenario 3.3) |
| 6 | Circular parent — self-reference and indirect loop | No | Critical | Add to AC (Scenario 4.1, 4.2) |
| 7 | Parent module from different project | No | Critical | Add to AC (Scenario 2.3) |
| 8 | Parent module is archived | No | Medium | Add to AC (Scenario 2.4) |
| 9 | Two concurrent creates with same explicit position | No | Medium | Ask Dev (Scenario E6) |
| 10 | Name containing slashes | No | Medium | Ask PO — strip or reject |
| 11 | Position out of bounds (99999 with 3 siblings) | No | Low | Ask Dev |
| 12 | Rapid double-submit (idempotency) | No | Medium | Ask Dev (Scenario E4) |
| 13 | Unicode name normalization | No | Medium | Add to AC (Scenario E1) |
| 14 | Full depth chain creation (L0→L1→...→L6) | No | Critical | Add to AC (Boundary outline) |
| 15 | Viewer role attempting create | No | High | Add to AC (Scenario E5) |
| 16 | Same name as existing sibling but different slug possible? | No | Low | Ask PO — auto-suffix or reject |
| 17 | Slug truncation > 60 chars from name | No | Medium | Inherit BK-4 sluggification behavior |

> Test-data generation strategy + Faker recipes are NOT defined here. They land in `/sprint-testing` Stage 1 when the feature exists.

---

## Story Quality Assessment

**Verdict**: **Significant Issues** — single-sentence Story with zero acceptance criteria for a tree-structured resource with 7+ validation rules.

**Key findings**:
- **No ACs at all** — every scenario in this refinement is inferred from domain context. The Story provides no testable contract.
- **Endpoint design unresolved** — contradiction between user-provided contract (`/projects/{id}/modules`) and business-feature-map (`/modules`). Adopt the nested design but must be confirmed.
- **Tree integrity rules (depth, circularity, path) are canonical in domain context but absent from Story** — these are the hardest bugs to fix after corruption.
- **Position, slug, and name validation are underspecified** — every rule must be confirmed before Dev starts. No error catalog exists.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **What are the complete acceptance criteria for BK-9?**
   - **Context**: The Story is a single sentence. Every scenario in this refinement was inferred from domain context (business-data-map, business-feature-map). The PO must confirm or correct the inferred AC set.
   - **Impact if unanswered**: Dev has no contract. QA cannot write test scenarios. PO cannot estimate.
   - **Suggested answer**: Adopt the 7 ACs defined in Phase 3 above: AC1 (Create root module), AC2 (Create nested sub-module), AC3 (Depth limit enforcement), AC4 (Circular-parent guard), AC5 (Slug auto-derivation + uniqueness), AC6 (Position ordering), AC7 (List modules). ~37 test scenarios total.

2. **Is this Story CREATE-only, or does it include MOVE (changing `parent_module_id` via PATCH)?**
   - **Context**: FEAT-006 includes create, rename, move, soft-delete. But "move" has distinct validation complexity (recompute path for entire subtree, rebalance positions, depth/circularity re-check).
   - **Impact if unanswered**: If move is in scope, depth/circularity tests must cover PATCH as well as POST. If out of scope, move needs a separate Story.
   - **Suggested answer**: **CREATE only** for BK-9. MOVE as separate Story (BK-9b or BK-10). This keeps the Story estimable and testable in one sprint.

3. **What is the slug uniqueness scope — project-wide or sibling-only?**
   - **Context**: With path-based routing (`/modules/{slug}`), project-wide uniqueness is safest. But sibling-only uniqueness is more flexible (allows `/cart/add-item` and `/payment/add-item`).
   - **Impact if unanswered**: Slug collision tests are ambiguous. API lookup by slug could return multiple modules.
   - **Suggested answer**: Project-wide uniqueness. Module API endpoints use slug for lookup; duplicates break this.

4. **`POST /api/v1/projects/{id}/modules` (nested) or `POST /api/v1/modules` with `project_id` in body?**
   - **Context**: User-provided contract says nested; business-feature-map says flat. Nested is more RESTful and consistent with `/workspaces/{id}/invites`.
   - **Impact if unanswered**: Frontend route builders, API contracts, and Zod schemas depend on this decision.
   - **Suggested answer**: Adopt nested design (`/projects/{id}/modules`). Project scope is explicit in the URL.

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **How is depth computed — stored column or on-the-fly recursive traversal?**
   - **Context**: Depth enforcement (≤6) needs a depth value. Stored `depth` column is denormalized but makes tree queries fast. On-the-fly recomputation from `parent_module_id` is normalized but slower.
   - **Testing impact**: Test assertions for depth depend on knowing where depth lives.

2. **Does position collision auto-shift siblings or reject?**
   - **Context**: If user sends `position: 2` when position 2 is occupied, does the system shift existing siblings (recommended) or reject with 409?
   - **Testing impact**: Determines expected behavior in Scenario 6.2.

3. **Is `Idempotency-Key` supported on `POST /projects/{id}/modules`?**
   - **Context**: BK-037 applies to "all write endpoints." Module creation is a write endpoint.
   - **Testing impact**: If supported, add idempotency scenarios. If not, rapid double-clicks may create duplicate modules.

4. **What is the Realtime channel name for module tree updates?**
   - **Context**: Tree view must refresh when a module is created by another user.
   - **Testing impact**: Integration test for Realtime broadcast needs the channel name.

5. **How is the materialized `path` column formatted for root vs nested modules?**
   - **Context**: Is root module path `/slug` or just `slug`? This affects breadcrumbs, navigation, and API responses.
   - **Testing impact**: Every path assertion depends on this format.

6. **Slug truncation behavior — same as workspaces (max 60 chars, character-level cut)?**
   - **Context**: Module names can be 80 chars but slugs may be truncated. Where does truncation happen — at word boundary or character level?
   - **Testing impact**: Long-name test data depends on truncation rule.

7. **What is the `modules` table schema?**
   - **Context**: The entity quick-reference lists `parent_module_id` and `path` but not all columns. Need confirmation: `id, project_id, parent_module_id, name, slug, path, depth, position, archived_at, created_at, updated_at, children_count? (computed or stored?)`.
   - **Testing impact**: DB state assertions need the full column list.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | Single-sentence Story | Write explicit ACs: AC1-Create root, AC2-Create nested, AC3-Depth limit, AC4-Circular guard, AC5-Slug derivation+uniqueness, AC6-Position, AC7-List modules | Dev has contract. QA can test. PO can estimate. |
| 2 | No error responses | Add error catalog: 400 NAME_TOO_SHORT, NAME_TOO_LONG, NAME_NO_ALPHANUMERIC, MODULE_CIRCULAR_PARENT, MODULE_MAX_DEPTH, PARENT_MODULE_WRONG_PROJECT, PARENT_MODULE_ARCHIVED, SLUG_EMPTY; 404 PROJECT_NOT_FOUND, PARENT_MODULE_NOT_FOUND; 409 SLUG_NOT_UNIQUE; 401 UNAUTHORIZED; 403 FORBIDDEN | Negative scenarios become testable. Error handling is consistent. |
| 3 | No DoD items | Add to Definition of Done: "OpenAPI spec updated with POST/GET /projects/{id}/modules endpoints", "Sluggification utility extracted to shared `@/utils/slug` package", "Recursive CTE for circular-parent detection" | API consumers discover contract. Sluggification code shared with workspaces. |
| 4 | Endpoint design unresolved | Standardize on `POST /api/v1/projects/{id}/modules` + `GET /api/v1/projects/{id}/modules`. Update business-feature-map accordingly. | Consistent REST design. Explicit project scope in URL. |
| 5 | No AC for Realtime tree refresh | Add: "When a module is created by User A, User B viewing the same project sees the module appear in the tree within 2 seconds without manual refresh." | Live tree UX is a core product differentiator. |

---

## Data feasibility flags

- **`modules` table not yet scaffolded** — schema must be set up in `/project-bootstrap` before this Story can be implemented.
- **No live API endpoints** — staging has no Module CRUD. All testing will be against freshly-implemented endpoints.
- **No pre-existing Modules** — all test data must be generated: create root modules, build depth chains, populate sibling lists. Create via the same endpoint being tested.
- **Depth chains require sequential API calls** — test setup for depth enforcement needs to create 6+ modules in chain. Helper fixture should batch-create.
- **Circular-parent detection needs recursive query** — Dev must implement this; test can only verify behavior once implemented.

---

## Recommended testing strategy

### Pre-implementation
- PO must confirm the 7 ACs defined in Phase 3. This Story is not testable without explicit ACs.
- Dev must confirm the `modules` table schema, endpoint design, and sluggification strategy.
- Extract shared `slugify()` from BK-4 workspace creation — reuse the same utility to avoid code divergence.
- Define `api-contracts.yaml` entries for `POST /projects/{id}/modules` and `GET /projects/{id}/modules` before implementation.

### During implementation
- Unit test `slugify()` with 15–20 input/output pairs (reuse BK-4 test suite).
- Unit test depth computation and circular-parent detection in isolation.
- Integration test: create module → verify path column → verify activity_log → verify Realtime broadcast.
- Contract test: validate request/response shapes against OpenAPI spec.

### Post-implementation (in-sprint by /sprint-testing)
- Execute all 37 outlines defined in Phase 4 (with parametrization expanded by sprint-testing).
- End-to-end test: Journey 1 Step 3 — create Project → create root Module → create nested Module → verify tree renders.
- Depth chain test: create modules from L0 to L6 programmatically → attempt L7 → verify rejection.
- Circular-parent test: create chain → attempt circular PATCH → verify rejection.
- Cross-project isolation: module from Project A cannot be parented under Project B.
- Realtime test: two browser tabs → create module in Tab A → verify Tab B tree refreshes within 2s.
- Rate limit test: 100+ POST /modules in 1 minute → 429 + Retry-After.

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|-----------------------------|
| 1 | Slug uniqueness enforced at wrong scope (global vs project vs sibling) | Medium | Critical — navigation breaks, API lookups return multiple results | Negative "slug not unique" outline. Mitigated by DB UNIQUE constraint on `(project_id, slug)`. |
| 2 | Circular parent not detected — silent tree corruption | Low | Critical — recursive CTE infinite loops, tree view crashes, path columns diverge from parent chain | Negative outlines "circular parent (direct + indirect)". Mitigated by recursive CTE check before INSERT/UPDATE. |
| 3 | Depth limit not enforced — modules nested beyond level 6 | Medium | High — tree render performance degrades, thermal map rollup becomes unbounded | Boundary outlines "depth 7 rejection". Mitigated by depth check in API validation. |
| 4 | Path column computed incorrectly or not recomputed on parent change (if MOVE is in scope) | Medium | High — breadcrumbs show wrong hierarchy, subtree queries return wrong modules | Integration outline "path computation". Mitigated by path derivation in INSERT/PATCH trigger. |
| 5 | No endpoint for listing modules — frontend stuck after first create | High | Critical — tree view is blank even after module created | API outline "GET /projects/{id}/modules". Mitigated by implementing both POST and GET in this Story. |
| 6 | Slug derivation diverges from workspace sluggification | Medium | Medium — inconsistent UX across entities | Positive "slug derivation" outlines. Mitigated by shared `slugify()` utility. |
| 7 | Viewer role can create modules via direct API call | Low | High — data pollution by read-only users | Negative "viewer forbidden" outline. Mitigated by RLS policy + API guard. |
| 8 | Position collision causes DB constraint violation (race condition) | Low | Medium — concurrent creates at same position crash | Ask Dev about conflict resolution. Mitigated by DB transaction with row-level lock on sibling set. |

---

## Next steps

- [ ] **BLOCKER**: PO must confirm the 7 inferred ACs before sprint planning
- [ ] **BLOCKER**: PO must answer Critical Questions #1-#4 (AC set, scope CREATE vs MOVE, slug uniqueness scope, endpoint design)
- [ ] Dev answers Technical Questions #1-#7 before estimation
- [ ] **BLOCKER**: Resolve endpoint design (`/projects/{id}/modules` vs `/modules`) and update `business-feature-map.md` + `api-contracts.yaml`
- [ ] Extract shared `slugify()` from BK-4 workspace creation into `@/utils/slug`
- [ ] Define `modules` table schema + migration in `/project-bootstrap`
- [ ] Story enters sprint at status `Ready For Dev` once estimated and blockers cleared
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected) and expand outlines with parametrization + test-data JSON + Faker recipes
