# Shift-Left Refinement: BK-8 — Create a Project inside a Workspace

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-05-27
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context
- **Primary persona affected**: Elena (QA Engineer) — creates the first Project after onboarding a workspace; Mateo (QA Lead) — sets up multi-project workspaces for team organization
- **Secondary personas (if any)**: Karim (AI agent) — API-driven project creation via PAT; Viewer (read-only) — receives zero state when navigating a workspace with zero projects
- **Business value proposition**: Project is the namespace root for the Module tree, US/AC traceability, ATC library, Tests, Runs, and Bugs. Without Project creation, **no other domain entity can exist** — this is the second step in the adoption funnel (workspace → project → module → US).
- **KPI(s) influenced**: Time-to-first-ATC (T2FA), Workspace activation rate (project creation = workspace "in use"), adoption funnel drop-off between workspace-signup and first-project
- **User journey position**: Journey 1 (First-time setup), Step 3: Elena creates the Project immediately after workspace creation or invite acceptance. Also called in Journey 1 Step 2 when Elena switches to an existing workspace with no projects.

### Technical context
- **Frontend**: `app/(workspace)/[workspaceSlug]/page.tsx` — Workspace Home with "Create Project" CTA + empty-state card grid. Form: `components/projects/create-project-dialog.tsx` (Zod-validated, name input, auto-derived slug preview). Route `/projects` exists but only redirects in staging.
- **Backend**: 
  - **Current spec** (`business-api-map.md` §4.3): `POST /projects` `{ workspace_id, name, description? }` → 201 `{ id, slug }`. Bearer + role (member+).
  - **Staging reality**: No project API endpoints exist yet. Workspaces ARE implemented (`POST/GET /workspaces`).
  - **Proposed nesting** (following workspace pattern): `POST /api/v1/workspaces/{id}/projects` `{ name, slug? }` → 201 `{ project }`. Rationale: frontend always operates inside a workspace context; nesting removes redundant `workspace_id` body field, reduces client error surface, and aligns with RESTful resource hierarchy.
- **External services**: None (no Jira/external integration needed for project creation).
- **Integration points specific to this Story**: Bearer PAT auth (Karim persona must be able to create projects headlessly). Realtime broadcast on `project.created` event. Activity log append.

### Story complexity
| Axis | Rating | Why |
|------|--------|-----|
| Business logic | Medium | Slug auto-generation rules, uniqueness scoping (per-workspace not global), reserved list check, validation chain |
| Integration | Low | No external services; DB insert + activity log + Realtime broadcast only |
| Data validation | Medium | Name (3-80 chars), slug (3-40 chars, kebab-case, unique per workspace), reserved slug list |
| UI | Low | Single-field form (name) + optional manual slug override; inline slug preview |

**Estimated test effort**: 8 outlines (3 positive, 4 negative, 1 boundary). Low UI complexity but high structural importance — this is the adoption funnel blocker, so quality must be high.

### Epic-level inheritance (if applicable)
- **Risks restated at Story level**: Project slug uniqueness is per-workspace, not global. If this is implemented as global-unique (copying workspace pattern), cross-workspace slug collisions will cause unnecessary failures.
- **Integration points inherited**: Phases 1-3 of `/acceptance-test-planning.md` already done here; in-sprint `/sprint-testing` Stage 1 will skip them if `shift-left-reviewed` label is fresh.
- **PO/Dev answers already given at epic level**: EPIC-BK-002 scope confirmed: Project slug is workspace-scoped (not global). Form fields: workspace_id, name (3-80). No UPDATE or DELETE in MVP.
- **Test strategy inherited**: API contract-first validation (Zod schema shared client/server), RLS enforcement (caller must be member+ of workspace), activity_log on every state change.

---

## Phase 2 — Story Quality Analysis

### Ambiguities
| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|-------------------|---------------------|-------------------|------------------------|
| 1 | Entire story — description is single sentence with no ACs | What is the complete workflow? Create-only or does it include list/get? | Cannot design assertions or define scope | Scope confirmed via FEAT-005: Create + List in MVP. Get-by-id and Update deferred to Phase 2. |
| 2 | No API contract in Story | Should project endpoints nest under workspace (`/workspaces/{id}/projects`) or remain flat (`/projects` with body param)? | Changes request shape, auth context, and URL structure for all 30+ downstream endpoints that reference project_id | NEEDS PO/DEV CONFIRMATION — see API contract design section below |
| 3 | No slug rules in Story | How is slug generated? Auto-from-name? Manual override? What validation? | Slug validation is 3+ outlines by itself (format, uniqueness, reserved) | Slug auto-derived from name: lowercase, spaces→hyphens, strip special chars, trim to 40 chars. Manual override allowed but must pass same rules. |
| 4 | "inside a Workspace" implies existing workspace | What happens when workspace has zero members? What if workspace doesn't exist? | Negative test: 404 workspace, 403 not-a-member | Standard: 404 on invalid workspace, 403 on non-member. Both already tested at workspace layer. |
| 5 | No post-creation behavior defined | Does the UI navigate to the new project? Does the tree auto-expand? | Affects E2E test flow | Navigate to `/{workspace_slug}/{project_slug}` on success. Tree lazy-loads on first visit. |

### Gaps (missing info)
| # | Type | Why critical | What to add | Risk if omitted |
|---|------|--------------|-------------|-----------------|
| 1 | AC | Story has zero acceptance criteria — cannot test "success" | Add Positive ACs: create with valid name → 201, slug auto-generated, project visible in workspace list | Cannot measure "done" — Dev implements their interpretation, QA discovers mismatch at execution |
| 2 | AC | No error paths defined | Add Negative ACs: duplicate slug (409), invalid name (400), unauthorized (403), workspace not found (404) | False positive in QA: tests pass happy path, miss validation holes that become production P1 bugs |
| 3 | Business rule | `description` field optional per spec but not in Story | Add AC: create with description → stored and returned; create without → description=null, no error | Missing field silently dropped or rejected — inconsistent UX |
| 4 | Business rule | Reserved slug list not defined per project (exists for workspaces) | Confirm: do projects share the workspace reserved list (`admin`, `api`, `settings`, etc.)? | Two Projects with reserverd-name collision in different workspaces would fail unnecessarily if list is global |
| 5 | Technical detail | Slug uniqueness scope: per-workspace or global? | Spec says workspace-scoped; confirm implementation follows this | Global-unique slugs cause collisions across unrelated workspaces |
| 6 | Business rule | `GET /workspaces/{id}/projects` — list endpoint not in Story | Add AC for list: returns projects scoped to workspace, empty array for new workspace, RLS-filtered | Without list, created project is unreachable via API (frontend needs it) |

### Edge cases not in Story
| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|----------|-------------------------------|-------------|--------|
| 1 | User creates project with name containing only special characters (e.g. `!!!`) | Slug would be empty → return 400 "name must contain at least one alphanumeric character" | Medium | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 2 | User creates project with name exactly 3 chars, all valid | Slug = 3-char kebab-case, 201 success | Low | Test only — boundary validation |
| 3 | User creates project with name >80 chars | 400 "name must be 3-80 characters" | Medium | Add to AC |
| 4 | User creates project with duplicate name (same or different slug) in the same workspace | Same slug → 409 "project slug already exists in workspace". Different slug via manual override → 201 (allowed) | High | Add to AC (NEEDS PO/DEV CONFIRMATION — should duplicate names be allowed?) |
| 5 | User creates project, then immediately creates another with identical name (no manual slug) | Second project auto-generates slug with dedup suffix (e.g., `my-project-2`) or returns 409 | High | NEEDS PO/DEV CONFIRMATION — auto-dedup vs hard-reject |
| 6 | Race condition: two users create project with same name simultaneously | One succeeds, one gets 409 + "slug already exists". Idempotency-Key on POST prevents third duplicate. | High | Test only (requires concurrent test tooling) |
| 7 | User creates project with Unicode name (e.g. `テストプロジェクト`) | Slug transliterated or stripped → e.g. `tesutopuroziekuto` or `test-project` depending on strategy | Medium | NEEDS PO/DEV CONFIRMATION — transliterate, strip, or reject? |
| 8 | User creates project with leading/trailing whitespace in name | Trimmed before slug generation. "  My Project  " → slug `my-project` | Low | Test only |
| 9 | User creates project, then workspace is deleted (Phase 2) | Project cascade-archived (soft-delete per {{PROJECT_KEY}}-039). Not MVP scope for deletion. | Low | Deferred to Phase 2 |
| 10 | Bearer PAT caller with read-only scope tries to create project | 403 FORBIDDEN, code: `INSUFFICIENT_SCOPES` | Medium | Test only — scope enforcement is {{PROJECT_KEY}}-034, not this Story |

### Contradictions
- **None identified.** The single-sentence Story is internally consistent — it's just incomplete. No existing ACs, comments, or designs to contradict.

### Testability validation
**Verdict**: Partial — must resolve before sprint planning.

Issues:
- Missing ACs entirely — Dev and QA cannot agree on "done"
- Slug generation algorithm not specified (auto-from-name? delimiter? dedup strategy?)
- API contract design choice (nested vs flat) affects test URL structure and auth context
- No error message texts specified (what does 409 say? what does 400 say?)
- No performance criteria (expected latency for project creation)

---

## Phase 3 — Refined Acceptance Criteria

### API contract design proposal (NEEDS PO/DEV CONFIRMATION)

The following proposes a **nested** project API under the workspace resource, diverging from the flat `POST /projects` in `business-api-map.md` §4.3. Rationale:

1. Frontend always operates within a workspace context (`/{workspace_slug}/...`)
2. Nested URLs remove the redundant `workspace_id` body field
3. Aligns with existing pattern: workspace invites are nested (`/workspaces/{id}/invites`)
4. Bearer auth middleware resolves workspace from token context — nested URL makes auth scope explicit
5. Same pattern extends naturally to modules: `/workspaces/{ws}/projects/{proj}/modules`

**Proposed endpoints for BK-8 (MVP)**:

| Method | Path | Body | Response | Auth | Side effects |
|--------|------|------|----------|------|-------------|
| POST | `/api/v1/workspaces/{workspaceId}/projects` | `{ name: string, slug?: string, description?: string }` | 201 `{ id, slug, name, description, workspace_id, created_at }` | Bearer + role (member+) | INSERT projects; INSERT activity_log; emit `project.created` |
| GET | `/api/v1/workspaces/{workspaceId}/projects` | — | 200 `{ projects: [{ id, slug, name, description, created_at }] }` | Bearer | RLS-filtered to caller's workspace memberships |

**Slug rules** (inferred from workspace pattern):
- Auto-generated from `name`: lowercase, spaces→hyphens, strip non-alphanumeric, collapse consecutive hyphens, trim hyphens from ends
- Manual `slug` param overrides auto-generation
- 3-40 characters, must match `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
- Unique per workspace (not global)
- Reserved list: `admin`, `api`, `settings`, `auth`, `projects`, `modules`, `dashboard`, `new`, `edit`, `create` — NEEDS PO/DEV CONFIRMATION

---

### AC1 — Create Project with valid name (Positive, Priority: Critical)

#### Scenario 1.1: Should create project with valid name and auto-generated slug (Type: Positive, Priority: Critical)
- **Given**: User is authenticated member of workspace `ws-abc123`. Workspace has no existing projects. Name "Checkout v2" is provided.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects` with body `{ "name": "Checkout v2" }`
- **Then**:
  - **UI**: Redirect to `/{workspace_slug}/checkout-v2`. Toast: "Project created". Project appears in workspace home project list.
  - **API**: 201 Created. Response body: `{ "id": "<uuid>", "slug": "checkout-v2", "name": "Checkout v2", "description": null, "workspace_id": "ws-abc123", "created_at": "<iso>" }`. Response envelope: `{ "success": true, "data": { ... } }`.
  - **DB**: One row in `projects` with auto-generated slug, `description = NULL`. One row in `activity_log` with `action = "project.created"`.
  - **System state**: `project.created` event emitted. Realtime channel for workspace `ws-abc123` broadcasts new project.

#### Scenario 1.2: Should create project with explicit slug override (Type: Positive, Priority: High)
- **Given**: User is authenticated member of workspace `ws-abc123`. No slug conflict.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects` with body `{ "name": "Checkout v2", "slug": "checkout-legacy" }`
- **Then**: 201. Response slug = `"checkout-legacy"` (manual override honored). DB slug column = `"checkout-legacy"`.

#### Scenario 1.3: Should create project with description (Type: Positive, Priority: Medium)
- **Given**: User is authenticated member.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects` with body `{ "name": "API Gateway", "description": "Microservice gateway for payment routing" }`
- **Then**: 201. Response `description` = `"Microservice gateway for payment routing"`. DB `description` column populated.

#### Scenario 1.4: Should create project with Unicode name and produce ASCII slug (Type: Edge, Priority: Medium)
- **Given**: User is authenticated member.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects` with body `{ "name": "テスト駆動開発" }`
- **Then**: NEEDS PO/DEV CONFIRMATION — auto-generated slug strategy for non-Latin scripts. Options: (a) transliterate → `tesutokudokaihatsu`, (b) strip non-ASCII → `""` → 400 error, (c) accept Unicode in slug. **Suggested**: transliterate via `Intl` or reject with 400 "name must contain at least one ASCII alphanumeric character". Confirm strategy.

### AC2 — Slug validation and uniqueness (Positive + Negative)

#### Scenario 2.1: Should reject project creation with duplicate slug in same workspace (Type: Negative, Priority: Critical)
- **Given**: Workspace `ws-abc123` already has a project with slug `"checkout-v2"`.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects` with body `{ "name": "Checkout v2" }` (auto-generates slug `"checkout-v2"`)
- **Then**: 409 Conflict. Error: `{ "success": false, "error": { "code": "PROJECT_SLUG_EXISTS", "message": "A project with slug 'checkout-v2' already exists in this workspace" } }`. No DB change. No activity_log row.

#### Scenario 2.2: Should reject project creation with duplicate name when auto-dedup is NOT enabled (Type: Negative, Priority: High)
- **Given**: Workspace `ws-abc123` has project "Checkout v2" with slug `"checkout-v2"`. Auto-dedup not implemented.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects` with body `{ "name": "Checkout v2" }`
- **Then**: Same as 2.1 — 409 due to computed slug collision. NEEDS PO/DEV CONFIRMATION if auto-dedup (append `-2`) should be implemented instead.

#### Scenario 2.3: Should reject slug shorter than 3 characters (Type: Negative, Priority: Medium)
- **Given**: User is authenticated member.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects` with body `{ "name": "A B", "slug": "ab" }`
- **Then**: 400 Bad Request. Error: `{ "code": "VALIDATION_ERROR", "details": [{ "field": "slug", "message": "Slug must be 3-40 characters" }] }`.

#### Scenario 2.4: Should reject slug longer than 40 characters (Type: Boundary, Priority: Medium)
- **Given**: User is authenticated member.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects` with body `{ "name": "test", "slug": "a".repeat(41) }`
- **Then**: 400 Bad Request. `details[].message`: "Slug must be 3-40 characters".

#### Scenario 2.5: Should reject slug with invalid characters (Type: Negative, Priority: Medium)
- **Given**: User is authenticated member.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects` with body `{ "name": "test", "slug": "my_project!" }`
- **Then**: 400 Bad Request. `details[].message`: "Slug must be lowercase alphanumeric with hyphens only (kebab-case)".

#### Scenario 2.6: Should reject slug from reserved list (Type: Negative, Priority: Medium)
- **Given**: Reserved slugs include `"admin"`, `"api"`, `"settings"`, `"auth"`, `"projects"`, `"modules"`, `"dashboard"`, `"new"`, `"edit"`, `"create"`.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects` with body `{ "name": "Admin Panel", "slug": "admin" }`
- **Then**: 400 Bad Request. `details[].message`: "Slug 'admin' is reserved".

#### Scenario 2.7: Should allow same slug in different workspaces (Type: Positive, Priority: High)
- **Given**: Workspace `ws-abc123` has project with slug `"checkout-v2"`. Workspace `ws-xyz789` has no projects.
- **When**: User (member of both workspaces) calls `POST /api/v1/workspaces/ws-xyz789/projects` with body `{ "name": "Checkout v2" }`
- **Then**: 201 Created. Slug `"checkout-v2"` is valid in workspace `ws-xyz789`. Uniqueness is per-workspace, not global.

### AC3 — Name validation (Negative + Boundary)

#### Scenario 3.1: Should reject project creation with name shorter than 3 characters (Type: Boundary, Priority: Medium)
- **Given**: User is authenticated member.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects` with body `{ "name": "AB" }`
- **Then**: 400. `details[].message`: "Name must be 3-80 characters".

#### Scenario 3.2: Should reject project creation with name longer than 80 characters (Type: Boundary, Priority: Medium)
- **Given**: User is authenticated member.
- **When**: Body with `name` = 81-char string.
- **Then**: 400. `details[].message`: "Name must be 3-80 characters".

#### Scenario 3.3: Should accept project creation with name exactly 3 characters (Type: Boundary, Priority: Low)
- **Given**: User is authenticated member.
- **When**: Body with `name` = `"API"` (exactly 3 chars)
- **Then**: 201 Created. Slug = `"api"` — but `"api"` is in reserved list. NEEDS PO/DEV CONFIRMATION: should auto-slug from short names bypass reserved list, or should this still fail? **Suggested**: reserved check applies to final slug regardless of source (auto or manual). If `"api"` is reserved, this should return 400 unless user overrides slug.

#### Scenario 3.4: Should reject project creation with empty or whitespace-only name (Type: Negative, Priority: Medium)
- **Given**: User is authenticated member.
- **When**: Body with `name` = `""` or `"   "`
- **Then**: 400. `details[].message`: "Name must be 3-80 characters" (after trimming).

### AC4 — Authorization (Negative)

#### Scenario 4.1: Should reject project creation when workspace does not exist (Type: Negative, Priority: Critical)
- **Given**: Workspace `ws-nonexistent` does not exist.
- **When**: `POST /api/v1/workspaces/ws-nonexistent/projects`
- **Then**: 404 Not Found. Error code: `WORKSPACE_NOT_FOUND`. No DB change.

#### Scenario 4.2: Should reject project creation for unauthenticated caller (Type: Negative, Priority: Critical)
- **Given**: No `Authorization` header.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects`
- **Then**: 401 Unauthorized. Error code: `UNAUTHENTICATED`.

#### Scenario 4.3: Should reject project creation for user who is not workspace member (Type: Negative, Priority: High)
- **Given**: Authenticated user `user-999` is NOT a member of workspace `ws-abc123`.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects` with Bearer token for `user-999`
- **Then**: 403 Forbidden. Error code: `FORBIDDEN`. RLS policy blocks insert.

#### Scenario 4.4: Should allow project creation for workspace VIEWER (Type: Edge, Priority: Medium)
- **Given**: Authenticated user with role `viewer` in workspace `ws-abc123`.
- **When**: `POST /api/v1/workspaces/ws-abc123/projects`
- **Then**: 403 Forbidden. Viewers cannot create. Error code: `FORBIDDEN` or `INSUFFICIENT_ROLE`.

### AC5 — List Projects in Workspace (Positive)

#### Scenario 5.1: Should list projects in a workspace (Type: Positive, Priority: High)
- **Given**: Workspace `ws-abc123` has 3 projects: "Checkout v2", "API Gateway", "Admin Panel".
- **When**: `GET /api/v1/workspaces/ws-abc123/projects`
- **Then**: 200 OK. Response: `{ "data": { "projects": [{ "id": "...","slug": "checkout-v2", ... }, { "id": "...", "slug": "api-gateway", ... }, { "id": "...", "slug": "admin-panel", ... }] } }`. Array sorted by `created_at` desc.

#### Scenario 5.2: Should return empty array for workspace with no projects (Type: Positive, Priority: Medium)
- **Given**: Workspace `ws-empty` has zero projects.
- **When**: `GET /api/v1/workspaces/ws-empty/projects`
- **Then**: 200. `{ "data": { "projects": [] } }`.

#### Scenario 5.3: Should filter projects by workspace RLS — user only sees projects in workspaces they belong to (Type: Positive, Priority: High)
- **Given**: User is member of workspace `ws-abc123` (3 projects) but NOT workspace `ws-xyz789` (5 projects).
- **When**: `GET /api/v1/workspaces/ws-abc123/projects` and `GET /api/v1/workspaces/ws-xyz789/projects`
- **Then**: First call returns 3 projects (200). Second call returns 403 or empty (RLS-filtered).

### New scenarios surfaced from Phase 2 edge cases — NEEDS PO/DEV CONFIRMATION

#### Scenario E1: Should handle duplicate name with different slug (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: Should two projects in the same workspace be allowed to have the same `name` if their `slug` differs (via manual override)?
- **Given**: Project "Checkout v2" exists with slug `"checkout-v2"`.
- **When**: Create project `{ "name": "Checkout v2", "slug": "checkout-v2-legacy" }`
- **Then**: 201 (name collision allowed, slug unique) OR 409 (name collision rejected). Confirm desired behavior.

#### Scenario E2: Should auto-dedup slug on name collision (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: When auto-generated slug already exists, should system append counter (`-2`, `-3`) or hard-reject with 409?
- **Given**: Project "My Project" (`slug: "my-project"`) exists.
- **When**: Create project `{ "name": "My Project" }` without manual slug
- **Then**: Option A (auto-dedup): 201 with slug `"my-project-2"`. Option B (hard-reject): 409 `PROJECT_SLUG_EXISTS`. **Suggested**: auto-dedup is better UX for human users; 409 is simpler and safer for API agents. Confirm decision.

#### Scenario E3: Should handle Unicode-only name (Type: Edge, Priority: Low)
- **NEEDS PO/DEV CONFIRMATION**: Per Scenario 1.4 above — transliterate, strip, or reject? Confirmation needed on Unicode strategy.

#### Scenario E4: Should handle name with only special characters producing empty slug (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: `{ "name": "!!!$$$" }` → auto-slug would be `""` after stripping. Should this return 400 with message "Name must contain at least one alphanumeric character"?

#### Scenario E5: Should validate trailing/leading hyphens in manual slug (Type: Edge, Priority: Low)
- **Given**: User provides manual slug `"-my-project-"`.
- **When**: POST
- **Then**: 400. `details[].message`: "Slug cannot start or end with a hyphen".

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate
| Type | Count | Notes |
|------|-------|-------|
| Positive | 6 | Happy path: create, create+description, create+manual-slug, list, empty-list, cross-workspace-same-slug |
| Negative | 8 | Invalid name (short/long/empty), invalid slug (short/long/chars/reserved), duplicate slug, unauthorized (missing/expired token, non-member), workspace not found |
| Boundary | 4 | Name exactly 3/80 chars, slug exactly 3/40 chars, Unicode slug edge |
| Integration | 0 | No external integrations for project creation |
| API | 2 | Endpoint contract validation against Zod schema, response envelope shape |
| **Total** | **20** | (drives PO estimation) |

**Rationale**: This is the second structural entity in the adoption funnel — if Project creation is wrong, every downstream entity (Module, US, ATC, Test, Run, Bug) is unreachable. The slug validation matrix drives the count: 6 slug-rule variants (short, long, chars, reserved, duplicate, hyphen-edge) plus 3 name variants (short, long, empty) plus auth variants. The story complexity axes (Medium business logic, Medium validation) justify thorough negative/boundary coverage.

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive
- **Should create project with valid name and auto-generated slug** — Pre: authenticated member of workspace, name="Checkout v2". Expected: 201, slug="checkout-v2", project visible in list.
- **Should create project with explicit manual slug override** — Pre: authenticated member, name="Checkout v2", slug="checkout-legacy". Expected: 201, slug="checkout-legacy".
- **Should create project with description** — Pre: authenticated member, name="API Gateway", description="Microservice gateway". Expected: 201, description persisted and returned.
- **Should list projects in workspace** — Pre: workspace has 3 projects. Expected: 200, array of 3 projects sorted by created_at desc.
- **Should return empty list for workspace with no projects** — Pre: authenticated member, workspace has zero projects. Expected: 200, projects: [].
- **Should allow same slug in different workspaces** — Pre: user member of both WS-A (has project slug="my-app") and WS-B (empty). Expected: 201 in WS-B with slug="my-app".

#### Negative
- **Should reject project creation with duplicate slug in same workspace** — Pre: workspace already has project slug="my-app". Expected: 409, code=PROJECT_SLUG_EXISTS.
- **Should reject project creation with name shorter than 3 characters** — Pre: authenticated member, name="AB". Expected: 400, message="Name must be 3-80 characters".
- **Should reject project creation with name longer than 80 characters** — Pre: authenticated member, name=81 chars. Expected: 400, message="Name must be 3-80 characters".
- **Should reject project creation with empty name** — Pre: authenticated member, name="". Expected: 400, message="Name must be 3-80 characters".
- **Should reject project creation with whitespace-only name** — Pre: authenticated member, name="   ". Expected: 400 (after trim, still empty).
- **Should reject project creation with invalid slug characters** — Pre: authenticated member, slug="my_project!". Expected: 400, "Slug must be lowercase kebab-case".
- **Should reject project creation with slug shorter than 3 characters** — Pre: authenticated member, slug="ab". Expected: 400, "Slug must be 3-40 characters".
- **Should reject project creation with reserved slug** — Pre: authenticated member, slug="admin" (in reserved list). Expected: 400, "Slug is reserved".

#### Boundary
- **Should accept project creation with name exactly 3 characters** — Pre: authenticated member, name="API". Expected: 201 (auto-slug "api" may conflict with reserved list — confirm behavior).
- **Should accept project creation with name exactly 80 characters** — Pre: authenticated member, name=exactly-80-chars. Expected: 201, slug auto-generated from truncated name.
- **Should accept project creation with slug exactly 3 characters** — Pre: authenticated member, slug="abc", not reserved. Expected: 201.
- **Should accept project creation with slug exactly 40 characters** — Pre: authenticated member, slug=exactly-40-chars-kebab. Expected: 201.

#### API
- **Should return properly shaped 201 response envelope for project creation** — Pre: valid create request. Expected: `{ success: true, data: { id, slug, name, description, workspace_id, created_at } }`.
- **Should return properly shaped 400 error details array for validation failure** — Pre: name="AB". Expected: `{ success: false, error: { code: "VALIDATION_ERROR", message: "...", details: [{ field: "name", message: "..." }] } }`.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|-----------|-------------------|-------------|--------|
| 1 | Name with only special characters → empty slug | No | Medium | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 2 | Name exactly 3 chars, valid | No | Low | Test only — boundary |
| 3 | Name >80 chars | No | Medium | Add to AC |
| 4 | Duplicate name, different slug | No | High | NEEDS PO/DEV CONFIRMATION |
| 5 | Duplicate name, auto-dedup vs hard-reject | No | High | NEEDS PO/DEV CONFIRMATION |
| 6 | Race condition: concurrent same-slug creates | No | High | Test only (Idempotency-Key mitigates) |
| 7 | Unicode name → ASCII slug | No | Medium | NEEDS PO/DEV CONFIRMATION |
| 8 | Leading/trailing whitespace in name | No | Low | Test only |
| 9 | Viewer role attempts create | No | Medium | Test only (RBAC enforcement) |
| 10 | Bearer PAT with read-only scope attempts create | No | Medium | Test only (scope enforcement) |
| 11 | Manual slug with leading/trailing hyphens | No | Low | Test only |
| 12 | Name with consecutive spaces → slug has single hyphen | No | Low | Test only (auto-slug normalization) |
| 13 | PAT creation of project — bearer token scoped to different workspace | No | Medium | Test only |

---

## Story Quality Assessment

**Verdict**: Significant Issues — single-sentence story with zero ACs, no API contract, no validation rules. Heavy refinement required.

**Key findings**:
- Story is structurally empty — must be rewritten with full ACs before sprint entry. All 14 AC scenarios in Phase 3 are inferred from PRD/SRS context and workspace pattern parallel.
- API contract design decision (nested `workspaces/{id}/projects` vs flat `/projects`) must be resolved with Dev before implementation. This affects URL structure for all 30+ downstream endpoints.
- Slug strategy has 4 unresolved edge cases (dedup, Unicode, reserved-list scope, duplicate-name policy) that block test-data generation for negative paths.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **Should duplicated project names be allowed in the same workspace if slugs differ (via manual override)?**
   - **Context**: Two projects both named "Checkout v2" but with different slugs (`"checkout-v2"` and `"checkout-v2-legacy"`).
   - **Impact if unanswered**: Cannot design negative test path for name uniqueness. Dev may implement name-unique constraint that was never specified, blocking legitimate use cases.
   - **Suggested answer**: Allow duplicate names if slugs differ. Uniqueness constraint on slug alone (per workspace). This matches the data model where slug is the identifier.

2. **Should auto-generated slug auto-dedup (append `-2`) or hard-reject with 409 when collision occurs?**
   - **Context**: User creates "My Project" twice without manual slug. Second call hits duplicate slug `"my-project"`.
   - **Impact if unanswered**: UX flow breaks — user gets a raw 409 with no path to resolution unless they manually override slug.
   - **Suggested answer**: Auto-dedup for browser-based users (append `-2`, `-3`). 409 hard-reject for Bearer PAT (API agents should be explicit). Or: auto-dedup universally with a `slug` field in the response that the caller can read back.

3. **Should Unicode characters in project names be (a) transliterated to ASCII, (b) stripped leaving ASCII only, or (c) rejected with an error?**
   - **Context**: `{ "name": "テスト駆動開発" }` — the kebab-case slug convention is ASCII-only. What happens to non-Latin names?
   - **Impact if unanswered**: Japanese/Korean/Arabic/etc. users cannot create projects with native-language names without receiving an opaque error.
   - **Suggested answer**: Transliterate via `Intl` or `String.prototype.normalize` to produce a usable ASCII slug. Fallback: if transliteration produces empty string, generate a random slug (`proj-<6-char-hex>`) and return it in the response so the user can rename later.

4. **What is the MVP reserved slug list for projects?**
   - **Context**: Workspaces have a reserved list. Should projects share it or have their own? Possible reserved: `admin`, `api`, `settings`, `auth`, `projects`, `modules`, `dashboard`, `new`, `edit`, `create`, `tree`, `heatmap`, `bugs`, `runs`, `tests`, `atcs`, `imports`.
   - **Impact if unanswered**: A project named "API Gateway" auto-slugs to `"api-gateway"` — fine. A project named "API" auto-slugs to `"api"` — conflicts with route `/api/v1/...`. Without a reserved list, URL namespace collisions cause routing ambiguity.
   - **Suggested answer**: Reserve: `admin`, `api`, `settings`, `auth`, `projects`, `modules`, `dashboard`, `new`, `edit`, `create`, `tree`, `heatmap`, `bugs`, `runs`, `tests`, `atcs`, `imports`, `search`. This covers all top-level API paths and common UI routes.

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **Nested vs flat API design** — `POST /api/v1/workspaces/{id}/projects` or `POST /api/v1/projects` with `workspace_id` in body? Nested removes redundant field, aligns with invite pattern (`/workspaces/{id}/invites`), and makes middleware auth scoping explicit. Flat is what `business-api-map.md` §4.3 currently specifies. Which does the team prefer for the MVP API surface?

2. **Slug uniqueness constraint** — Implemented as DB unique constraint on `(workspace_id, slug)` or application-level check? DB-level is safer for race conditions but requires a unique index. Application-level requires a SELECT + INSERT with a serializable transaction.

3. **Idempotency-Key support on POST /projects** — Spec requires Idempotency-Key on all write endpoints ({{PROJECT_KEY}}-037). Should this be implemented in BK-8 or deferred until the Idempotency middleware is built?

4. **Auto-slug normalization** — Should the slug auto-generator strip diacritics (e.g., `café` → `cafe`) using `String.prototype.normalize("NFD")`, or should non-ASCII characters be rejected entirely?

5. **Realtime broadcast** — Does the frontend subscribe to a workspace-level Realtime channel for new projects, or does it use a simple refetch after POST? Confirm the Realtime table subscription (`projects` table, workspace-scoped channel).

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | Single-sentence description: "Create a Project inside a Workspace" | Add Phase 3 refined ACs (14 scenarios across 5 AC groups) | Dev and QA align on "done" before first line of code |
| 2 | No API contract | Add explicit endpoint: `POST /api/v1/workspaces/{id}/projects` with Zod schema `{ name: string(3-80), slug?: string(3-40, kebab-case, unique per workspace), description?: string }` | Frontend and backend can be built in parallel against the contract |
| 3 | No validation rules | Add slug rules: auto-from-name, kebab-case, 3-40 chars, `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, unique per workspace, reserved list | Prevent silent data corruption from invalid slugs |
| 4 | No error messages | Add error code catalog: `PROJECT_SLUG_EXISTS` (409), `WORKSPACE_NOT_FOUND` (404), `VALIDATION_ERROR` (400) | Agents (CLI/CI) can branch on stable error codes |
| 5 | No list endpoint | Add `GET /api/v1/workspaces/{id}/projects` returning `{ projects: [...] }` | Frontend workspace home page needs this to show project cards |
| 6 | Missing description field | Add optional `description` field to create payload | Consistency with FR spec — `description` is in the entity schema but not the Story |

---

## Data feasibility flags

- **Entity / fixture missing**: `projects` table not yet created in staging DB. Requires schema migration with `workspace_id` FK, `slug` unique constraint per workspace, and `name` NOT NULL.
- **API contract gap**: `business-api-map.md` §4.3 defines flat `POST /projects` but does not document `description` field or nested workspace path. Gap #6 in `business-api-map.md` (bulk-edit) is unrelated. This Story's contract must be clarified before implementation.
- **Required pre-work**: 
  1. Workspaces API must be stable in staging (confirmed: `POST/GET /workspaces` implemented).
  2. Auth middleware (JWT + Bearer PAT) must resolve workspace context (required for `workspace/{id}` path param validation). 
  3. RLS policies on `projects` table must be in place before endpoint goes live.

---

## Recommended testing strategy

### Pre-implementation
- Review and approve API contract design (nested vs flat) with Dev team
- Confirm slug rules (reserved list, dedup strategy, Unicode) with PO
- Write Zod schema for `createProjectSchema` shared between client and server
- Seed workspace fixtures in staging for test data

### During implementation
- Unit tests: Zod schema validation (all positive/negative/boundary input combos)
- Integration tests: POST endpoint → DB verify (slug generated, activity_log row, RLS enforced)
- Contract tests: response shape matches Phase 3 spec

### Post-implementation (in-sprint by /sprint-testing)
- Smoke test: Elena journey — create workspace → create project → verify project appears in list
- Trifuerza: UI (form submit + redirect), API (201 + 409 + 400 variants), DB (row inserted, slug correct, description nullable)
- Cross-workspace: verify slug isolation (same slug in two workspaces = OK)
- Bearer PAT: Karim creates project headlessly, GET /me verifies, POST /workspaces/{id}/projects → 201

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|-----------------------------|
| 1 | Slug uniqueness implemented as global instead of per-workspace | Low | High — cross-tenant slug collisions block unrelated workspaces | AC2 Scenario 2.7 (cross-workspace same slug OK) |
| 2 | Missing RLS policy → users see projects from other workspaces | Low | Critical — data leak between tenants | AC5 Scenario 5.3 (RLS filter verification) |
| 3 | Slug auto-generation normalizes differently on server vs client preview | Medium | Medium — client shows slug `"my-app"`, server creates `"myapp"` | Positive outlines 1 (auto-slug verification) |
| 4 | Race condition on slug uniqueness without DB constraint | Low | High — duplicate projects with same slug | Edge case #6 (Idempotency-Key mitigation) |
| 5 | Reserved list too restrictive → legitimate project names rejected | Medium | Medium — user frustration, support tickets | PO Question #4 (confirm reserved list) |

---

## Next steps

- [ ] PO answers 4 Critical Questions before sprint planning
- [ ] Dev answers 5 Technical Questions before estimation
- [ ] Story updated in Jira with refined ACs (Phase 3) + edge cases (Phase 5) + label `shift-left-reviewed`
- [ ] API contract decision (nested vs flat) documented in Story comments
- [ ] Story enters sprint at status `Ready For Dev` once estimated
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit Phases 1-3 (label `shift-left-reviewed` detected) and add parametrization + test-data + numbered steps to the outlines above
