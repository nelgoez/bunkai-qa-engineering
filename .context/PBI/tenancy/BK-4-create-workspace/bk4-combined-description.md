Source spec: FR-002 — Workspace creation

## User story
As an authenticated user, I want to create a Workspace so that my team's data is isolated from other tenants.
Implements **FR-002**.

## Business rules
* `name` MUST be 3–60 chars and contain at least 1 alphanumeric character.
* `slug` is derived from `name`: lowercase, kebab-case (spaces → hyphens, accents stripped), leading and trailing hyphens stripped, max 60 chars.
* `slug` MUST be globally unique across all workspaces.
* `slug` MUST NOT match any reserved value (loaded from config).
* Creator inherits role `owner`; no other roles are assignable at create-time.

## Workflow
1. Authenticated user clicks "Create Workspace".
2. UI shows name input + slug preview computed client-side.
3. User submits.
4. `POST /api/v1/workspaces` with `{ name }`.
5. Server validates name length + alphanumeric requirement.
6. Server derives slug, checks reserved list + global uniqueness.
7. Insert `workspaces` row in transaction with `workspace_members` row (`role=owner`).
8. Emit `workspace.created` event.
9. Return 201 with `{ workspace_id, slug }`.
10. UI navigates to the new workspace's home.

## Definition of done
* Implementation complete
* Unit tests written
* Code reviewed
* Documentation updated

## Labels
`mvp`, `tenancy`, `wave-1`

---

## QA Refinements (Shift-Left Analysis)

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-05-27
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

### Story Quality Assessment

**Verdict**: Needs Improvement

**Key findings**:
- **Missing error catalog** — the Story defines 4 business rules but zero error responses. Every Negative scenario is blocked until error codes, status codes, and messages are specified.
- **Undefined reserved slug list** — the `SLUG_RESERVED` guard is critical for URL namespace integrity but the reserved list is mentioned nowhere in context docs. PO must provide this list.
- **Sluggification algorithm is underspecified** — "accents stripped," "alphanumeric character," and truncation behavior are ambiguous without Unicode normalization details. This creates a high risk of client/server slug divergence.
- **Response body contradiction** — the Story says `{ workspace_id, slug }` but the API map says `{ id, slug, role, plan }`. The richer response is needed for Journey 1.

### Critical Questions for PO
*These BLOCK sprint planning until answered.*

1. **What is the complete list of reserved workspace slugs?** — Impact: The SLUG_RESERVED validation cannot be implemented or tested. Suggested: `admin`, `api`, `app`, `auth`, `bunkai`, `dashboard`, `settings`, `www`, `mail`, `status`, `docs`, `help`, `blog`, `test`, `dev`, `staging`, `prod`, `login`, `signup`, `logout`, `workspace`, `workspaces`, `project`, `projects`, `new`, `create`, `edit`, `delete`, `search`, `403`, `404`, `500`.
2. **What is the Unicode normalization strategy for sluggification?** — Impact: Non-Latin workspace names are untestable. Suggested: NFKD normalization → strip combining marks → keep only `[a-z0-9-]`.
3. **Should the client and server share the same sluggification function?** — Impact: Slug preview UX is broken without shared `slugify()`. Suggested: Extract shared function into `@/utils/slug`.
4. **Should name leading/trailing whitespace be trimmed server-side or client-side?** — Suggested: Both.

### Technical Questions for Dev
*These do not block PO but block implementation.*

1. **Is `Idempotency-Key` supported on `POST /workspaces`?**
2. **What happens when slug normalization produces an empty string?**
3. **Are consecutive hyphens in the slug collapsed or preserved?**
4. **How is the `workspace.created` event consumed?**
5. **What is the exact 201 response body shape?**

### Refined Acceptance Criteria (Summary)

The shift-left analysis produced **29 test outlines** covering:
- **6 Positive**: Valid name, slug derivation, owner assignment, full UI→API→redirect flow, second workspace creation, live slug preview
- **9 Negative**: Invalid name (too short, too long, no alphanumeric), unauthenticated, reserved slug, duplicate slug, empty slug, missing body, missing name field
- **6 Boundary**: Name at 3/60/61/2 chars, slug max length, truncation
- **3 Integration**: Transaction atomicity, activity_log write, event emission
- **5 API**: Success response shape, validation errors (×3), list includes new workspace

**Blocked scenarios** (pending PO/Dev answers):
- Reserved slug rejection (needs full reserved list)
- Unicode normalization tests (needs normalization spec)
- Idempotency/retry (needs Idempotency-Key support confirmation)
- Event consumer verification (needs consumer specification)
- Whitespace trimming behavior (needs server-side confirmation)

### Suggested Story Improvements
1. Add error catalog: per validation rule → HTTP status + error code + message
2. Document reserved slug list explicitly
3. Specify NFKD normalization for Unicode
4. Change 201 response to `{ id, slug, name, role, plan }`
5. Add workspace home empty-state behavior
6. Add "OpenAPI spec updated" to Definition of Done

Full refinement document with all 29 test outlines, edge cases, and risk analysis available in the comment on this ticket.
