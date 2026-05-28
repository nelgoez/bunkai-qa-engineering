# Shift-Left Refinement: BK-4 — Create a Workspace

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-05-27
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context
- **Primary persona affected**: Elena (QA Engineer), Mateo (QA Lead / Manager)
- **Secondary personas (if any)**: Karim (CLI/CI — unlikely to create workspaces directly, but PAT-scoped access depends on workspace membership)
- **Business value proposition**: Tenant isolation — each Workspace is the root of a multi-tenant silo. Without this, no Project, Module, US, AC, ATC, Test, Run, or Bug can exist. It is the first state-changing operation after authentication.
- **KPI(s) influenced**: Activation rate — % of new workspaces that create ≥1 module + ≥1 ATC + ≥1 test within 24h (see `business-model.md`). If workspace creation fails or the UX is confusing, the activation funnel collapses immediately.
- **User journey position**: Journey 1 "First-time setup", Step 2 (immediately after OAuth sign-up / sign-in). Follows BK-1 (Email + OAuth sign-up) which auto-creates a default personal workspace on first verified login. This Story covers the _explicit_ workspace creation path — user clicks "Create Workspace" to create additional workspaces beyond the default.

### Technical context
- **Frontend**: Workspace create form (modal or dedicated page). Route: `/{workspace_slug}` (workspace home) is the navigation target. Components: Input (name), slug preview (live client-side), Button (submit). Form validation: Zod schema, field `name` (3–60 chars). See `business-feature-map.md` §5.2.
- **Backend**: `POST /api/v1/workspaces` with body `{ name }` → 201 `{ workspace_id, slug, role: "owner", plan: "community" }`. Route file: `app/api/v1/workspaces/route.ts`. FR: BK-002. Auth: Bearer (JWT session or PAT). Side effects: INSERT `workspaces` + `workspace_members` (role=owner); `workspace.created` event; `activity_log` row.
- **DB tables**: `workspaces` (id, slug, name, plan, created_at, …), `workspace_members` (workspace_id, user_id, role), `activity_log` (actor_id, action, entity_type, entity_id, payload_summary, at).
- **External services**: None. Internal dependency on Supabase Auth (user_id from session).
- **Integration points specific to this Story**: 
  - Auth middleware → verifies JWT or PAT, attaches `{ user_id, workspace_id?, scopes }` to request context.
  - Activity log system → appends row on state-changing endpoints (BK-038).
  - `workspace.created` event emitter → consumers unspecified at this Story level (likely Realtime broadcast, analytics pipeline).

### Story complexity
| Axis | Rating | Why |
|------|--------|-----|
| Business logic | Low | Single entity creation; straightforward ownership assignment. Slug derivation rules are the only non-trivial logic. |
| Integration | Low | Single internal DB transaction (workspaces + workspace_members + activity_log). No external service calls. |
| Data validation | Medium-High | Slug derivation pipeline has 6+ rules (lowercase, kebab-case, accents strip, trim hyphens, max 60, reserved check, uniqueness check). Name also has character/content validation. Each rule is a failure point. |
| UI | Low | Simple form: one input + live slug preview + submit button. No multi-step wizard. |

**Estimated test effort**: ~2–3 hours for manual exploratory testing. ~4–6 hours for automated test writing (given ~15–20 outlines with parametrization). Informs PO estimation.

### Epic-level inheritance (if applicable)
- **Epic**: EPIC-BK-001 — Tenancy & Identity
- **Risks restated at Story level**: 
  - Workspace is the tenant root — a bug in slug derivation (e.g., accepting a reserved slug like `admin`) corrupts the URL namespace for all downstream entities. This is the highest-severity risk in the tenancy epic.
  - RLS visibility: if `workspace_members` row is not inserted in the same transaction as `workspaces`, the creator cannot see their own workspace immediately → blank screen on redirect.
- **Integration points inherited**: Supabase Auth (user identity), activity log (audit trail).
- **PO/Dev answers already given at epic level**: 
  - Role hierarchy: `viewer ⊂ member ⊂ admin ⊂ owner` (from business-data-map.md).
  - Workspace slug is globally unique (confirmed in business-api-map.md §4.2).
  - No workspace deletion in MVP (confirmed in business-feature-map.md CRUD matrix).
- **Test strategy inherited**: Setup flow end-to-end (Journey 1), API contract validation against OpenAPI spec, RLS isolation verification.
- **Unique considerations not covered at epic level**: 
  - BK-1 auto-creates a default workspace on first sign-up. Does BK-4's explicit creation path interact with that logic? (e.g., can a user create a second workspace with the same name as their default? Yes — different slugs possible, but clarify.)
  - The `plan` field (`community` default) is in the response but not specified in this Story's description — scope creep or implicit?

---

## Phase 2 — Story Quality Analysis

### Ambiguities
| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|-------------------|---------------------|-------------------|------------------------|
| 1 | Business rule: "slug MUST NOT match any reserved value" | What is the **complete list** of reserved slugs? The master-test-plan mentions `admin` and `api` as examples, but the full list is absent from all context docs. | Cannot design the reserved-slug rejection test. If the list is missing, a dev might hardcode it inconsistently with expectations. | Document the reserved slug list explicitly. Minimum candidates: `admin`, `api`, `app`, `auth`, `bunkai`, `dashboard`, `settings`, `www`, `mail`, `status`, `docs`, `help`, `blog`, `test`, `dev`, `staging`, `prod`, `login`, `signup`, `workspace`, `workspaces`, `project`, `projects`, `new`, `create`, `edit`, `delete`. |
| 2 | Business rule: "accents stripped" | What normalization algorithm? NFKD decomposition + strip combining marks? What about non-Latin scripts (Cyrillic, CJK, Arabic)? E.g., "München" → "munchen" is expected; but does "東京" → "dong-jing" (transliterated) or stay as-is? | Cannot test non-Latin name inputs — unknown whether they pass validation and what slug they produce. | Specify normalization: Unicode NFKD → strip `\p{M}` → keep only `\p{L}\p{N}-`. If non-Latin characters are allowed in names, clarify slug behavior. |
| 3 | Business rule: "at least 1 alphanumeric character" | What is the character class? ASCII `[a-zA-Z0-9]` or Unicode `\p{Alphabetic}` + `\p{N}`? Japanese あ, Hindi अ, digits ١ (Arabic-Indic) — do they count? | Boundary tests for name validation need to know which characters are "alphanumeric." | Specify: "ASCII alphanumeric only (`[a-zA-Z0-9]`)" or "Unicode alphanumeric (`\p{L}\p{N}`)." |
| 4 | Workflow step 2: "UI shows name input + slug preview (client-side)" | Is the client-side slug derivation **byte-identical** to the server-side? If they diverge (e.g., client collapses consecutive hyphens but server doesn't), the user submits expecting slug X but gets slug Y. | Cannot test slug preview accuracy without knowing whether client and server share the same sluggification logic. | Client and server must share the same sluggification function (e.g., shared `slugify()` in a `@/utils` package). If they differ, document the differences and treat divergence as a bug. |
| 5 | Business rule: "max 60 chars" for slug | How is truncation handled? At 61 characters, is the slug truncated at the 60th character even if it cuts a word in half? Or does it drop the last partial word? | Truncation behavior affects the expected slug for long names — e.g., a 200-char name with a hyphen at position 59. | Specify: "Slug truncated to 60 chars at the character level, no word-boundary awareness." Or: "Truncate at the last hyphen before position 60, falling back to character-level if no hyphen exists." |
| 6 | Workflow step 8: "Navigate to new workspace home" | What is the exact URL pattern? `/{slug}`? What if navigation fails (e.g., React render error on workspace home for a workspace with no projects)? | Cannot verify the end-to-end flow completes correctly. | Specify the redirect URL pattern and the workspace home empty-state behavior. |
| 7 | Response: `{ workspace_id, slug }` (per Story) vs `{ id, slug, role: owner, plan: community }` (per business-api-map.md §3.1) | The Story says the response is `{ workspace_id, slug }`. The API map and journey narrative say it includes `role` and `plan`. Which is correct? | If the response is missing `role` and `plan`, the client may make unnecessary follow-up calls. | Confirm the 201 response shape. The API map's version is more complete and matches Journey 1 needs. |

### Gaps (missing info)
| # | Type | Why critical | What to add | Risk if omitted |
|---|------|--------------|-------------|-----------------|
| 1 | AC / Business rule | No error responses specified for any validation failure. What status code and error body for: invalid name, reserved slug, duplicate slug, missing name field, unauthorized? | Error catalog: per validation rule → HTTP status + error `code` + user-facing `message`. Minimum: 400 for validation (with `code` like `NAME_TOO_SHORT`, `NAME_NO_ALPHANUMERIC`, `SLUG_RESERVED`), 409 for duplicate slug (`SLUG_NOT_UNIQUE`), 401 for unauthorized (`UNAUTHORIZED`). | QA cannot write Negative test assertions without knowing the exact error shape. Dev may invent inconsistent error codes. |
| 2 | AC | No AC for the **slug uniqueness** check. The business rule says "slug MUST be globally unique" but there is no scenario testing this. | Add a Negative scenario: Given an existing workspace with slug "my-team", When a user creates a workspace named "My Team", Then the server rejects with 409 `SLUG_NOT_UNIQUE`. | Duplicate workspace slugs could pass through untested, creating a data integrity violation. |
| 3 | AC | No AC for the **reserved slug** rejection. The business rule exists but has no testable scenario. | Add a Negative scenario: Given the reserved list includes "admin", When a user creates a workspace named "Admin", Then the server rejects with 400/409 `SLUG_RESERVED`. | Reserved slug guard is the only defense against URL namespace pollution — if untested, it may not work. |
| 4 | Technical detail | No specification of how `workspace.created` event is consumed. Is it a Supabase Realtime broadcast? An internal event bus? A webhook? | Document the event: payload shape, transport mechanism, consumers. | If the event fires but no consumer exists, the server does useless work. If test expects a side effect (e.g., Realtime subscription receives event), the test is blocked. |
| 5 | Business rule | No limit on how many workspaces a user can create. Could a single user create 10,000 workspaces and exhaust the slug namespace? | Specify a workspace creation rate limit or per-user cap. The existing rate limit (100 req/min writes) applies but doesn't prevent slow accumulation. | Denial-of-wallet (Cloud edition billing implications) or slug namespace exhaustion. |
| 6 | AC | No scenario covering the **transaction atomicity** promise. If `workspace_members` insert fails, does the `workspaces` row get rolled back? | Add an Integration scenario: simulate a `workspace_members` insert failure (e.g., FK violation) and verify the `workspaces` row does NOT persist (rolled back). | Orphaned workspace rows (no owner) would be invisible to the creator and unrecoverable without admin intervention. |
| 7 | AC | No scenario for what happens when an **unauthenticated** user hits `POST /workspaces`. | Add a Negative scenario: Given no valid auth token, When POST /workspaces, Then 401 `UNAUTHORIZED`. | Trivial gap but standard coverage for any authenticated endpoint. |
| 8 | Business rule | The `activity_log` side effect is mentioned but never validated. What exact fields are written? | Specify: `actor_id` = creator's `user_id`, `action` = `"workspace.created"`, `entity_type` = `"workspace"`, `entity_id` = new workspace id, `payload_summary` = `{ name, slug }`. | Activity log integrity is cross-cutting (BK-038) but this Story is the first to exercise it. |

### Edge cases not in Story
| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|----------|-------------------------------|-------------|--------|
| 1 | Name contains only special characters (e.g., `!!!`, `---`, `   `) — no alphanumeric | Reject with 400 `NAME_NO_ALPHANUMERIC` | High | Add to AC |
| 2 | Name normalizes to a slug matching a reserved value (e.g., name "Admin" → slug "admin") | Reject with 400 `SLUG_RESERVED` | Critical | Add to AC — tied to Ambiguity #1 (reserved list) |
| 3 | Name normalizes to a slug already in use (e.g., "My-Team" when workspace "my team" exists) | Reject with 409 `SLUG_NOT_UNIQUE` | Critical | Add to AC — this is Gap #2 |
| 4 | Name with Unicode characters (e.g., "München", "東京", "Привет") | Depends on normalization spec (Ambiguity #2). Best guess: "München" → slug "munchen", "東京" → may produce empty slug or be preserved. | Medium | Add to AC once PO clarifies normalization |
| 5 | Name with only numbers (e.g., "12345") | Should succeed — "12345" contains alphanumeric chars. Slug = "12345". | Medium | Test only — add outline |
| 6 | Name at exact minimum boundary: 3 chars, all valid (e.g., "ABC") | Accept. Slug = "abc". | High | Add to AC (Boundary) |
| 7 | Name at exact maximum boundary: 60 chars, all valid | Accept. Slug = full 60-char kebab-case. | High | Add to AC (Boundary) |
| 8 | Name exceeds maximum: 61 chars | Reject with 400 `NAME_TOO_LONG` | High | Add to AC (Boundary) |
| 9 | Name below minimum: 2 chars (e.g., "AB") | Reject with 400 `NAME_TOO_SHORT` | High | Add to AC (Boundary) |
| 10 | Name with leading/trailing whitespace (e.g., "  My Team  ") | Trim whitespace before validation. Slug = "my-team". | Medium | Add to AC — or clarify if server trims |
| 11 | Name that produces a slug > 60 chars after normalization (e.g., a 200-char name with no spaces, all letters) | Slug truncated to 60 chars. | Medium | Add to AC (Boundary) |
| 12 | Rapid double-submit (user clicks "Create" twice before response) | Idempotency: second request returns same workspace_id or is rejected. The Story doesn't mention `Idempotency-Key` — is it supported on this endpoint? | Medium | Ask Dev — add to AC if idempotency is supported |
| 13 | Name with consecutive spaces/hyphens (e.g., "Hello---World", "Hello   World") | Consecutive hyphens preserved or collapsed? Best guess: collapse to single hyphen → "hello-world". | Low | Ask PO — add to AC once clarified |
| 14 | Name with HTML/script tags (e.g., `<script>alert(1)</script>`) | Accept (no XSS risk in name field) OR reject as suspicious? Best guess: accept, since the name is stored as plain text and the slug is sanitized by the kebab-case transform (strips `<`, `>`, etc.). | Medium | Test only — verify slug derivation strips script characters |
| 15 | Name with emoji (e.g., "My Team 🚀") | Emoji stripped during sluggification? Or name rejected for non-alphanumeric content? Best guess: emoji stripped, resulting slug "my-team" accepted. | Low | Ask PO — add to AC once clarified |
| 16 | Name containing SQL injection payload (e.g., `'; DROP TABLE workspaces; --`) | Treated as plain text — no SQL injection possible with parameterized queries + Zod validation. Slug becomes a sanitized string. | Low | Test only — verify ORM/parameterized queries |
| 17 | User already has an auto-created default workspace (from BK-1). They create a second workspace. | Should succeed — users can own multiple workspaces. Both memberships coexist. Default workspace is unaffected. | Medium | Add to AC — verify existing memberships are preserved |
| 18 | Name that normalizes entirely to hyphens (e.g., "! @ #") after stripping non-alphanumeric chars | Reject — resulting slug would be empty after trimming hyphens. What error code? `NAME_NO_ALPHANUMERIC` or `SLUG_EMPTY`? | Medium | Ask Dev — add to AC once clarified |

### Contradictions
| # | Source A | Source B | Conflict | Resolution needed |
|---|----------|----------|----------|-------------------|
| 1 | Story description: "201 { workspace_id, slug }" | `business-api-map.md` §3.1: "201 { id, slug, role: owner, plan: community }" | Response body shape differs — Story omits `role` and `plan` fields. | Confirm the actual 201 response. The API map's version is richer and aligns with Journey 1 needs (client needs to know the creator's role immediately). Recommend adopting the API map's shape. |
| 2 | Story description: "slug MUST NOT match any reserved value" | No context file documents the reserved list. `master-test-plan.md` §2.5 mentions "someone claims `admin` or `api` as a slug" as a risk. | The guard is mandated but the list is undefined. | PO must provide the reserved slug list before implementation. Without it, the validation cannot be implemented or tested. |

### Testability validation
**Verdict**: Partial

Issues:
- **Missing error catalog** — no error messages, status codes, or error `code` values specified for any validation failure path.
- **Undefined reserved slug list** — the reserved-slug rejection rule cannot be tested without knowing what values are reserved.
- **Vague sluggification spec** — "accents stripped" and "alphanumeric" are ambiguous without Unicode normalization details.
- **Missing test data examples** — no valid/invalid name examples provided in the Story.
- **Unspecified event consumer** — `workspace.created` event side effect cannot be verified without knowing the consumer (Realtime channel? Internal bus? webhook?).
- **No idempotency specification** — unclear if `Idempotency-Key` is supported on this endpoint (it is on other write endpoints per BK-037).

---

## Phase 3 — Refined Acceptance Criteria

### Original AC1 — Name validation (3–60 chars, ≥1 alphanumeric)

#### Scenario 1.1: Should create workspace with valid name (Type: Positive, Priority: Critical)
- **Given**: An authenticated user (JWT session) with no pre-existing workspace of the same slug
- **When**: POST `/api/v1/workspaces` with body `{ "name": "My QA Team" }`
- **Then**:
  - UI: Redirect to `/{slug}` workspace home. Slug preview matched the final slug during form interaction.
  - API: `201 Created`, body `{ "success": true, "data": { "id": "<uuid>", "slug": "my-qa-team", "name": "My QA Team", "role": "owner", "plan": "community" } }`
  - DB: `workspaces` row with `slug = "my-qa-team"`, `name = "My QA Team"`. `workspace_members` row with `user_id = <creator>`, `role = "owner"`. `activity_log` row with `action = "workspace.created"`, `entity_type = "workspace"`, `entity_id = <new workspace id>`.
  - System state: `workspace.created` event emitted. Creator's active workspace count incremented by 1.

#### Scenario 1.2: Should reject name shorter than 3 characters (Type: Negative, Priority: High)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "AB" }`
- **Then**: API `400 Bad Request`, body `{ "success": false, "error": { "code": "NAME_TOO_SHORT", "message": "Workspace name must be between 3 and 60 characters" } }`. No DB change in `workspaces` or `workspace_members`.

#### Scenario 1.3: Should reject name longer than 60 characters (Type: Negative, Priority: High)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "A".repeat(61) }`
- **Then**: API `400 Bad Request`, body `{ "success": false, "error": { "code": "NAME_TOO_LONG", "message": "Workspace name must be between 3 and 60 characters" } }`. No DB change.

#### Scenario 1.4: Should reject name with no alphanumeric characters (Type: Negative, Priority: High)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "!!! @@@ ###" }`
- **Then**: API `400 Bad Request`, body `{ "success": false, "error": { "code": "NAME_NO_ALPHANUMERIC", "message": "Workspace name must contain at least one alphanumeric character" } }`. No DB change.

#### Scenario 1.5: Should accept name at exact minimum boundary (Type: Boundary, Priority: High)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "ABC" }`
- **Then**: API `201 Created`. Slug = `"abc"`. Workspace created.

#### Scenario 1.6: Should accept name at exact maximum boundary (Type: Boundary, Priority: High)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "<60 alphanumeric chars>" }` (e.g., "A".repeat(60))
- **Then**: API `201 Created`. Slug = 60-char kebab-case string derived from the name.

#### Scenario 1.7: Should trim leading/trailing whitespace from name (Type: Edge, Priority: Medium)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "   My Team   " }`
- **Then**: API `201 Created`. Name stored as `"My Team"`, slug = `"my-team"`. **NEEDS PO/DEV CONFIRMATION**: does the server trim whitespace, or is it the client's responsibility?

#### Scenario 1.8: Should reject name that normalizes to empty slug (Type: Edge, Priority: Medium)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "😀😀😀" }` (all characters stripped during sluggification, leaving empty string)
- **Then**: API `400 Bad Request`, body `{ "success": false, "error": { "code": "SLUG_EMPTY", "message": "Workspace name must produce a non-empty slug" } }`. No DB change. **NEEDS PO/DEV CONFIRMATION**: error code and message.

### Original AC2 — Slug derivation (lowercase, kebab-case, accents stripped, no leading/trailing hyphens, max 60 chars)

#### Scenario 2.1: Should derive slug as lowercase kebab-case (Type: Positive, Priority: Critical)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "My QA Team" }`
- **Then**: Server derives slug `"my-qa-team"`. Spaces → hyphens, uppercase → lowercase. Slug stored in `workspaces.slug`.

#### Scenario 2.2: Should strip accents from name during sluggification (Type: Positive, Priority: High)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "München QA" }`
- **Then**: Server derives slug `"munchen-qa"`. `ü` → `u`, `M` → `m`. **NEEDS PO/DEV CONFIRMATION**: what normalization? NFKD assumed.

#### Scenario 2.3: Should strip leading and trailing hyphens from slug (Type: Positive, Priority: High)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "- My Team -" }`
- **Then**: Server derives slug `"my-team"`. Leading and trailing hyphens removed.

#### Scenario 2.4: Should truncate slug to max 60 characters (Type: Boundary, Priority: High)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "<200 lowercase letters, no spaces>" }` (e.g., "a".repeat(200))
- **Then**: Server derives slug = first 60 characters of the name. Slug length = 60. **NEEDS PO/DEV CONFIRMATION**: is it character-level truncation or word-boundary-aware?

#### Scenario 2.5: Should handle name with only numbers (Type: Edge, Priority: Medium)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "12345" }`
- **Then**: Server derives slug `"12345"`. Creation succeeds — numbers are alphanumeric.

### Original AC3 — Slug uniqueness (globally unique)

#### Scenario 3.1: Should reject workspace creation when slug already exists (Type: Negative, Priority: Critical)
- **Given**: A workspace exists with slug `"my-team"`
- **When**: POST `/api/v1/workspaces` with body `{ "name": "My Team" }`
- **Then**: API `409 Conflict`, body `{ "success": false, "error": { "code": "SLUG_NOT_UNIQUE", "message": "A workspace with this slug already exists" } }`. No DB change.

#### Scenario 3.2: Should reject workspace creation when different name produces same slug (Type: Negative, Priority: Critical)
- **Given**: A workspace exists with name "My-Team" → slug `"my-team"`
- **When**: POST `/api/v1/workspaces` with body `{ "name": "my team" }`
- **Then**: API `409 Conflict`, `SLUG_NOT_UNIQUE`. No DB change. **NEEDS PO/DEV CONFIRMATION**: should the error message suggest the user pick a different name?

### Original AC4 — Reserved slug guard

#### Scenario 4.1: Should reject workspace creation when slug matches a reserved value (Type: Negative, Priority: Critical)
- **Given**: The reserved slug list includes `"admin"` (exact list TBD — see Critical Question #1)
- **When**: POST `/api/v1/workspaces` with body `{ "name": "Admin" }`
- **Then**: API `400 Bad Request` (or `409 Conflict`?), body `{ "success": false, "error": { "code": "SLUG_RESERVED", "message": "This workspace slug is reserved and cannot be used" } }`. No DB change. **NEEDS PO/DEV CONFIRMATION**: exact status code (400 vs 409), exact reserved list.

### Original AC5 — Creator inherits role owner

#### Scenario 5.1: Should assign creator the owner role (Type: Positive, Priority: Critical)
- **Given**: An authenticated user with `user_id = "usr_abc123"`
- **When**: POST `/api/v1/workspaces` with body `{ "name": "My Workspace" }`
- **Then**: DB: `workspace_members` row with `workspace_id = <new>`, `user_id = "usr_abc123"`, `role = "owner"`. Response includes `"role": "owner"`.

#### Scenario 5.2: Should create workspace and membership in a single atomic transaction (Type: Integration, Priority: Critical)
- **Given**: A simulated DB failure on `workspace_members` insert (e.g., FK constraint violation)
- **When**: POST `/api/v1/workspaces` with body `{ "name": "Atomic Test" }`
- **Then**: The entire transaction rolls back. No `workspaces` row exists. No `workspace_members` row exists. API returns 500 or 400, NOT 201.

### Original AC6 — Successful creation flow end-to-end

#### Scenario 6.1: Should complete full creation flow from UI to workspace home (Type: Positive, Priority: Critical)
- **Given**: An authenticated user on the workspace creation screen
- **When**: User types "My QA Team" → sees live slug preview "my-qa-team" → clicks "Create Workspace"
- **Then**: POST fires → 201 received → browser navigates to `/{slug}` workspace home. Workspace home renders with empty state (no projects yet) + CTA "Create Project".

#### Scenario 6.2: Should update slug preview in real-time as user types (Type: Positive, Priority: Medium)
- **Given**: An authenticated user on the workspace creation screen
- **When**: User types "Hello World" into the name input
- **Then**: Slug preview shows "hello-world" before submission. Client-side sluggification matches server-side output.

### Additional scenarios from Phase 2 gaps and edge cases

#### Scenario E-Auth1: Should reject unauthenticated requests (Type: Negative, Priority: High)
- **Given**: No valid auth token
- **When**: POST `/api/v1/workspaces` with body `{ "name": "Test" }`
- **Then**: API `401 Unauthorized`, body `{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }`. No DB change.

#### Scenario E-Multi: Should allow user to create second workspace while preserving existing memberships (Type: Positive, Priority: Medium)
- **Given**: User already owns workspace "team-alpha" (from BK-1 or prior creation)
- **When**: POST `/api/v1/workspaces` with body `{ "name": "Team Beta" }`
- **Then**: API `201 Created`. Workspace "team-beta" created. User now member of both workspaces with `role = "owner"` in each. Existing `workspace_members` row for "team-alpha" is unchanged.

#### Scenario E-XSS: Should sanitize name containing HTML/script tags (Type: Edge, Priority: Medium)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "<script>alert('xss')</script>" }`
- **Then**: API `201 Created` (name stored as literal text, not executed). Slug derived from name — characters like `<`, `>`, `/` stripped by kebab-case transform. Slug does not contain script-viable characters. Response body does not render HTML. **NEEDS PO/DEV CONFIRMATION**: should the server reject names with `<`, `>` characters as suspicious, or accept them as literal text?

#### Scenario E-Spaces: Should collapse consecutive spaces in name to single hyphen in slug (Type: Edge, Priority: Low)
- **Given**: An authenticated user
- **When**: POST `/api/v1/workspaces` with body `{ "name": "Hello    World" }` (multiple spaces)
- **Then**: Slug = `"hello-world"` (consecutive spaces → single hyphen). **NEEDS PO/DEV CONFIRMATION**: behavior for consecutive hyphens/spaces.

#### Scenario E-Existing: Should allow creating workspace with same display name as existing workspace if slugs differ (Type: Edge, Priority: Medium)
- **Given**: A workspace exists with slug `"my-team"` (name "My Team")
- **When**: POST `/api/v1/workspaces` with body `{ "name": "My Team!" }`
- **Then**: Slug = `"my-team-1"` or `"my-team"` (collision)? Best guess: slug becomes `"my-team"` → 409 `SLUG_NOT_UNIQUE`. If the server auto-appends a suffix, document it. **NEEDS PO/DEV CONFIRMATION**.

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate
| Type | Count | Notes |
|------|-------|-------|
| Positive | 6 | Happy path: valid name, slug derivation (lowercase, kebab, accents), owner assignment, full UI→API→redirect flow, second workspace creation, live slug preview |
| Negative | 9 | Invalid name (too short, too long, no alphanumeric), unauthenticated, reserved slug, duplicate slug, empty slug after normalization, missing body, missing name field, wrong content-type |
| Boundary | 6 | Name at 3 chars (min), name at 60 chars (max), name at 61 chars (over max), name at 2 chars (under min), slug at 60 chars (max), slug > 60 chars (truncation) |
| Integration | 3 | Transaction atomicity (workspaces + workspace_members rollback), activity_log write, workspace.created event emission |
| API | 5 | POST /workspaces success, POST /workspaces validation errors (×3), GET /workspaces (list includes new workspace) |
| **Total** | **29** | Drives PO estimation |

**Rationale**: Workspace creation is a medium-complexity endpoint due to the multi-rule sluggification pipeline (6+ rules), global uniqueness constraint, reserved-list guard, and transactional side effects. The 29 outlines cover every validation rule individually (each is a distinct failure mode), every boundary condition, and the integration points (atomicity, event, activity log). This count reflects the Data Validation rating of Medium-High from Phase 1 — each slug derivation rule is a separate test surface.

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive
- **Should create workspace with simple name** — Pre: authenticated user. Expected: 201, slug = "my-qa-team", role = "owner", workspace + member rows created.
- **Should derive lowercase kebab-case slug** — Pre: authenticated user, name "My QA Team". Expected: slug = "my-qa-team".
- **Should strip accents during sluggification** — Pre: authenticated user, name "München". Expected: slug = "munchen".
- **Should assign creator owner role** — Pre: authenticated user. Expected: workspace_members row with role = "owner".
- **Should navigate to workspace home after creation** — Pre: UI form filled, valid name. Expected: browser redirects to /{slug}, workspace home renders empty state.
- **Should allow creating a second workspace** — Pre: user already owns one workspace. Expected: 201, both memberships preserved, existing workspace unaffected.

#### Negative
- **Should reject name shorter than 3 characters** — Pre: authenticated user, name "AB". Expected: 400 NAME_TOO_SHORT, no DB change.
- **Should reject name longer than 60 characters** — Pre: authenticated user, name of 61 chars. Expected: 400 NAME_TOO_LONG, no DB change.
- **Should reject name with no alphanumeric characters** — Pre: authenticated user, name "!!!". Expected: 400 NAME_NO_ALPHANUMERIC, no DB change.
- **Should reject unauthenticated request** — Pre: no auth token. Expected: 401 UNAUTHORIZED, no DB change.
- **Should reject slug matching reserved value** — Pre: reserved list includes "admin", name "Admin". Expected: 400/409 SLUG_RESERVED, no DB change.
- **Should reject duplicate slug** — Pre: workspace "my-team" exists. Expected: 409 SLUG_NOT_UNIQUE, no DB change.
- **Should reject name producing empty slug** — Pre: name "😀😀😀" or "---". Expected: 400 SLUG_EMPTY, no DB change.
- **Should reject missing name field in body** — Pre: authenticated user, body `{}`. Expected: 400 VALIDATION_ERROR, no DB change.
- **Should reject name that normalizes to only hyphens** — Pre: name "! @ #". Expected: 400 NAME_NO_ALPHANUMERIC or SLUG_EMPTY, no DB change.

#### Boundary
- **Should accept name at exactly 3 characters** — Pre: authenticated user, name "ABC". Expected: 201, slug = "abc".
- **Should accept name at exactly 60 characters** — Pre: authenticated user, name with 60 alphanumeric chars. Expected: 201, slug = 60-char string.
- **Should reject name at 61 characters** — Pre: authenticated user, name of 61 chars. Expected: 400 NAME_TOO_LONG.
- **Should reject name at 2 characters** — Pre: authenticated user, name "AB". Expected: 400 NAME_TOO_SHORT.
- **Should truncate slug derived from name to 60 chars** — Pre: name of 200 chars (all letters, no spaces). Expected: 201, slug = first 60 chars.
- **Should reject name at 60 chars where slug would be empty after strip** — Pre: name consists of 60 special chars with no alphanumeric. Expected: 400 NAME_NO_ALPHANUMERIC.

#### Integration
- **Should rollback transaction if workspace_members insert fails** — Pre: simulated DB error on workspace_members insert. Expected: no workspaces row persists, API returns 500 or appropriate error.
- **Should write activity_log row on successful creation** — Pre: authenticated user. Expected: activity_log row with action "workspace.created", actor_id = user_id, entity_type = "workspace", entity_id = new id.
- **Should emit workspace.created event on successful creation** — Pre: event consumer subscribed. Expected: event payload contains workspace_id, slug, owner user_id.

#### API
- **Should return 201 with correct response body shape** — Pre: authenticated user, valid name. Expected: { success: true, data: { id, slug, name, role, plan } }.
- **Should return 400 with VALIDATION_ERROR for empty body** — Pre: authenticated user, empty body. Expected: 400, code VALIDATION_ERROR.
- **Should return 400 with specific code for name validation failure** — Pre: authenticated user, invalid name. Expected: 400, specific error code matching the validation rule violated.
- **Should return 409 for duplicate slug** — Pre: slug collision exists. Expected: 409, code SLUG_NOT_UNIQUE.
- **Should list newly created workspace in GET /workspaces** — Pre: workspace just created. Expected: GET /workspaces includes new workspace in list.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|-----------|-------------------|-------------|--------|
| 1 | Name with only special characters (no alphanumeric) | No | High | Add to AC (Scenario 1.4) |
| 2 | Name produces reserved slug | No | Critical | Add to AC (Scenario 4.1) — blocked on reserved list |
| 3 | Name produces duplicate slug | No | Critical | Add to AC (Scenarios 3.1, 3.2) |
| 4 | Unicode/non-Latin name characters | No | Medium | Add to AC (Scenario 2.2 accents) — blocked on normalization spec |
| 5 | Name with only numbers | No | Medium | Test outline (Scenario 2.5) |
| 6 | Name at exact 3-char boundary | No | High | Add to AC (Scenario 1.5) |
| 7 | Name at exact 60-char boundary | No | High | Add to AC (Scenario 1.6) |
| 8 | Name exceeds 60 chars | No | High | Add to AC (Scenario 1.3) |
| 9 | Leading/trailing whitespace in name | No | Medium | Add to AC (Scenario 1.7) — PO confirm |
| 10 | Slug > 60 chars after normalization | No | Medium | Add to AC (Scenario 2.4) — Dev confirm truncation |
| 11 | Rapid double-submit (idempotency) | No | Medium | Ask Dev — idempotency supported? |
| 12 | XSS/HTML in name | No | Medium | Test outline (Scenario E-XSS) — PO confirm |
| 13 | SQL injection payload in name | No | Low | Test outline only — verify parameterized queries |
| 14 | Emoji in name | No | Low | Ask PO — reject or strip? |
| 15 | User creating workspace when they already have one (multi-workspace) | No | Medium | Add to AC (Scenario E-Multi) |
| 16 | Name normalizes to empty slug | No | Medium | Add to AC (Scenario 1.8) |
| 17 | Consecutive spaces/hyphens in name | No | Low | Ask PO (Scenario E-Spaces) |
| 18 | Concurrent slug collision (two users creating same name simultaneously at edge) | No | Low | Test outline only — DB-level UNIQUE constraint should catch this |

> Test-data generation strategy + Faker recipes are NOT defined here. They land in `/sprint-testing` Stage 1 when the feature exists.

---

## Story Quality Assessment

**Verdict**: Needs Improvement

**Key findings**:
- **Missing error catalog** — the Story defines 4 business rules but zero error responses. Every Negative scenario is blocked until error codes, status codes, and messages are specified.
- **Undefined reserved slug list** — the `SLUG_RESERVED` guard is critical for URL namespace integrity but the reserved list is mentioned nowhere in context docs. PO must provide this list.
- **Sluggification algorithm is underspecified** — "accents stripped," "alphanumeric character," and truncation behavior are ambiguous without Unicode normalization details. This creates a high risk of client/server slug divergence.
- **Response body contradiction** — the Story says `{ workspace_id, slug }` but the API map says `{ id, slug, role, plan }`. The richer response is needed for Journey 1.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **What is the complete list of reserved workspace slugs?**
   - **Context**: The Story says "slug MUST NOT match any reserved value" but no list is documented. The master-test-plan hints at `admin` and `api`.
   - **Impact if unanswered**: The SLUG_RESERVED validation cannot be implemented or tested. A malicious or accidental user could claim `admin`, `api`, `settings`, or other critical slugs, polluting the URL namespace.
   - **Suggested answer**: `admin`, `api`, `app`, `auth`, `bunkai`, `dashboard`, `settings`, `www`, `mail`, `status`, `docs`, `help`, `blog`, `test`, `dev`, `staging`, `prod`, `login`, `signup`, `logout`, `workspace`, `workspaces`, `project`, `projects`, `new`, `create`, `edit`, `delete`, `search`, `403`, `404`, `500`.

2. **What is the Unicode normalization strategy for sluggification?**
   - **Context**: "Accents stripped" is vague. Should "München" → "munchen" (NFKD)? What about "東京" — should it produce a slug, be rejected, or transliterated?
   - **Impact if unanswered**: Non-Latin workspace names are untestable. Client/server slug divergence is likely if normalization isn't specified.
   - **Suggested answer**: NFKD normalization → strip combining marks → keep only `[a-z0-9-]`. Non-Latin characters that don't map to ASCII are stripped. If the resulting slug is empty, reject with `SLUG_EMPTY`.

3. **Should the client and server share the same sluggification function?**
   - **Context**: The Story says the UI shows a "slug preview (client-side)." If client-side logic diverges from server-side, the user submits expecting slug X but receives slug Y.
   - **Impact if unanswered**: Slug preview UX is broken — users see one slug but get another, causing confusion and support tickets.
   - **Suggested answer**: Yes. Extract a shared `slugify()` function into a `@/utils/slug` package used by both the Zod validation (server) and the form component (client).

4. **Should name leading/trailing whitespace be trimmed server-side or client-side?**
   - **Context**: The Story doesn't specify. If the client trims but the server doesn't, the user may submit "  My Team  " and get rejected or stored with spaces.
   - **Impact if unanswered**: Edge case 9 (whitespace) is untestable.
   - **Suggested answer**: Both. Client trims for UX; server trims as a safety net. Stored name is always trimmed.

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **Is `Idempotency-Key` supported on `POST /workspaces`?**
   - **Context**: BK-037 (Idempotency-Key) applies to "all write endpoints." Workspace creation is a write endpoint. But the Story doesn't mention idempotency.
   - **Testing impact**: If supported, add idempotency outlines (Scenario E-Retry). If not, rapid double-submit may create duplicate workspaces.

2. **What happens when slug normalization produces an empty string?**
   - **Context**: If name = "😀😀😀" or "---", all characters are stripped, leaving an empty slug after trim.
   - **Testing impact**: Need to know the exact error code (`SLUG_EMPTY` vs `NAME_NO_ALPHANUMERIC` vs something else).

3. **Are consecutive hyphens in the slug collapsed or preserved?**
   - **Context**: Name "Hello---World" → slug "hello---world" or "hello-world"?
   - **Testing impact**: Slug derivation test data depends on this.

4. **How is the `workspace.created` event consumed?**
   - **Context**: The Story says "Emit workspace.created event" but no consumer is specified. Is it a Supabase Realtime broadcast? An internal event bus? A future webhook?
   - **Testing impact**: The integration test for event emission needs to know where to listen.

5. **What is the exact 201 response body shape?**
   - **Context**: Story says `{ workspace_id, slug }`; API map says `{ id, slug, role, plan }`. The client needs `role` and `plan` for the workspace home.
   - **Testing impact**: Response assertion shape is unknown.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | No error responses specified | Add error catalog: per validation rule → HTTP status + error code + message (e.g., 400 `NAME_TOO_SHORT`, 400 `NAME_NO_ALPHANUMERIC`, 409 `SLUG_NOT_UNIQUE`, 400 `SLUG_RESERVED`, 400 `SLUG_EMPTY`) | Negative scenarios become testable. Dev writes consistent error handling. |
| 2 | "slug MUST NOT match any reserved value" (no list) | Append: "Reserved slugs: admin, api, app, auth, bunkai, dashboard, settings, www, mail, status, docs, help, blog, test, dev, staging, prod, login, signup, logout, workspace, workspaces, project, projects, new, create, edit, delete, search, 403, 404, 500" | Critical validation rule becomes implementable and testable. |
| 3 | "accents stripped" (vague) | Append: "NFKD normalization → strip combining marks → keep only [a-z0-9-]. Characters that don't map collapse to hyphens; empty result rejected." | Unicode behavior is deterministic and testable. |
| 4 | Response body: `{ workspace_id, slug }` | Change to: `{ id, slug, name, role, plan }` as per API map and Journey 1 needs | Client gets all needed data in one response — no follow-up GET /me required. |
| 5 | "Navigate to new workspace home" (no URL) | Add: "Navigate to `/{slug}`. If workspace is empty (no projects), render empty state with 'Create your first project' CTA." | UX expectation is testable end-to-end. |
| 6 | Missing DoD item: "OpenAPI spec updated" | Add to Definition of Done: "POST /workspaces endpoint documented in api-contracts.yaml with request/response schemas and error codes" | API consumers (agents, CLI) can self-discover the contract. |

---

## Data feasibility flags

No data feasibility risks identified. The endpoint creates new data; all preconditions (authenticated user) are available in staging. No pre-existing data required for Positive scenarios. For Negative scenarios (duplicate slug), a seeded workspace is needed — trivial to create via the same endpoint.

---

## Recommended testing strategy

### Pre-implementation
- Review and approve the refined ACs with PO.
- Resolve the reserved slug list, Unicode normalization spec, and error catalog before Dev starts.
- Validate shared `slugify()` implementation with a test suite covering all edge cases BEFORE it's wired into the API.

### During implementation
- Contract-first development: define the OpenAPI spec for `POST /workspaces` before writing the handler.
- Unit test the `slugify()` function in isolation with 15–20 input/output pairs.
- Integration test the transactional insert (rollback on failure).

### Post-implementation (in-sprint by /sprint-testing)
- Execute all 29 outlines defined in Phase 4 (with parametrization expanded by sprint-testing).
- End-to-end test: Journey 1 Steps 1–2 (sign-up → workspace creation → workspace home renders).
- Verify `workspace.created` event reaches its consumer.
- Verify activity log integrity (BK-038 cross-cutting check).

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|-----------------------------|
| 1 | Client/server slug divergence — user sees one slug, gets another | Medium | High — user confusion, support tickets, trust erosion | Positive outlines #2, #6 (slug preview accuracy). Mitigated by shared `slugify()` — see Critical Question #3. |
| 2 | Reserved slug list missing — someone claims `admin` or `api` | Medium | Critical — URL namespace pollution, hard to undo | Negative outline "reserved slug." Mitigated by Critical Question #1. |
| 3 | Orphaned workspace (transaction not atomic) — workspace row exists but creator has no membership | Low | Critical — user creates workspace, gets redirected, sees 403 or blank | Integration outline #1 (rollback). Mitigated by DB transaction + Integration test. |
| 4 | Duplicate slug race condition — two users create same-name workspaces simultaneously | Low | Medium — one wins, one gets 409, no data corruption | API outline "409 for duplicate slug." Mitigated by DB UNIQUE constraint on `slug`. |
| 5 | Activity log not written — audit trail gap | Low | Medium — workspace creation event lost from timeline | Integration outline #2. Mitigated by transactional insert in the same DB operation. |

---

## Next steps

- [ ] PO answers Critical Questions #1–#4 before sprint planning
- [ ] Dev answers Technical Questions #1–#5 before estimation
- [ ] Story description updated with refined ACs + edge cases + error catalog (Jira comment mirror)
- [ ] Label `shift-left-reviewed` added to BK-4
- [ ] Story enters sprint at status `Ready For Dev` once estimated
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected) and expand outlines with parametrization + test-data JSON + Faker recipes

**BLOCKER**: Critical Questions #1 (reserved slug list) and #2 (Unicode normalization) MUST be answered before Dev starts. The reserved-slug guard and sluggification algorithm are implementation-critical paths.
