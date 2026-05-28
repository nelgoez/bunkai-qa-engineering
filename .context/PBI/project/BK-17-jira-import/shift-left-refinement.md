# Shift-Left Refinement: BK-17 — Async one-way Jira import by JQL

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-05-27
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context
- **Primary persona affected**: Mateo (QA Lead) — configures integrations, imports Jira backlog, manages module taxonomy
- **Secondary personas (if any)**: Elena (QA Engineer) — consumes imported user stories + ACs to author ATCs; Sara (Developer) — views imported stories for acceptance clarity
- **Business value proposition**: Seeds a Bunkai Project from an existing Jira backlog without manual copy-paste. Eliminates the adoption friction of retyping dozens/hundreds of user stories. A one-way async pull means Mateo clicks "Import" once and returns to find the Project populated.
- **KPI(s) influenced**: Time-to-first-ATC (Journey 1 funnel metric — from sign-in to first authored ATC), Project setup time, user_story creation volume
- **User journey position**: Journey 1, Step 5 — after Project + Module tree creation, before first ATC authorship. The import is the bridge between an empty Bunkai Project and a populated US/AC backlog ready for ATC authorship.

### Technical context
- **Frontend**: Project Settings → Integrations → "Import from Jira" panel. JQL text input + "Import" submit button. Status polling UI (GET /imports/{id}) showing progress (queued → running → completed/failed) with imported_count/created_count/updated_count/skipped_count + errors[]. `business-feature-map.md` §5.1 "User Story editor" screen includes "Import from Jira" CTA.
- **Backend**: 
  - `POST /imports/jira` `{ project_id, jql }` → 202 `{ import_job_id }`. Handler enqueues async worker. Auth: Bearer + role (member+) + scope:write. FR backing: {{PROJECT_KEY}}-009. (`business-api-map.md` §4.12)
  - `GET /imports/{import_job_id}` → 200 `{ status, imported_count, created_count, updated_count, skipped_count, errors[], started_at, finished_at }`. Poll endpoint. (`business-api-map.md` §4.12)
  - **Async worker**: pg_cron-scheduled Supabase Edge Function (MVP) / BullMQ+Redis (Phase 2 self-hosted). Picks up queued `imports` rows, fetches Jira credentials from `integrations` row (`kind=jira`, `config` jsonb, `secrets_ref`), calls Jira REST `/rest/api/3/search` in chunks of 500, parses ADF→Markdown, heuristically extracts AC bullets, resolves target Module by Jira component name match (fallback "Inbox"), upserts `user_stories` + `acceptance_criteria` keyed on `external_id`. (`business-data-map.md` §5 Async Workers, §6 External Integrations)
- **External services**: Jira REST API v3 (`/rest/api/3/search` with `jql`, `startAt`, `maxResults=500`). Atlassian Document Format (ADF) as the source format for issue descriptions.
- **Integration points specific to this Story**:
  - `integrations` table: stores Jira PAT (`secrets_ref`), Jira base URL, JQL templates in `config` jsonb. No public API for integrations management in MVP (Discovery Gap G3 in feature-map).
  - `imports` table: Discovery Gap G1 in `business-data-map.md` — table referenced by {{PROJECT_KEY}}-009 but NOT declared in canonical ERD. Suggested columns: `id, project_id, kind, status, jql, imported_count, created_count, updated_count, skipped_count, errors_jsonb, started_at, finished_at`.
  - `user_stories.external_id` + `acceptance_criteria` (generated from AC heuristic extraction)
  - Module tree: resolved from Jira `components` field → Bunkai Module name match

### Story complexity
| Axis | Rating | Why |
|------|--------|-----|
| Business logic | High | Idempotency dedup, AC heuristic extraction, component→Module mapping, Inbox auto-creation, per-issue error isolation |
| Integration | High | External Jira REST API with rate limits (429 + exponential backoff), ADF parsing, PAT credential retrieval from integrations config |
| Data validation | High | JQL injection risk, external_id case-sensitivity, 500-chunk pagination, overlapping JQL dedup, max 500 issues enforced |
| UI | Low | Simple form: JQL textarea + submit button + progress polling. No complex state management. |
| **Estimated test effort** | **4-6h** | High logic + integration weight drives this; UI testing is trivial |

### Epic-level inheritance (EPIC-BK-003 — User Stories & Acceptance Criteria)
- **Risks restated at Story level**:
  - Jira API v3 breaking changes or field deprecation could silently corrupt ADF parsing
  - Jira PAT rotation/expiry leaves queued jobs failing until credentials are refreshed
  - Large JQL (10k+ issues, 20+ chunks) may exceed Edge Function timeout (Vercel: 60s hobby, 300s pro, 900s enterprise)
- **Integration points inherited**: Jira REST API, `integrations` table, Supabase/Vercel cron infrastructure
- **PO/Dev answers already given at epic level**: 
  - Import is strictly one-way (Jira → Bunkai), no backlinks written to Jira during import (FEAT-011 capability list: "Bidirectional Jira sync → Phase 3")
  - Max 500 issues per chunk — enforced client-side and server-side
  - `external_id` format: `[A-Z]+-\d+` regex (FEAT-013)
- **Test strategy inherited**: Integration test against Jira sandbox + mock server for ADF parsing + DB assertions on upsert correctness

---

## Phase 2 — Story Quality Analysis

### Ambiguities
| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|-------------------|---------------------|-------------------|------------------------|
| 1 | BR3: "Max 500 issues per Jira search request; jobs auto-chunk above." | What mechanism auto-chunks? Is it client-side pagination (`startAt` + `maxResults` loop) or a server-side JQL partition? If pagination-based, how is the total issue count discovered before chunking (Jira REST returns `total` in the search response)? | Cannot design chunk-completion tests without knowing how chunks are created and aggregated into `imported_count` | Worker: call `/search?jql=X&maxResults=0` first to read `total`, then paginate `startAt=0,500,1000...` until `startAt >= total`. Each page is one chunk. |
| 2 | BR6: "if no Module named Inbox under Project P, create one for unmatched issues." | Where is "Inbox" inserted in the Module tree? Root level? Under a specific parent? Does the worker create Inbox synchronously or does it expect Inbox to exist pre-import? What if a non-admin triggers the import — does the worker have permission to create Modules? | Cannot test Inbox creation if target position is undefined. Module tree integrity depends on parent placement. | "Inbox" created at root level of the Project if missing. Worker runs with service-role context (bypasses RLS), so permission is not a blocker. |
| 3 | BR1: "external_id = Project + uppercase Jira key → idempotency key." | Is "Project" the `projects.name`, `projects.slug`, or `projects.id`? If `projects.name` changes is the idempotency key recomputed on update? If `projects.id`, how is it combined — e.g. `"PROJECT-UUID-BK-17"` or two separate columns? | Idempotency test depends on exact key composition. Wrong key shape causes duplicate imports. | `external_id = Jira issue key (uppercased)` only. `project_id` is a separate FK column. Idempotency = `UNIQUE (project_id, external_id)`. The Story description saying "Project + uppercase Jira key" is a simplification — the `project_id` FK already scopes the uniqueness. |
| 4 | Workflow step 7: "Heuristic extracts Acceptance Criteria from description." | What is the heuristic? "Matches `h3. Acceptance Criteria` header then splits by bullet list? Or regex-based `**AC**:` pattern? What if description contains sub-headings under AC (e.g., "AC for v1", "AC for v2")? What if issue has no AC section? | AC extraction is the highest-risk component for false positives/negatives. Without knowing the heuristic, test data design is guesswork. | Algorithm: locate heading containing "Acceptance Criteria" (case-insensitive, supports ADF heading nodes + Markdown `##`/`###`), then consume all subsequent bullet-list items (`bulletList` ADF nodes or `- `/`* ` Markdown lines) until next heading or end of content. Issues without AC section produce 0 AC rows — not an error. |
| 5 | Workflow step 8: "Resolves target Module (component match or Inbox)." | What is the matching strategy? Exact string match on `modules.name` vs `component.name`? Case-sensitive? What if an issue has multiple Jira components — first-match-wins or all matched? What if multiple Bunkai Modules share the same name (possible if Modules are at different tree depths)? | Multi-match ambiguity can route issues to wrong Module. Test must cover exact-match, partial-match, case-difference, multi-component, and multi-module-same-name cases. | Match strategy: case-insensitive exact match on `modules.name` against each `component.name` in the issue. First match wins. If no match → Inbox. If multiple components match different Modules → use the first component's match (order as returned by Jira). |
| 6 | BR4: "Job result: imported_count, created_count, updated_count, skipped_count, errors[]." | What distinguishes `created` vs `updated` vs `skipped`? Is `skipped` for issues that fail AC parsing but still produce a US? Or is `skipped` for issues that produce 0 rows entirely? Is there a `failed_count`? | Without definitions, cannot assert correctness of job result counts. | `created` = new `external_id` not previously seen. `updated` = existing `external_id` whose title or description changed. `skipped` = existing `external_id` with no changes. `errors[]` = per-issue failures (Jira API timeout, ADF parse error, DB constraint violation) — these issues are NOT imported. `imported_count` = `created` + `updated` (total rows touched). |
| 7 | Workflow step 3: "pg_cron-scheduled Supabase Edge Function picks up queued jobs." | What is the cron frequency? 1 minute? 5 minutes? Is there a risk of two cron invocations picking up the same job (race condition)? | Concurrency control is critical — duplicate worker execution could produce duplicate `user_stories` rows. The `imports.status` state machine must be atomic. | Cron runs every 1 minute. Worker atomically transitions status `queued → running` via `UPDATE imports SET status='running' WHERE id=? AND status='queued' RETURNING *` — if RETURNING is empty, another worker already claimed it. |
| 8 | BR2: "external_id = Project + uppercase Jira key → idempotency key." | Case sensitivity in user_stories regex: FEAT-013 says `[A-Z]+-\d+`. Jira keys use uppercase project prefixes (e.g., "BK-17"). What if a Jira key arrives as lowercase from a misconfigured external tool? Normalize to uppercase at import? | Lowercase keys from Jira API responses would break the regex match but could still slip through as a different external_id. | Jira REST API always returns uppercase keys. Worker normalizes `external_id = issue.key.toUpperCase()` as a safety net. The UNIQUE constraint enforces dedup regardless. |

### Gaps (missing info)
| # | Type | Why critical | What to add | Risk if omitted |
|---|------|--------------|-------------|-----------------|
| 1 | AC | No specification for what happens when the Edge Function crashes mid-job (e.g., after processing 7/20 chunks). Does the worker resume from the last successful chunk? Does it set status=failed and require a full re-import? Is there a `last_processed_startAt` column for checkpoint/resume? | Worker crashes on large imports waste Jira API rate-limit budget and leave the Project in a partially-imported state with no clear recovery path. | Add AC covering crash recovery: "Given a running import job, When the worker crashes after processing N chunks, Then the job status transitions to 'failed' with errors[] indicating the crash. User re-submits the same JQL to create a new job — idempotency ensures no duplicates." Add columns `chunks_total, chunks_completed, last_start_at` to `imports` for progress tracking. | Undetected partial imports; duplicate US rows if no idempotency enforcement on re-run; wasted Jira API calls if worker restarts from chunk 0. |
| 2 | AC | No error handling for Jira credentials being absent or invalid at the time the worker runs (integrations row deleted or PAT expired between enqueue and execution). | Worker picks up a queued job, cannot authenticate to Jira, must fail gracefully with a descriptive error — not a 500 crash that leaves `imports.status=queued` forever. | Add AC: "Given an import job with invalid/missing Jira credentials, When the worker executes, Then status='failed' with error 'JIRA_AUTH_FAILED' and no issues imported." |
| 3 | Technical | No ADF→Markdown conversion specification. ADF supports nested tables, code blocks with language, emoji shortcodes (`:smile:`), inline cards, media groups, expand macros, and panel nodes. Which ADF node types are supported? What is the fallback for unsupported nodes? | Code blocks losing language info, tables breaking layout, emoji rendering as raw `:smile:` text all degrade imported US quality and force manual cleanup. | Add documentation: supported ADF nodes list (paragraph, heading, text with marks, bulletList, orderedList, codeBlock, blockquote, table, panel, rule, emoji, inlineCard, hardBreak). Unsupported nodes → stripped with a warning appended to `errors[]`. Nesting depth ≤∞ (ADF is inherently tree-based). |
| 4 | Technical | No specification for how Jira custom fields (epic link, story points, labels, fixVersions) are handled during import. Are they mapped to Bunkai entities? Discarded? Stored as metadata on `user_stories`? | Users expect Jira metadata (especially Epic parent, story points, labels) to survive import. Silent discard breaks workflow continuity. | `user_stories` table needs optional columns: `jira_epic_key, jira_labels[], jira_story_points, jira_issue_type, jira_priority`. Import maps these 1:1 where columns exist. Phase 1: store as jsonb `jira_metadata` on `user_stories`. Phase 2: promote to first-class columns. |
| 5 | Business rule | No specification for duplicate imports when two different JQLs produce overlapping issue sets. If user imports JQL "project = BUNKAI" (1000 issues) and later imports JQL "project = BUNKAI AND issuetype = Bug" (100 issues), the 100 bugs will hit the idempotency check and be `skipped` or `updated`. Is this the desired behavior or should overlapping imports be warned about? | Silent skips may confuse users who expect "import" to bring in new issues they haven't seen. | Add AC: "Given an import job whose JQL produces issues already imported under the same project, When the worker upserts by (project_id, external_id), Then existing issues with unchanged data are counted as 'skipped', issues with changed data are counted as 'updated', and the job result clearly distinguishes these counts." |

### Edge cases not in Story
| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|----------|-------------------------------|-------------|--------|
| 1 | JQL returns 0 issues ("project = BUNKAI AND issuetype = Epic" when no Epics exist) | Job completes with `imported_count=0, status=succeeded`. No error — empty result set is valid. | Medium | Test only — don't add AC |
| 2 | Import triggered while another import is `running` on the same project | Concurrent imports allowed (separate workers, separate `imports` rows). Idempotency: whichever worker inserts a given `external_id` first wins; the other sees "already exists" and counts as `skipped`. Potential for Jira rate-limit exhaustion if 2 workers hammer the same Jira instance. | High | Add to AC (NEEDS PO/DEV CONFIRMATION) — should concurrent imports on the same project be queued serially? |
| 3 | Jira issue has description > 50KB (US Markdown body limit from FEAT-009) | Truncate to 50KB with "[...truncated]" marker appended. Log warning in errors[]. | High | Add to AC (NEEDS PO/DEV CONFIRMATION) — truncate or reject? |
| 4 | ADF description contains a Mermaid diagram block (fenced code block with language `mermaid`) | Mermaid content preserved verbatim as Markdown fenced code block. Bunkai's Markdown renderer (FEAT-009) should render it if Mermaid is in the allowlist (Gap #8 in feature-map: Mermaid renderer not yet confirmed). | Medium | Test only — depends on Markdown renderer scope |
| 5 | Jira issue uses a Jira project key that happens to match a Bunkai Project Slug (e.g., Bunkai Project slug is "BUNKAI" and Jira project key is also "BUNKAI") | No conflict — `external_id` format is the Jira issue key (e.g., "BUNKAI-123"), scoped by `project_id` FK. The Bunkai Project slug is unrelated. | Low | No action needed |
| 6 | Jira API returns a `429 Too Many Requests` on chunk 15 of 20 | Worker applies exponential backoff with jitter (max 5 retries per BR5). If 5 retries exhausted → set `imports.status=failed`, append error to `errors[]`, `imported_count` reflects issues successfully imported before the rate-limit failure. | High | Add to AC — explicit 429 handling + retry exhaust behavior |
| 7 | Jira issue has no `components` field (unassigned) | Issue routed to Inbox module. Not an error. | Low | Test only |
| 8 | Jira issue has a component named "Inbox" (matching the fallback Module name) | Normal component match wins — issue lands in the "Inbox" Module (not a special case). Same behavior as any other component match. | Low | Test only |
| 9 | User enters invalid JQL syntax ("projet = BUNKAI") | Client-side JQL validation ideally catches this. If it reaches the worker, Jira REST returns 400 with `"Error in the JQL Query"`. Worker sets `imports.status=failed` with the Jira error verbatim in `errors[]`. | Medium | Test only |
| 10 | Jira description is empty/null | US created with empty Markdown body. AC extraction produces 0 AC rows. Not an error. | Low | Test only |
| 11 | Jira issue has been deleted between import job enqueue and worker execution | Jira REST returns 404 for the specific issue key (if fetched individually, unlikely in `/search` results) or the issue is simply absent from search results. Worker treats absence as "issue no longer exists" — no US row created. | Low | Test only |
| 12 | `integrations.secrets_ref` points to a Vault/secret store entry that doesn't exist | Worker cannot resolve credentials → `status=failed` with error `JIRA_CREDENTIALS_MISSING`. Zero issues imported. | High | Add to AC |

### Contradictions
No contradictions found between Story description, business-data-map.md, business-feature-map.md, and business-api-map.md. The `imports` table Discovery Gap (G1 in data-map) is a documentation gap, not a contradiction — all sources agree the table must exist.

### Testability validation
**Verdict**: Partial

Issues:
- AC heuristic extraction algorithm is underspecified — no pseudocode or decision tree documented. False positives/negatives are unknowable without the exact algorithm.
- ADF→Markdown conversion fidelity depends on undocumented ADF node-type support list.
- Crash recovery behavior is entirely absent from the story — no checkpoint mechanism specified.
- No test-data examples for Jira issues with realistic ADF bodies (tables, emoji, expand macros, nested code blocks).
- Jira sandbox/test instance availability is a prerequisite — no test can validate real ADF parsing against synthetic only data.

---

## Phase 3 — Refined Acceptance Criteria

### Original AC1 — Enqueue import job via JQL (implicit from Workflow steps 1-2)

#### Scenario 1.1: Should enqueue import job with valid JQL and valid project (Type: Positive, Priority: Critical)
- **Given**: 
  - User is a workspace `member`+ with a valid Bearer token (scope: write)
  - Project "Checkout v2" exists with `project_id = p1`
  - Jira integration is configured in the workspace (`integrations.kind=jira` with valid `config.jira_base_url` and `secrets_ref`)
- **When**: 
  ```
  POST /api/v1/imports/jira
  Authorization: Bearer bk_pat_...
  Body: { project_id: "p1", jql: "project = BUNKAI AND status != Closed" }
  ```
- **Then**:
  - UI: 202 Accepted returned to client
  - API: Response body = `{ success: true, data: { import_job_id: "<uuid>" } }`
  - DB: INSERT into `imports` row with `project_id=p1, kind='jira', status='queued', jql='project = BUNKAI AND status != Closed', created_at=<now>`
  - System state: job is queued for the pg_cron worker; `activity_log` row appended with `action='import.jira.enqueued'`

#### Scenario 1.2: Should reject import when JQL is empty or missing (Type: Negative, Priority: High)
- **Given**: Same as 1.1
- **When**: `POST /api/v1/imports/jira` with body `{ project_id: "p1", jql: "" }`
- **Then**:
  - API: 400 Bad Request, error code `VALIDATION_ERROR`, details `[{ field: "jql", message: "JQL must not be empty" }]`
  - DB: No `imports` row created

#### Scenario 1.3: Should reject import when user lacks write scope (Type: Negative, Priority: High)
- **Given**: User has a read-only PAT (scopes: ["read"])
- **When**: `POST /api/v1/imports/jira` with valid body
- **Then**:
  - API: 403 Forbidden, error code `INSUFFICIENT_SCOPE`
  - DB: No `imports` row created

#### Scenario 1.4: Should reject import when project_id does not exist (Type: Negative, Priority: High)
- **Given**: No project with `project_id = "nonexistent"`
- **When**: `POST /api/v1/imports/jira` with body `{ project_id: "nonexistent", jql: "project = BUNKAI" }`
- **Then**:
  - API: 404 Not Found, error code `PROJECT_NOT_FOUND`
  - DB: No `imports` row created

#### Scenario 1.5: Should reject import when Jira integration is not configured for the workspace (Type: Negative, Priority: High)
- **Given**: Project belongs to workspace without a `kind=jira` integration row
- **When**: `POST /api/v1/imports/jira` with valid body
- **Then**:
  - API: 412 Precondition Failed, error code `JIRA_INTEGRATION_NOT_CONFIGURED`, message "Configure Jira integration in Workspace Settings before importing"
  - DB: No `imports` row created

---

### Original AC2 — Poll import status (implicit from Workflow step 3-10)

#### Scenario 2.1: Should return import job status while running (Type: Positive, Priority: Critical)
- **Given**: Import job `import_job_id = "job-1"` exists with `status='running'`, `imported_count=150`, `chunks_total=4`, `chunks_completed=1`
- **When**: `GET /api/v1/imports/job-1`
- **Then**:
  - API: 200 OK, body = `{ success: true, data: { id: "job-1", status: "running", imported_count: 150, created_count: 100, updated_count: 50, skipped_count: 0, errors: [], chunks_total: 4, chunks_completed: 1, started_at: "<iso>", finished_at: null } }`

#### Scenario 2.2: Should return completed job with full counts and errors (Type: Positive, Priority: Critical)
- **Given**: Import job `job-2` completed with `status='succeeded'`, 3 errors on specific issues
- **When**: `GET /api/v1/imports/job-2`
- **Then**:
  - API: 200 OK, body includes `status: "succeeded"`, `imported_count: 497`, `created_count: 450`, `updated_count: 47`, `skipped_count: 3`, `errors: [{ issue_key: "BUNKAI-99", error: "ADF_PARSE_ERROR", message: "Could not parse description" }, { issue_key: "BUNKAI-150", error: "DESCRIPTION_TOO_LARGE", message: "Description 52KB exceeds 50KB limit" }, { issue_key: "BUNKAI-200", error: "INTERNAL_ERROR", message: "DB constraint violation" }]`

#### Scenario 2.3: Should return failed job when Jira credentials are invalid (Type: Negative, Priority: High)
- **Given**: Import job `job-3` was queued, but `integrations.secrets_ref` pointed to a Vault entry that was deleted
- **When**: Worker picks up job → cannot authenticate → sets `status='failed'`
- **Then**: `GET /api/v1/imports/job-3` returns `status: "failed"`, `errors: [{ error: "JIRA_AUTH_FAILED", message: "Jira credentials invalid or expired. Reconfigure integration in Workspace Settings." }]`, `imported_count: 0`

#### Scenario 2.4: Should return 404 for nonexistent import job (Type: Negative, Priority: Medium)
- **When**: `GET /api/v1/imports/nonexistent`
- **Then**: 404 Not Found, error code `IMPORT_JOB_NOT_FOUND`

---

### Original AC3 — ADF → Markdown conversion (implicit from Workflow step 6)

#### Scenario 3.1: Should convert ADF paragraph with inline marks to Markdown (Type: Positive, Priority: Critical)
- **Given**: ADF content = `{ "type": "paragraph", "content": [{ "type": "text", "text": "Hello ", "marks": [{ "type": "strong" }] }, { "type": "text", "text": "world" }] }`
- **When**: Worker parses ADF description
- **Then**: Markdown output = `**Hello** world`

#### Scenario 3.2: Should convert ADF code block with language to fenced Markdown (Type: Positive, Priority: High)
- **Given**: ADF content = `{ "type": "codeBlock", "attrs": { "language": "typescript" }, "content": [{ "type": "text", "text": "const x = 1;" }] }`
- **When**: Worker parses ADF description
- **Then**: Markdown output = 
  ```
  ```typescript
  const x = 1;
  ```
  ```

#### Scenario 3.3: Should convert ADF table with header row to Markdown table (Type: Positive, Priority: High)
- **Given**: ADF content = `{ "type": "table", "content": [{ "type": "tableRow", "content": [{ "type": "tableHeader", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Name" }] }] }, { "type": "tableHeader", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Value" }] }] }] }, { "type": "tableRow", "content": [{ "type": "tableCell", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Foo" }] }] }, { "type": "tableCell", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Bar" }] }] }] }] }`
- **When**: Worker parses ADF description
- **Then**: Markdown output = 
  ```
  | Name | Value |
  |------|-------|
  | Foo  | Bar   |
  ```

#### Scenario 3.4: Should convert ADF emoji shortcode to Unicode emoji (Type: Positive, Priority: Medium)
- **Given**: ADF content with emoji node `{ "type": "emoji", "attrs": { "shortName": ":rocket:" } }`
- **When**: Worker parses ADF description
- **Then**: Markdown output = `🚀`

#### Scenario 3.5: Should handle unsupported ADF node type gracefully (Type: Edge, Priority: Medium)
- **Given**: ADF content contains an `expand` macro (Jira-specific, not in supported list)
- **When**: Worker parses ADF description
- **Then**: Unsupported node stripped from output. Warning appended to `errors[]` for that issue: `{ issue_key: "BUNKAI-42", error: "ADF_UNSUPPORTED_NODE", message: "Unsupported ADF node type 'expand' was stripped" }`. Import continues.

---

### Original AC4 — Idempotency on external_id (implicit from BR1 and BR4)

#### Scenario 4.1: Should create new US when external_id not seen before (Type: Positive, Priority: Critical)
- **Given**: `user_stories` table has no row with `project_id=p1, external_id="BUNKAI-100"`
- **When**: Worker processes Jira issue BUNKAI-100 for project p1
- **Then**:
  - DB: INSERT into `user_stories` with `project_id=p1, external_id="BUNKAI-100", module_id=<resolved>, title=<issue summary>, description=<ADF→MD converted>, created_at=<now>`
  - Import job `created_count` increments by 1

#### Scenario 4.2: Should update existing US when title or description changed since last import (Type: Positive, Priority: Critical)
- **Given**: `user_stories` has row with `project_id=p1, external_id="BUNKAI-100", title="Old title", description="Old desc"`
- **When**: Worker processes Jira issue BUNKAI-100 with new `title="New title"` and `description="New desc"`
- **Then**:
  - DB: UPDATE `user_stories` SET `title="New title", description="New desc", updated_at=<now>` WHERE `project_id=p1 AND external_id="BUNKAI-100"`
  - Import job `updated_count` increments by 1
  - Related `acceptance_criteria` rows re-extracted and upserted (replace all)

#### Scenario 4.3: Should skip existing US when no data changed (Type: Positive, Priority: High)
- **Given**: `user_stories` has row with `project_id=p1, external_id="BUNKAI-100"` matching the current Jira issue exactly (same title, same description)
- **When**: Worker processes Jira issue BUNKAI-100
- **Then**:
  - DB: No UPDATE to `user_stories` row
  - Import job `skipped_count` increments by 1

#### Scenario 4.4: Should handle duplicate external_id within same JQL (Type: Edge, Priority: Medium)
- **Given**: JQL somehow returns the same issue BUNKAI-100 twice (edge case: Jira pagination overlap)
- **When**: Worker processes BUNKAI-100, then encounters it again in the same job
- **Then**: Second encounter → idempotency check → treated as `skipped` (no change). No duplicate row created. No error.

---

### Original AC5 — AC heuristic extraction (implicit from Workflow step 7)

#### Scenario 5.1: Should extract AC bullets from description under "Acceptance Criteria" heading (Type: Positive, Priority: Critical)
- **Given**: Jira issue BUNKAI-101 has description (converted to Markdown):
  ```
  ## Description
  As a user I want to log in.
  
  ## Acceptance Criteria
  - AC1: User can log in with valid email and password
  - AC2: Invalid credentials show error message
  - AC3: Session expires after 30 minutes of inactivity
  ```
- **When**: Worker runs AC heuristic extraction on the description
- **Then**:
  - DB: INSERT 3 rows into `acceptance_criteria` linked to `user_stories.id` for BUNKAI-101
  - AC bodies: `"User can log in with valid email and password"`, `"Invalid credentials show error message"`, `"Session expires after 30 minutes of inactivity"` (prefix "AC1: " / "- " stripped)
  - Each AC gets auto-incremented `position` (1, 2, 3)

#### Scenario 5.2: Should produce 0 ACs when no "Acceptance Criteria" heading found (Type: Positive, Priority: High)
- **Given**: Jira issue description has no heading containing "Acceptance Criteria"
- **When**: Worker runs AC heuristic extraction
- **Then**: 0 `acceptance_criteria` rows created for this issue. No error. US still imported.

#### Scenario 5.3: Should stop extracting ACs at next heading after AC section (Type: Positive, Priority: High)
- **Given**: Jira issue description:
  ```
  ## Acceptance Criteria
  - AC1: Do thing A
  
  ## Technical Notes
  - Note about implementation
  ```
- **When**: Worker runs AC heuristic extraction
- **Then**: Only "Do thing A" extracted as AC. "Note about implementation" NOT extracted (it's under "Technical Notes" heading, not part of AC section).

#### Scenario 5.4: Should handle "Acceptance Criteria" heading with different formats (Type: Positive, Priority: Medium)
- **Given**: Headings tested: `## Acceptance Criteria`, `### Acceptance Criteria`, `h2. Acceptance Criteria`, `h3. Acceptance Criteria`
- **When**: Worker runs AC heuristic extraction
- **Then**: All formats recognized. AC bullets extracted correctly from each.

---

### Original AC6 — Component → Module mapping (implicit from Workflow step 8)

#### Scenario 6.1: Should map Jira component to matching Bunkai Module by name (Type: Positive, Priority: Critical)
- **Given**: 
  - Bunkai Modules under project p1: `{ id: "m1", name: "Cart" }`, `{ id: "m2", name: "Checkout" }`
  - Jira issue BUNKAI-102 has `components: [{ name: "Cart" }]`
- **When**: Worker resolves target Module
- **Then**: Module resolved to `m1` (Cart). `user_stories.module_id = "m1"`

#### Scenario 6.2: Should be case-insensitive for component→Module matching (Type: Positive, Priority: High)
- **Given**: 
  - Bunkai Module: `{ id: "m1", name: "Cart" }`
  - Jira issue has `components: [{ name: "CART" }]` or `[{ name: "cart" }]`
- **When**: Worker resolves target Module
- **Then**: Module resolved to `m1` (case-insensitive match)

#### Scenario 6.3: Should route to Inbox when no component matches any Module (Type: Positive, Priority: High)
- **Given**: 
  - Bunkai Modules: `{ name: "Cart" }`, `{ name: "Checkout" }`
  - Jira issue BUNKAI-103 has `components: [{ name: "Authentication" }]`
  - Inbox Module does NOT yet exist under project p1
- **When**: Worker resolves target Module
- **Then**:
  - Worker creates Module "Inbox" at project root (parent_module_id = NULL) if not exists
  - `user_stories.module_id` = newly created Inbox Module id

#### Scenario 6.4: Should use first matching component when multiple components match different Modules (Type: Edge, Priority: High)
- **Given**: 
  - Bunkai Modules: `{ name: "Cart" }`, `{ name: "Checkout" }`
  - Jira issue has `components: [{ name: "Checkout" }, { name: "Cart" }]`
- **When**: Worker resolves target Module
- **Then**: Module resolved to `m2` (Checkout) — first component in Jira's order, first match wins **(NEEDS PO/DEV CONFIRMATION)**

#### Scenario 6.5: Should route to Inbox when issue has no components (Type: Positive, Priority: Medium)
- **Given**: Jira issue BUNKAI-104 has `components: []` or no `components` field
- **When**: Worker resolves target Module
- **Then**: Module resolved to Inbox (auto-created if needed)

---

### Original AC7 — Jira rate limit handling (BR5)

#### Scenario 7.1: Should apply exponential backoff on 429 response (Type: Positive, Priority: Critical)
- **Given**: Worker calls Jira REST `/search?jql=...&startAt=500&maxResults=500`
- **When**: Jira responds with `429 Too Many Requests`, header `Retry-After: 30`
- **Then**: Worker waits `Retry-After` seconds + random jitter (0-5s), then retries. Max 5 retry attempts. If 429 persists after 5 retries → job `status='failed'`.

#### Scenario 7.2: Should succeed after transient 429 on retry 2 (Type: Positive, Priority: High)
- **Given**: Worker hits 429 on first attempt for chunk 3
- **When**: Worker retries with exponential backoff (wait 30s, retry) and Jira responds 200 on second attempt
- **Then**: Chunk 3 processed successfully. Import continues to next chunk.

#### Scenario 7.3: Should fail job after exhausting 5 retries on persistent 429 (Type: Negative, Priority: Critical)
- **Given**: 
  - Worker is on chunk 12 of 20 (issues 6000-6499)
  - Chunks 1-11 processed successfully (5500 issues imported)
  - Jira returns 429 for chunk 12
  - Worker retries 5 times, all return 429
- **When**: 5 retries exhausted
- **Then**:
  - `imports.status = 'failed'`
  - `imports.imported_count = 5500` (issues from chunks 1-11)
  - `errors[]` includes `{ error: "JIRA_RATE_LIMIT_EXHAUSTED", message: "429 after 5 retries on chunk 12. 5500/10000 issues imported." }`

---

### Original AC8 — Inbox auto-creation (BR6)

#### Scenario 8.1: Should create Inbox Module when no matching component found (Type: Positive, Priority: Critical)
- **Given**: 
  - Project p1 has Modules: "Cart", "Checkout"
  - No Module named "Inbox" exists
  - Jira issue with component "Authentication" (no match)
- **When**: Worker resolves target Module
- **Then**:
  - DB: INSERT into `modules` with `project_id=p1, name="Inbox", parent_module_id=NULL, path="/Inbox", slug="inbox"`
  - Issue routed to new Inbox Module

#### Scenario 8.2: Should reuse existing Inbox when it already exists (Type: Positive, Priority: High)
- **Given**: 
  - Project p1 already has an "Inbox" Module with `id="m-inbox"`
  - Another unmatched issue arrives
- **When**: Worker resolves target Module
- **Then**: Issue routed to existing Inbox (`module_id = "m-inbox"`). No duplicate Inbox created.

#### Scenario 8.3: Should not treat "Inbox" component name as special (Type: Positive, Priority: Medium)
- **Given**: 
  - Project has Module "Inbox" AND Module "Payments"
  - Jira issue has component "Inbox"
- **When**: Worker resolves target Module
- **Then**: Issue routed to "Inbox" Module via normal component match (not special-cased). Same behavior as any other component match.

---

### New scenarios surfaced from Phase 2 edge cases — NEEDS PO/DEV CONFIRMATION

#### Scenario E1: Should handle worker crash mid-job with partial import (Type: Edge, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**: Crash recovery not specified in Story. Two options: (A) mark job `failed`, user re-submits JQL, idempotency prevents duplicates; (B) worker resumes from `last_start_at` on next cron tick.
- **Given**: Worker processes chunks 1-5 (2500 issues), crashes on chunk 6. `imports` row still shows `status='running'`.
- **When**: Next cron tick (1 min later) picks up the stuck `running` job
- **Then**: Suggested behavior (Option A): Sweeper detects `started_at > 5 minutes ago AND status='running'` → marks `failed`. User receives notification. Re-submitting same JQL creates a new job — idempotency ensures already-imported issues are `skipped`/`updated`.
- **Impact if unconfirmed**: Stuck `running` jobs with no timeout mechanism block the Project from further imports (if serialized) or leak worker resources.

#### Scenario E2: Should queue concurrent imports on same project serially (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: Should a second import on the same project be rejected (409 Conflict: "Import already in progress") or allowed (concurrent workers, idempotency handles overlaps)?
- **Given**: Import job A is `running` on project p1. User submits import job B on same project p1.
- **When**: POST /imports/jira for job B
- **Then**: Suggested: 409 Conflict, error `IMPORT_ALREADY_RUNNING`, message "An import is already in progress for this project. Wait for it to complete or check its status at GET /imports/{job-a-id}."
- **Impact if unconfirmed**: Concurrent workers hammering Jira API exhaust shared rate limits; overlapping idempotency checks create subtle race conditions.

#### Scenario E3: Should truncate oversized descriptions at 50KB limit (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: Truncate with marker, or reject the entire issue, or store in a different column?
- **Given**: Jira issue BUNKAI-200 has description that converts to 62KB of Markdown
- **When**: Worker processes the issue
- **Then**: Suggested: Truncate to 50000 bytes, append `\n\n[...truncated at 50KB limit — view full description in Jira: <jira_url>]`. Issue imported. Error logged: `{ issue_key: "BUNKAI-200", error: "DESCRIPTION_TRUNCATED", message: "Description truncated from 62KB to 50KB" }`.

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate
| Type | Count | Notes |
|------|-------|-------|
| Positive | 15 | Happy path: enqueue, poll, ADF parse (paragraph/code/table/emoji/nested-list), AC extract, component match, idempotent create/update/skip, Inbox create, 0-results, single-chunk |
| Negative | 12 | Invalid JQL, missing auth, missing project, no integration, empty JQL, 429 exhaust, worker crash, credential failure, 404 poll, invalid token, missing write scope |
| Boundary | 8 | Max 50KB US body, 500 chunk boundary, 0 issues JQL, 50000-character JQL, 1-issue import, Unicode/emoji in titles, deeply nested ADF (20 levels), Inbox already exists with content |
| Integration | 6 | Jira REST /search pagination, ADF→MD roundtrip, PAT credential resolution, 429 retry+backoff, cron worker claim (atomic status transition), Jira API timeout |
| API | 5 | POST /imports/jira (202), POST /imports/jira (400/403/404/412), GET /imports/{id} (running), GET /imports/{id} (completed), GET /imports/{id} (404) |
| **Total** | **46** | Drives PO estimation — high count reflects CRITICAL 18 score + heavy integration surface |

**Rationale**: CRITICAL 18 reflects the combination of external integration complexity (Jira REST, ADF parsing), data integrity requirements (idempotency, AC extraction accuracy), and async reliability (worker crash recovery, rate-limit handling). Every integration point and every edge case enumerated in Phase 2 produces at least one outline. The 46-outline count is appropriate for a feature that is the primary adoption funnel (Journey 1 step 5 — no import means no US/AC population, which blocks ATC authorship).

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive
- **Should enqueue import job with valid JQL and existing project** — Pre: Jira integration configured, user has write scope. Expected: 202 + import_job_id, imports row status=queued.
- **Should poll import job returning running status with partial progress** — Pre: import_job_id exists, worker is mid-execution (chunk 2 of 4). Expected: 200 + status=running + imported_count=250 + chunks_completed=1.
- **Should poll import job returning completed status with full counts** — Pre: job finished successfully. Expected: 200 + status=succeeded + created_count + updated_count + skipped_count + errors[].
- **Should convert ADF paragraph with bold and italic marks to Markdown** — Pre: ADF content with text nodes carrying strong and em marks. Expected: Markdown `**bold** _italic_`.
- **Should convert ADF ordered and unordered nested lists to Markdown** — Pre: ADF bulletList containing nested orderedList. Expected: correct indented Markdown list hierarchy.
- **Should convert ADF code block with language annotation to fenced Markdown** — Pre: ADF codeBlock with attrs.language="python". Expected: ` ```python\ncode\n``` `.
- **Should convert ADF table with header row and multiple data rows** — Pre: ADF table with tableHeader and tableCell nodes. Expected: GFM pipe table.
- **Should convert ADF emoji node to Unicode character** — Pre: ADF emoji node shortName=":tada:". Expected: 🎉 in Markdown output.
- **Should create user_story and acceptance_criteria when external_id not seen before** — Pre: empty user_stories table for project. Expected: INSERT US + AC rows, created_count=1.
- **Should update existing user_story when Jira title or description changed** — Pre: US with external_id "BUNKAI-001" exists with old title. Expected: UPDATE title/description, updated_count=1.
- **Should skip existing user_story when no changes detected** — Pre: US exists with same title+description as Jira. Expected: no UPDATE, skipped_count=1.
- **Should extract AC bullets from description under "## Acceptance Criteria" heading** — Pre: Markdown with AC heading + bullet list. Expected: 3 AC rows created with correct bodies.
- **Should map Jira component "Cart" to Bunkai Module "Cart"** — Pre: Module "Cart" exists. Expected: US.module_id = Cart module id.
- **Should auto-create "Inbox" Module when no component match found** — Pre: modules: [Cart, Checkout], component: "Auth". Expected: Inbox Module created at root, issue routed to Inbox.
- **Should complete import with 0 issues when JQL returns empty result set** — Pre: JQL "project = BUNKAI AND issuetype = Epic" on project with 0 Epics. Expected: status=succeeded, imported_count=0, no errors.

#### Negative
- **Should reject import when JQL is empty string** — Pre: project exists. Expected: 400 VALIDATION_ERROR, "JQL must not be empty".
- **Should reject import when JQL parameter is missing from body** — Pre: project exists. Expected: 400 VALIDATION_ERROR on jql field.
- **Should reject import when project_id does not exist** — Pre: no project with given id. Expected: 404 PROJECT_NOT_FOUND.
- **Should reject import when user lacks write scope** — Pre: read-only PAT. Expected: 403 INSUFFICIENT_SCOPE.
- **Should reject import when Jira integration not configured** — Pre: no kind=jira integration row. Expected: 412 JIRA_INTEGRATION_NOT_CONFIGURED.
- **Should fail import job when Jira returns 401 (invalid PAT in secrets_ref)** — Pre: integrations.secrets_ref points to expired PAT. Expected: status=failed, error JIRA_AUTH_FAILED.
- **Should fail import job when Jira base URL is unreachable (DNS/timeout)** — Pre: integrations.config.jira_base_url = "https://nonexistent.atlassian.net". Expected: status=failed, error JIRA_CONNECTION_FAILED.
- **Should fail import job after exhausting 429 retries** — Pre: Jira consistently returns 429 for chunk. Expected: status=failed, imported_count reflects partial success, errors[] shows JIRA_RATE_LIMIT_EXHAUSTED.
- **Should return 404 when polling nonexistent import job** — Pre: no job with given id. Expected: 404 IMPORT_JOB_NOT_FOUND.
- **Should reject import when user is not member of workspace** — Pre: user is viewer role. Expected: 403 FORBIDDEN.
- **Should reject import when no Bearer token provided** — Pre: unauthenticated request. Expected: 401 UNAUTHORIZED.
- **Should log error per-issue without aborting entire job** — Pre: mock Jira response where issue BUNKAI-50 has corrupt ADF. Expected: BUNKAI-50 in errors[], all other issues imported successfully.

#### Boundary
- **Should truncate user_story description at 50KB with marker** — Pre: Jira issue description converts to 62KB MD. Expected: US body = 50KB + "[...truncated]" marker. Error logged.
- **Should handle import of exactly 500 issues (chunk boundary)** — Pre: JQL returns exactly 500 issues. Expected: 1 chunk processed, imported_count=500, status=succeeded.
- **Should handle import of 501 issues (auto-chunk to 2 pages)** — Pre: JQL returns 501 issues. Expected: chunk 1 (0-499), chunk 2 (500), imported_count=501.
- **Should handle import of exactly 1 issue** — Pre: JQL returns 1 issue. Expected: imported_count=1, status=succeeded.
- **Should handle Jira issue with Unicode/emoji in title** — Pre: issue summary = "Test テスト 🚀". Expected: title stored correctly as UTF-8 in user_stories.title.
- **Should handle deeply nested ADF (20 levels of nested lists)** — Pre: ADF with bulletList → bulletList → ... 20 deep. Expected: correct Markdown nested list without stack overflow or data loss.
- **Should handle Inbox auto-creation when Inbox already exists with content** — Pre: Inbox Module exists with 5 existing US. Expected: new unmatched issue routed to existing Inbox. Existing US unaffected.
- **Should handle JQL string at maximum reasonable length (50000 characters)** — Pre: JQL with complex nested AND/OR clauses. Expected: JQL accepted and passed to Jira API without truncation.

#### Integration
- **Should correctly paginate Jira search results across multiple chunks** — Pre: JQL returns 1500 issues. Expected: 3 API calls (startAt=0,500,1000), all issues imported, imported_count=1500.
- **Should atomically claim import job (queued → running) to prevent duplicate worker execution** — Pre: two cron ticks fire simultaneously, both see same queued job. Expected: only one worker successfully transitions status, the other sees empty RETURNING and skips.
- **Should resolve Jira PAT from integrations.secrets_ref at execution time** — Pre: integrations row with valid secrets_ref. Expected: worker authenticates to Jira with the resolved PAT.
- **Should apply exponential backoff with jitter on 429 response** — Pre: Jira returns 429 with Retry-After=10. Expected: worker waits 10s + random(0,5)s, retries, succeeds on retry 2.
- **Should handle Jira REST API timeout (30s) gracefully** — Pre: Jira `/search` endpoint hangs for 30s. Expected: worker times out, retries, logs timeout error if persistent. Does not crash.
- **Should round-trip ADF → Markdown accurately for all supported node types** — Pre: known ADF fixtures for each node type. Expected: MD output matches expected golden files.

#### API
- **POST /imports/jira should return 202 with import_job_id on success** — Pre: valid project_id + jql. Expected: 202, response.data.import_job_id is UUID.
- **POST /imports/jira should return 400 on empty jql** — Pre: jql="". Expected: 400, error.code=VALIDATION_ERROR.
- **POST /imports/jira should return 403 when user lacks write scope** — Pre: read-only PAT. Expected: 403, error.code=INSUFFICIENT_SCOPE.
- **GET /imports/{id} should return 200 with progress while running** — Pre: job exists, status=running. Expected: 200, body includes imported_count, chunks_completed, chunks_total.
- **GET /imports/{id} should return 404 for nonexistent id** — Pre: no job. Expected: 404, error.code=IMPORT_JOB_NOT_FOUND.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|-----------|-------------------|-------------|--------|
| 1 | Worker crashes mid-job (after processing N chunks) | No | Critical | Add to AC — see Scenario E1 (NEEDS PO/DEV CONFIRMATION) |
| 2 | Concurrent imports on same project (race on Jira rate limits + idempotency) | No | High | Add to AC — see Scenario E2 (NEEDS PO/DEV CONFIRMATION) |
| 3 | Description exceeds 50KB body limit | No | High | Add to AC — see Scenario E3 (NEEDS PO/DEV CONFIRMATION) |
| 4 | JQL returns 0 issues | No | Medium | Test only — outline "Should complete import with 0 issues" |
| 5 | Jira PAT expired between enqueue and execution | No | High | Add to AC — Scenario 2.3 covers this |
| 6 | ADF contains Mermaid diagram in code block | No | Medium | Test only — depends on Markdown renderer Mermaid support (Gap #8 in feature-map) |
| 7 | Jira issue has no components field | No | Low | Test only — Scenario 6.5 covers this |
| 8 | Jira component name matches "Inbox" literally | No | Low | Test only — Scenario 8.3 covers this |
| 9 | JQL syntax error (invalid JQL string) | No | Medium | Test only — worker surfaces Jira error in errors[] |
| 10 | Jira issue deleted between enqueue and execution | No | Low | Test only |
| 11 | Empty/null description in Jira issue | No | Low | Test only |
| 12 | Multiple Bunkai Modules share the same name at different tree depths | No | High | Add to AC — how does component→Module matching handle duplicates? (NEEDS PO/DEV CONFIRMATION) |
| 13 | Jira custom fields (epic link, story points, labels) are silently discarded | No | High | Gap #4 in Phase 2 — add metadata capture requirement |
| 14 | `integrations.secrets_ref` points to nonexistent Vault entry | No | High | Add to AC — Scenario 2.3 covers credentials, extension needed for Vault miss |
| 15 | ADF contains unsupported node type (expand macro, layout) | No | Medium | Test only — Scenario 3.5 covers this |

---

## Story Quality Assessment

**Verdict**: Needs Improvement

**Key findings**:
- Worker crash recovery is the most critical gap — no checkpoint/resume mechanism specified. A CRITICAL 18 feature involving external API calls over 20+ chunks MUST define failure recovery semantics.
- AC heuristic extraction algorithm is described only as "heuristic" — no pseudocode, no false-positive boundaries, no heading format variants tested. This is the highest-risk component for data quality.
- Component→Module matching ambiguity (multiple same-named Modules at different tree depths) is unspecified. Pick-first-match is reasonable but must be documented and testable.
- ADF node type support list is undocumented — implementers and testers have no contract for what constitutes a valid conversion. Unsupported nodes must be explicitly listed with fallback behavior.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **What is the crash recovery strategy for the async worker?**
   - **Context**: The Story describes a multi-step worker (fetch→chunk→parse→upsert) that can process 20+ chunks of 500 issues each. On Vercel, Edge Functions have hard timeouts (60s hobby, 300s pro, 900s enterprise). A large import (10k issues) WILL exceed the timeout.
   - **Impact if unanswered**: The worker will routinely crash on large imports with no recovery path. Users will see stuck `running` jobs, partial imports, and must guess whether to re-submit. Idempotency protects against duplicates but does not prevent wasted Jira API calls re-processing already-imported chunks.
   - **Suggested answer**: Option A (simpler): mark crashed jobs as `failed` via a 5-minute sweeper. User re-submits the same JQL — idempotency makes re-imports cheap (already-imported issues are skipped). Option B (better UX): add `last_start_at` checkpoint column. Worker commits `last_start_at` after each successful chunk. On restart, worker resumes from `last_start_at + 500` instead of chunk 0.

2. **Should concurrent imports on the same project be allowed?**
   - **Context**: Two users (or one user double-clicking) could enqueue two imports on the same project simultaneously. Both workers would hit Jira with overlapping API calls, potentially exhausting shared rate limits.
   - **Impact if unanswered**: Subtle race conditions on idempotency (two workers trying to INSERT the same `external_id` simultaneously). One will succeed, one will hit a UNIQUE constraint error — which would be logged as an error even though it's not a real failure.
   - **Suggested answer**: Reject concurrent imports: `POST /imports/jira` returns 409 Conflict if another import is `queued` or `running` on the same project. Simple, safe, clear user feedback.

3. **What is the AC extraction heuristic algorithm?**
   - **Context**: The algorithm determines which text in a Jira issue description becomes an Acceptance Criterion in Bunkai. The Story says "heuristic" but no pseudocode is available. Key decisions: which heading patterns match, bullet vs numbered list handling, suffix stripping ("AC1: " vs "- "), sub-heading handling, empty AC filtering.
   - **Impact if unanswered**: QA cannot design test data without knowing the algorithm. Development will implement their best guess, which may diverge from QA's expectations. The resulting AC quality directly affects downstream ATC authorship (FEAT-015: ATC must link to ≥1 AC).
   - **Suggested answer**: Document the algorithm in the Story description. Key rules: (1) Find first heading whose text contains "acceptance criteria" (case-insensitive, after ADF→MD conversion). (2) Consume all bullet list items (`- ` or `* `) until next heading of any level or end of content. (3) Strip leading `AC\d+: ` or `AC\d+\. ` or `\d+\. ` prefix. (4) Trim whitespace. (5) Skip empty lines. (6) If no heading found, produce 0 ACs — not an error.

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **How is the `imports` table schema defined?** — Discovery Gap G1 in `business-data-map.md` notes the `imports` table is not in the canonical ERD. The Story suggests columns: `id, project_id, kind, status, jql, imported_count, created_count, updated_count, skipped_count, errors_jsonb, started_at, finished_at`. Add `chunks_total, chunks_completed, last_start_at` for progress tracking and crash recovery. Confirm schema before implementation so both backend and frontend polling align.

2. **How are Jira PAT credentials stored and retrieved?** — The Story says "Fetches credentials from Workspace integration config." Does `integrations.secrets_ref` point to Supabase Vault, a hashicorp-vault-style external store, or an encrypted column? The retrieval mechanism determines whether the worker runs with service-role (to decrypt) or user-context (delegated). This affects the worker's RLS posture.

3. **What is the Edge Function timeout configuration?** — Vercel hobby plan = 60s, pro = 300s, enterprise = 900s. A 10k-issue import with network latency could take 2-3 minutes even without rate limiting. If the MVP targets hobby/pro plans, the worker MUST support checkpoint/resume or the feature is broken for large imports.

4. **Which ADF node types must be supported in MVP?** — The ADF spec includes: paragraph, heading (1-6), text with marks (strong, em, code, strike, link, underline), bulletList, orderedList, codeBlock (with language), blockquote, table, panel, rule, emoji, inlineCard, hardBreak, mention. Which subset is MVP-required? Unsupported nodes → stripped with warning, or rejected entirely?

5. **How does the worker handle Jira API version drift?** — Jira Cloud REST API v3 is the current version. If Atlassian deprecates a field or changes the ADF schema, the worker's parser must not crash. Is there a version-pinning strategy (Accept header?) or graceful degradation for unknown fields?

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | "pg_cron-scheduled Supabase Edge Function picks up queued jobs" | Specify cron frequency (1 min) and atomic claim mechanism (`UPDATE ... WHERE status='queued' RETURNING *`) | Prevents duplicate worker execution; testable behavior |
| 2 | "Heuristic extracts Acceptance Criteria from description" | Document the exact algorithm as pseudocode in the Story description | Removes highest-risk ambiguity; enables accurate test data design |
| 3 | "Job result: imported_count, created_count, updated_count, skipped_count, errors[]" | Add definitions for each count field (see Ambiguity #6) | Eliminates QA guesswork on count assertions |
| 4 | No mention of Jira custom field mapping | Add `jira_metadata` jsonb column to `user_stories` for storing epic link, story points, labels, issue type, priority | Preserves Jira metadata that users expect to survive import |
| 5 | No crash recovery specification | Add AC covering worker failure: job marked `failed` after sweeper timeout, user re-submits same JQL, idempotency prevents duplicates | Defines behavior for the most common failure mode on large imports |
| 6 | "Resolves target Module (component match or Inbox)" | Specify case-insensitive exact match, first-match-wins, behavior for multi-component issues, behavior for duplicate Module names | Removes mapping ambiguity |

---

## Data feasibility flags

- **Entity / fixture missing**: `imports` table not yet materialized (Discovery Gap G1). Must be created before any implementation or testing.
- **API contract gap**: `integrations` and `environments` management APIs absent from `api-contracts.yaml` v1.0 (Gap #2 in business-api-map.md). Jira credentials must be configurable before import can be tested — even if via Settings UI only.
- **External dependency**: Jira sandbox/test instance required for realistic ADF parsing tests. Synthetic ADF fixtures can cover ~80% of cases but real Jira ADF (with expand macros, layout sections, nested panels) will uncover edge cases synthetic fixtures miss.
- **Secrets infrastructure**: Vault or secure credential store for Jira PAT must be provisioned before worker can authenticate to Jira.

---

## Recommended testing strategy

### Pre-implementation
- Review ADF node-type support list with Dev — agree on MVP scope vs Phase 2
- Prepare golden-file test fixtures: 20 Jira issues exported as ADF JSON, covering every supported node type + common combinations
- Set up Jira Cloud sandbox project with realistic issues (various components, AC sections, description sizes)
- Create Bunkai test Project with Module tree matching the Jira sandbox components

### During implementation
- Unit test ADF→MD converter with golden-file fixtures
- Unit test AC extraction heuristic against known Markdown bodies
- Integration test: mock Jira REST server returning paginated fixture data, verify worker chunking + upsert logic
- Contract test: POST /imports/jira validates all error responses (400, 403, 404, 412, 409)
- Load test: import 10k issues, verify Edge Function timeout handling and chunk completion

### Post-implementation (in-sprint by /sprint-testing)
- Trifuerza (UI/API/DB): trigger import from Project Settings UI, verify POST 202, poll GET /imports/{id}, verify US + AC rows in DB
- Smoke: small import (5 issues), verify all counts correct, verify Module routing
- Exploratory: malformed JQL, special characters in descriptions, emoji rendering in imported US
- Regression: re-import same JQL → all issues skipped, counts verified

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|-----------------------------|
| 1 | Worker crash on large imports (>5000 issues) without checkpoint/resume | High | High | Outlines: worker crash edge case; PO question #1; 429 retry exhaust outline; chunk boundary outlines |
| 2 | AC heuristic extraction produces false positives (non-AC bullets classified as AC) | Medium | High | Outlines: AC extraction positive/negative; AC heading format variants; empty AC description |
| 3 | ADF→MD conversion silent data loss on unsupported node types | Medium | High | Outlines: ADF node-type round-trip; unsupported node handling; deeply nested ADF |
| 4 | Jira PAT expiry between enqueue and execution → stuck `queued` jobs | Medium | High | Outlines: invalid credentials; JIRA_AUTH_FAILED error; poll failed job |
| 5 | Concurrent imports exhaust Jira rate limits | Low | High | PO question #2 (serial import recommended); 429 retry outlines |
| 6 | Inbox auto-creation collision (two unmatched issues processed simultaneously) | Low | Medium | Outlines: Inbox create + reuse; idempotency on Module creation |
| 7 | Jira REST API v3 field deprecation breaks ADF parser | Low | High | Integration outlines: Jira pagination; ADF round-trip; Jira timeout handling |

---

## Next steps

- [ ] PO answers Critical Questions #1-3 before sprint planning
- [ ] Dev answers Technical Questions #1-5 before estimation
- [ ] Story enters sprint at status `Ready For Dev` once estimated and AC finalized
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected) and expand Phase 4 outlines with parametrization tables + per-outline test-data JSON + numbered test steps + Faker recipes
- [ ] `/project-bootstrap` materializes `imports` table (resolve Discovery Gap G1) and `integrations`/`environments` APIs (resolve Gap G3/G2)
