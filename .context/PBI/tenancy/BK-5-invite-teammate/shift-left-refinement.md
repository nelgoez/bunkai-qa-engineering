# Shift-Left Refinement: BK-5 — Invite a teammate to a Workspace with role assignment

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-05-27
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context
- **Primary persona affected**: Mateo (Workspace Owner / Admin) — owns onboarding and RBAC configuration
- **Secondary personas (if any)**: Elena (member — receives invite, first interaction with Bunkai); Karim (agent — unaffected, agents use PATs not invites)
- **Business value proposition**: Multi-tenant RBAC onboarding without requiring pre-existing accounts. The invite link is the adoption funnel entry point for every non-creator team member. If invites break, only the workspace creator can use the product.
- **KPI(s) influenced**: Time-to-first-ATC for new team members; workspace member growth rate; onboarding completion rate (invite sent → accepted)
- **User journey position**: Flow 1 (Setup), step 1. Elena signs in via OAuth callback if she's the creator, OR she "accepts invite link" to join an existing workspace. This Story implements the latter path — the primary alternative to workspace creation for entering the system.

### Technical context
- **Frontend**: Settings → Members screen (`/{workspace_slug}/settings/members`) — invite button opens modal with email input + Select (role dropdown filtered ≤ caller's role). Accept-invite page at `/accept-invite?token=...` with redirect to `/login` if unauthenticated.
- **Backend**:
  - `POST /api/v1/workspaces/{workspace_id}/invites` — invite creation (FR-003, documented in `business-api-map.md` §4.2). Auth: Bearer + role (admin+).
  - `POST /api/v1/invites/{token}/accept` — invite acceptance (from Story description; **NOT in `api-contracts.yaml` v1.0** — see Gap #1 in `business-api-map.md` §10).
  - Services: workspace invite service (HMAC signing + token generation), email dispatch service
  - DB tables: `workspace_invites`, `workspace_members`
- **External services**: Email dispatch (Supabase transactional email in Cloud; mechanism unspecified for Community). Supabase Auth for session resolution during accept flow.
- **Integration points specific to this Story**:
  - Auth ↔ Invite: accept flow requires resolving "is this auth'd user's email == token's email?"
  - Email dispatch: transactional email with accept-link must be reliable or fail gracefully
  - Frontend ↔ Backend: role dropdown filtering depends on caller's role hierarchy

### Story complexity
| Axis | Rating | Why |
|------|--------|-----|
| Business logic | **High** | RBAC hierarchy enforcement (caller ≥ invited), HMAC token signing with workspace_id+email+role+expiry, single-use + idempotency semantics, email uniqueness across active members. This is the most auth-sensitive Story in wave-1. |
| Integration | **Medium** | Email dispatch via transactional email provider (Supabase-managed). No external API integration, but email delivery is inherently unreliable and needs fallback. Auth session integration during accept flow adds redirect complexity. |
| Data validation | **High** | Email format + uniqueness (across active members + pending invites? TBD), role hierarchy validation (caller ≥ invited), token signature + expiry + email-match on acceptance, duplicate-invite handling. Multiple validation layers (Zod input → service business rules → DB constraints). |
| UI | **Medium** | Invite modal (email input + filtered role dropdown), accept-invite page with auth redirect, expired/used/revoked invite states, list of pending invites (if endpoint exists). |

**Estimated test effort**: 3–4 person-hours (manual exploratory) + 8–10 outlines (Shift-Left Phase 4). High because of RBAC role matrix and token lifecycle edge cases.

### Epic-level inheritance (if applicable)
- **Epic**: EPIC-BK-001 (Tenancy & Identity)
- **Risks restated at Story level**: RLS misconfiguration on `workspace_members` could leak membership across workspaces — invite acceptance must be RLS-guarded at the workspace level.
- **Integration points inherited**: Supabase Auth (JWT session) shared across all Tenancy Stories.
- **PO/Dev answers already given at epic level**: Role inheritance hierarchy `viewer ⊂ member ⊂ admin ⊂ owner` is canonical. Workspace invite tokens are 24h-expiry, HMAC-signed. Supabase Auth manages the OAuth/magic-link identity; Bunkai only adds workspace membership.
- **Test strategy inherited**: All Tenancy Stories must validate RBAC at every tier (viewer, member, admin, owner). Auth failure responses must include stable error codes. Token security testing (tampering, replay, expiry) is mandatory.

---

## Phase 2 — Story Quality Analysis

### Ambiguities
| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|-------------------|---------------------|-------------------|------------------------|
| 1 | "email MUST be unique among active workspace members" | Does uniqueness also apply to pending invites? If admin-A invites `bob@test.com` (pending) and admin-B also invites `bob@test.com`, is the second one rejected? Or allowed (two pending invites for same email)? | Cannot design dedup test cases | Specify: "email MUST be unique among active members AND pending invites" OR "duplicate pending invites are allowed; only one can be accepted" |
| 2 | "HMAC-signed" | Which algorithm? HMAC-SHA256? What's the key source — a workspace-level secret, an env-var `INVITE_SECRET`, or derived from workspace slug? | Cannot validate token structure or design tampering tests | Specify: "HMAC-SHA256 with workspace-level secret rotated on demand" or "HMAC-SHA256 with global `INVITE_SECRET` env var" |
| 3 | "Dispatches email with link" | Which email provider? Supabase transactional email? What happens on SMTP failure — is the invite still created (201) or rolled back? Does the caller see a warning? | Cannot design email failure test cases | Specify: "Invite row created regardless; email dispatch is best-effort with retry. 201 returned. UI shows 'Invite sent' with optional 'email failed — resend' affordance." |
| 4 | "Acceptance is idempotent: re-clicking accepted invite returns 200 with current membership" | Does "current membership" mean the membership row existing OR the invite row status? If the member was later removed and re-clicks the old link — 200 or 404/410? | Cannot test idempotency boundary conditions | Specify: "Idempotent means: if token is already accepted (invite.status=accepted), return 200 with the workspace_members row that was created. If member was later removed, the token is still 'accepted' — return 200. If member was re-added by another invite, return the active membership." |
| 5 | "If not signed in → /login → redirect back to /accept-invite?token=..." | After login, how does the system know which email the token expects? Is the token decoded client-side or stored in session during redirect? If the logged-in user's email ≠ token email, what happens? | Cannot design the wrong-user acceptance flow | Specify: "After login redirect, server decodes token server-side. If auth'd email ≠ token email, return 403 'This invite is for {email}. You are signed in as {other_email}.' Offer sign-out and re-try." |
| 6 | "single-use" | Is single-use enforced at token validation (reject if invite.status=accepted) or at DB constraint (unique accepted invite per workspace+email)? Transaction ordering with workspace_members insert? | Cannot verify atomicity of accept + mark-used | Specify atomicity: "Accept is a single transaction: (1) validate token, (2) INSERT workspace_members, (3) UPDATE workspace_invites.status=accepted. If step 2 fails (e.g., RLS violation), step 3 rolls back and token remains usable." |

### Gaps (missing info)
| # | Type | Why critical | What to add | Risk if omitted |
|---|------|--------------|-------------|-----------------|
| 1 | Endpoint | `POST /api/v1/invites/{token}/accept` is described in the Story but **absent from `api-contracts.yaml` v1.0** (confirmed in `business-api-map.md` Gap #1). Without this endpoint in the spec, frontend and agent consumers have no contract. | Add `POST /invites/{token}/accept` to `api-contracts.yaml`. Request body: `{}` (empty, token in path). Response: `200 { workspace_id, role, member_id }` or `201 { ... }`. Error: `401`, `403`, `404`, `410`. | Agent (Karim) using `/openapi.json` cannot discover the acceptance flow. Frontend dev has no contract. Blocked for implementation. |
| 2 | Endpoint | No `GET /workspaces/{id}/invites` to list pending invites. Admin cannot see who they invited or check invite status. | Add list endpoint: `GET /workspaces/{workspace_id}/invites?status=pending`. Auth: admin+. | Admin can't audit pending invites. UX gap — Settings → Members shows members but not pending invites. |
| 3 | Endpoint | No `DELETE /workspaces/{id}/invites/{invite_id}` (revoke). Admin cannot cancel a mistakenly-sent invite. | Add revoke endpoint. Auth: admin+. Sets `workspace_invites.status=revoked`. Subsequent acceptance returns 410 `INVITE_REVOKED`. | Mistaken invites cannot be corrected. If email is wrong, admin must wait 24h for expiry. Documented as Gap #2 in `business-feature-map.md`. |
| 4 | Endpoint | No resend endpoint. If email is lost/spammed, admin must create a new invite (duplicate email rejection? see Ambiguity #1). | Add `POST /workspaces/{id}/invites/{invite_id}/resend` that regenerates token and re-dispatches email. Auth: admin+. | Poor UX for legitimate email delivery failures. |
| 5 | AC | No Negative AC for email dispatch failure. | Add AC: "When email dispatch fails (SMTP down, rate-limited), invite row is still created with 201. UI shows success with optional 'Resend email' button." | Testers cannot validate graceful degradation of email delivery. |
| 6 | AC | No Negative AC for accepting an invite to a deleted/archived workspace. | Add AC: "POST /invites/{token}/accept returns 404 WORKSPACE_NOT_FOUND if workspace was deleted after invite creation." | Undefined behavior on deleted workspace edge case. |
| 7 | AC | No Negative AC for token replay attack. | Add AC: "Submitting the same token twice returns 200 on second call (idempotent) but does NOT create a second membership row." | Duplicate memberships from replayed tokens. |
| 8 | AC | No Boundary AC for email format validation. | Add AC covering: empty email, email without @, email with spaces, email > 254 chars, Unicode email (IDN), email with +alias. | Malformed emails may pass validation and fail at dispatch. |
| 9 | Technical detail | HMAC key rotation mechanism not specified. | Document whether workspace-level secret rotation invalidates all existing pending invites or only new ones. | If key rotation kills pending invites, admins must re-invite everyone after key rotation. |
| 10 | Technical detail | `workspace_invites` table schema not in canonical ERD (`business-data-map.md` §2 shows relationship but no column list). | Specify columns: `id, workspace_id, email, role, token_hash, invited_by_user_id, status, expires_at, created_at, accepted_at, accepted_by_user_id`. | `/project-bootstrap` cannot scaffold the table without confirmed schema. |

### Edge cases not in Story
| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|----------|-------------------------------|-------------|--------|
| 1 | Two admins invite same email concurrently | Both invites created (if uniqueness only applies to active members). First acceptance marks both? Or only the accepted one? | **High** | Add to AC (NEEDS PO/DEV CONFIRMATION) — "If two pending invites exist for same email, accepting one does NOT auto-accept the other. Second invite remains pending and can expire independently." |
| 2 | Invite accepted during token expiry window (race: token expires between validation and accept) | Token validation and membership insert must be in same transaction with a row-level lock on the invite row. If token is within 1s of expiry at validation start, accept anyway (grace period)? | **High** | Add to AC (NEEDS PO/DEV CONFIRMATION) — "Accept is atomic: token validated, member inserted, invite marked accepted in one transaction. If token expired mid-transaction, roll back and return 410." |
| 3 | Token tampering — attacker modifies HMAC payload to elevate role (viewer → admin) | HMAC verification must fail → 403 `INVITE_TOKEN_INVALID`. Server decodes token, recomputes HMAC, compares — mismatch = reject. | **Critical** | Add to AC — "Any modification to a signed token (role, email, workspace_id, expiry) results in HMAC verification failure → 403." |
| 4 | Invitee accepts but already has an active membership in the workspace | 409 `ALREADY_MEMBER` or 200 idempotent? If already a member, the invite is essentially fulfilled — return 200 with existing membership row, mark invite as accepted. | **High** | Add to AC (NEEDS PO/DEV CONFIRMATION) — "If invitee is already an active member, return 200 with existing membership. Mark invite as accepted to clean up pending queue." |
| 5 | Inviter who sent invite is demoted/removed before invitee accepts | Invite token should still be valid — the inviter's current role doesn't affect the token's embedded role. Token carries role at time of creation. | **Medium** | Add to AC (NEEDS PO/DEV CONFIRMATION) — "Invite remains valid regardless of inviter's current status. Token encodes role at invitation time." |
| 6 | Invite to non-existent workspace_id (UUID validation) | 404 `WORKSPACE_NOT_FOUND` | **Medium** | Test only — standard 404 pattern. |
| 7 | Invite acceptance by a user whose email does not match the token's email | 403 `INVITE_EMAIL_MISMATCH` — the authenticated user's email must match the token's email. | **Critical** | Add to AC — "Server validates that authenticated user's email == token's email. Mismatch → 403." |
| 8 | Expired token (24h+ since creation) | 410 `INVITE_EXPIRED`. Token validation checks `expires_at < now()`. UI shows "This invite has expired." | **High** | Add to AC — "Tokens expire after 24h. Acceptance after expiry returns 410. UI shows expired state." |
| 9 | Revoked token | 410 `INVITE_REVOKED`. Admin revoke sets `workspace_invites.status=revoked`. Token validation rejects. | **High** | Add to AC (if revoke endpoint is added — see Gap #3). |
| 10 | Viewer-role invite acceptance | Should succeed — viewer is a valid role. User can sign in and access workspace in read-only mode. | **Medium** | Add to AC — "Viewer role invites are valid. User sees read-only workspace after acceptance." |
| 11 | Invitee tries to accept with expired auth session (logged in 1h ago, JWT expired) | Redirect to `/login` → after re-auth, redirect back to `/accept-invite?token=...`. Token still valid (within 24h). | **Low** | Test only — standard auth redirect flow. |
| 12 | Unicode/non-Latin characters in invited email (IDN) | Email must be normalized (lowercase, Unicode normalization NFC). "José@test.com" and "josé@test.com" are the same email. | **Medium** | Add to AC (NEEDS PO/DEV CONFIRMATION) — "Emails are normalized (lowercase + Unicode NFC) before uniqueness check and storage." |

### Contradictions
- **AC "single-use" vs idempotency**: "single-use" implies reject on second call; "idempotent: re-clicking accepted invite returns 200" implies allow second call with same result. These are consistent IF "single-use" means "creates at most one membership row" and "idempotent" means "repeated POST returns 200 not 409". Clarified in Ambiguity #4 above.
- **Email uniqueness**: Story says "among active workspace members" but doesn't address pending invites. If two admins invite the same email, both succeed, but only one can be accepted (the other becomes stale). This may be intentional but is undocumented. See Ambiguity #1.

### Testability validation
**Verdict**: Partial

Issues:
- No `POST /invites/{token}/accept` in `api-contracts.yaml` — cannot validate response shape against contract
- No `GET /workspaces/{id}/invites` to verify invite creation from API side (must rely on DB inspection)
- Email dispatch is externally dependent — mocking required for deterministic tests
- HMAC secret source undocumented — cannot verify token structure without knowing key derivation
- No invite revoke endpoint — cannot test token revocation lifecycle
- `workspace_invites` table schema not in canonical ERD — cannot verify DB state

---

## Phase 3 — Refined Acceptance Criteria

### Original AC1 — Invite creation by admin/owner

#### Scenario 1.1: Should create invite when admin invites a member with valid email and role (Type: Positive, Priority: Critical)
- **Given**: Mateo is authenticated as workspace **owner**. Workspace "bunkai-team" exists with id `ws-01`. No active member or pending invite exists for `elena@example.com`.
- **When**: `POST /api/v1/workspaces/ws-01/invites` with body `{ "email": "elena@example.com", "role": "member" }`
- **Then**:
  - UI: Success toast "Invitation sent to elena@example.com". Modal closes. Settings → Members shows pending invite badge.
  - API: `201 { "success": true, "data": { "invite_id": "<uuid>", "email": "elena@example.com", "role": "member", "status": "pending", "expires_at": "<ISO 24h from now>" } }`
  - DB: `workspace_invites` row with `workspace_id=ws-01, email=elena@example.com, role=member, status=pending, invited_by_user_id=<mateo_uid>, token_hash=<sha256(token)>`
  - System state: Email dispatched to `elena@example.com` with link `/accept-invite?token=<signed_token>`

#### Scenario 1.2: Should create invite with subordinate role when admin invites viewer (Type: Positive, Priority: High)
- **Given**: Mateo is workspace **admin** (not owner). Caller role = admin.
- **When**: `POST /api/v1/workspaces/ws-01/invites` with `{ "email": "sara@example.com", "role": "viewer" }`
- **Then**: `201`. Invite created with role=viewer. Email dispatched. (admin ≥ viewer: passes hierarchy check.)

#### Scenario 1.3: Should reject invite when caller role is lower than invited role (Type: Negative, Priority: Critical)
- **Given**: Mateo is workspace **admin**. Caller role = admin.
- **When**: `POST /api/v1/workspaces/ws-01/invites` with `{ "email": "new-owner@example.com", "role": "owner" }`
- **Then**:
  - UI: Error message "You cannot assign a role higher than your own."
  - API: `403 { "success": false, "error": { "code": "ROLE_HIERARCHY_VIOLATION", "message": "Caller role 'admin' cannot assign role 'owner'" } }`
  - DB: No `workspace_invites` row created.

#### Scenario 1.4: Should reject invite when member (not admin) attempts to invite (Type: Negative, Priority: Critical)
- **Given**: Elena is workspace **member**. Caller role = member.
- **When**: `POST /api/v1/workspaces/ws-01/invites` with `{ "email": "carlos@example.com", "role": "member" }`
- **Then**:
  - API: `403 { "success": false, "error": { "code": "FORBIDDEN", "message": "Admin or owner role required to invite teammates" } }`
  - DB: No row created.

#### Scenario 1.5: Should reject invite when viewer (read-only) attempts to invite (Type: Negative, Priority: High)
- **Given**: Sara is workspace **viewer**.
- **When**: `POST /api/v1/workspaces/ws-01/invites` with `{ "email": "carlos@example.com", "role": "viewer" }`
- **Then**: `403`. Same as 1.4. No row created.

#### Scenario 1.6: Should reject invite when email already belongs to active member (Type: Negative, Priority: Critical)
- **Given**: Elena is already an active `workspace_member` of ws-01 with email `elena@example.com`.
- **When**: Admin sends `POST /workspaces/ws-01/invites` with `{ "email": "elena@example.com", "role": "member" }`
- **Then**:
  - API: `409 { "success": false, "error": { "code": "EMAIL_ALREADY_MEMBER", "message": "A member with email elena@example.com already exists in this workspace" } }`
  - DB: No new row created.

#### Scenario 1.7: Should reject invite when email is in invalid format (Type: Negative, Priority: High)
- **Given**: Admin is authenticated.
- **When**: `POST /workspaces/ws-01/invites` with `{ "email": "not-an-email", "role": "member" }`
- **Then**:
  - API: `400 { "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid email format", "details": [{"field": "email", "message": "Must be a valid email address"}] } }`
  - DB: No row created.

#### Scenario 1.8: Should reject invite when email is empty (Type: Boundary, Priority: High)
- **Given**: Admin is authenticated.
- **When**: `POST /workspaces/ws-01/invites` with `{ "email": "", "role": "member" }`
- **Then**: `400` VALIDATION_ERROR. "email is required".

#### Scenario 1.9: Should reject invite when role is invalid (Type: Negative, Priority: High)
- **Given**: Admin is authenticated.
- **When**: `POST /workspaces/ws-01/invites` with `{ "email": "test@example.com", "role": "superadmin" }`
- **Then**: `400` VALIDATION_ERROR. "role must be one of: owner, admin, member, viewer".

#### Scenario 1.10: Should reject invite to non-existent workspace (Type: Negative, Priority: Medium)
- **Given**: Admin is authenticated. Workspace `ws-999` does not exist.
- **When**: `POST /api/v1/workspaces/ws-999/invites` with `{ "email": "test@example.com", "role": "member" }`
- **Then**: `404 { "success": false, "error": { "code": "WORKSPACE_NOT_FOUND" } }`

---

### Original AC2 — HMAC-signed single-use token with expiry

#### Scenario 2.1: Should generate HMAC-signed token containing workspace_id, email, role, and expiry (Type: Positive, Priority: Critical)
- **Given**: Invite created for `elena@example.com` with role=member on workspace ws-01.
- **When**: Server generates the invite token.
- **Then**: Token is a signed payload (JWT-style or custom HMAC) containing `{ workspace_id: "ws-01", email: "elena@example.com", role: "member", exp: <unix timestamp 24h from now> }`. HMAC signature verifies against the workspace secret. Token is embedded in `/accept-invite?token=<encoded_token>` link in dispatch email.

#### Scenario 2.2: Should reject acceptance when token is tampered (modified role) (Type: Negative, Priority: Critical)
- **Given**: Valid token signed with role=viewer.
- **When**: Attacker modifies the payload to role=admin, recomputes Base64, and `POST /api/v1/invites/{tampered_token}/accept`
- **Then**: `403 { "success": false, "error": { "code": "INVITE_TOKEN_INVALID", "message": "Invite token signature is invalid" } }`
- **DB**: No membership created. Invite remains pending.

#### Scenario 2.3: Should reject acceptance when token is expired (>24h) (Type: Negative, Priority: Critical)
- **Given**: Invite created 25 hours ago. Token's embedded `exp` is in the past.
- **When**: `POST /api/v1/invites/{expired_token}/accept`
- **Then**: `410 { "success": false, "error": { "code": "INVITE_EXPIRED", "message": "This invitation has expired. Please request a new one." } }`
- **DB**: No membership created. Invite status may be updated to `expired` (or stays pending — TBD).

#### Scenario 2.4: Should enforce single-use — token cannot create two memberships (Type: Negative, Priority: Critical)
- **Given**: Invite was already accepted (invite.status=accepted, membership exists).
- **When**: Same token is submitted again via `POST /api/v1/invites/{token}/accept`
- **Then**: `200 { "success": true, "data": { "workspace_id": "ws-01", "member_id": "<existing_member_id>", "role": "member", "already_accepted": true } }` — idempotent return of existing membership. No second membership row created.

---

### Original AC3 — Invite acceptance flow

#### Scenario 3.1: Should accept invite and create membership when unauthenticated user signs in with matching email (Type: Positive, Priority: Critical)
- **Given**: Elena receives invite link `/accept-invite?token=<valid_token>`. She is NOT signed in. Token encodes `email=elena@example.com, role=member, workspace_id=ws-01`.
- **When**: Elena clicks the link → redirected to `/login?redirect=/accept-invite?token=...` → signs in with GitHub (email `elena@example.com`) → redirected back to `/accept-invite?token=...` → frontend calls `POST /api/v1/invites/{token}/accept`
- **Then**:
  - UI: Redirected to `/{workspace_slug}/home`. Welcome toast "You've joined bunkai-team as member."
  - API: `200 or 201 { "success": true, "data": { "workspace_id": "ws-01", "workspace_slug": "bunkai-team", "member_id": "<uuid>", "role": "member" } }`
  - DB: `workspace_members` row created with `user_id=<elena_uid>, workspace_id=ws-01, role=member, status=active`. `workspace_invites` row updated: `status=accepted, accepted_at=<now>, accepted_by_user_id=<elena_uid>`.

#### Scenario 3.2: Should accept invite when user is already signed in with matching email (Type: Positive, Priority: High)
- **Given**: Elena is already signed in. She clicks the invite link.
- **When**: `POST /api/v1/invites/{token}/accept` (no redirect needed)
- **Then**: `200`. Membership created. Redirect to `/{workspace_slug}/home`. Same DB changes as 3.1.

#### Scenario 3.3: Should reject acceptance when authenticated email does not match token email (Type: Negative, Priority: Critical)
- **Given**: Token encodes `email=elena@example.com`. Carlos is signed in with `carlos@example.com`.
- **When**: Carlos clicks the invite link → `POST /api/v1/invites/{token}/accept`
- **Then**:
  - UI: Error "This invitation was sent to elena@example.com. You are signed in as carlos@example.com. Please sign out and use the correct account."
  - API: `403 { "success": false, "error": { "code": "INVITE_EMAIL_MISMATCH", "message": "Token email 'elena@example.com' does not match authenticated email 'carlos@example.com'" } }`
  - DB: No membership created. Invite remains pending.

#### Scenario 3.4: Should return 404 when token references non-existent invite (Type: Negative, Priority: Medium)
- **Given**: A random or malformed token that doesn't decode to any valid invite.
- **When**: `POST /api/v1/invites/{invalid_token}/accept`
- **Then**: `404 { "success": false, "error": { "code": "INVITE_NOT_FOUND", "message": "No invitation found for this token" } }`

---

### New scenarios surfaced from Phase 2 edge cases — NEEDS PO/DEV CONFIRMATION

#### Scenario E1: Should allow two admins to invite the same email — both pending, first accepted wins (Type: Edge, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**: behavior inferred — confirm dedup strategy before sprint planning
- **Given**: Admin-A invites `shared@example.com` as member (invite-1, pending). Admin-B also invites `shared@example.com` as admin (invite-2, pending). Uniqueness check is only against active members (not pending invites), so both succeed.
- **When**: `shared@example.com` user accepts invite-1 (member).
- **Then**: Membership created with role=member. Invite-1 marked accepted. Invite-2 remains pending (stale). If user later clicks invite-2 link: 200 idempotent return (existing membership) OR 409 if the token's role doesn't match existing? **Needs PO decision**.

#### Scenario E2: Should handle acceptance race with expiring token atomically (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: transaction atomicity must be confirmed by Dev
- **Given**: Token expires at T+0. Elena clicks at T-1 second.
- **When**: `POST /api/v1/invites/{token}/accept` is in-flight. Token validated at T-0.5s (valid). Transaction starts but DB commit takes 1.5s (now T+1s, past expiry).
- **Then**: Transaction must either (a) succeed because token was valid at validation time, or (b) fail with 410 because `expires_at` is checked with `NOW()` at commit time. **Needs Dev decision** on which timestamp to use.

#### Scenario E3: Should handle invite acceptance when inviter has been demoted since sending invite (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: should inviter's current role affect invite validity?
- **Given**: Admin-A invites `elena@example.com` as member. Before Elena accepts, Admin-A is demoted to member by Owner.
- **When**: Elena accepts the invite.
- **Then**: Invite should still be valid (token encodes role at invitation time). Membership created. **Alternative**: reject because inviter no longer has admin role. **Recommendation**: Allow — token is self-contained, inviter's current role irrelevant.

#### Scenario E4: Should normalize email (lowercase, Unicode NFC) before uniqueness check (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: email normalization strategy
- **Given**: Active member exists with `Elena@Example.com` (mixed case).
- **When**: Admin sends invite to `elena@example.com` (lowercase).
- **Then**: Uniqueness check normalizes both to lowercase → 409 EMAIL_ALREADY_MEMBER. Same for Unicode NFC normalization (José = Jose\u0301 vs José = \u00E9).

#### Scenario E5: Should return 410 when invite was revoked by admin (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: depends on revoke endpoint existing (Gap #3)
- **Given**: Admin creates and then revokes an invite (via DELETE endpoint).
- **When**: Invitee clicks the link and `POST /api/v1/invites/{token}/accept`
- **Then**: `410 { "success": false, "error": { "code": "INVITE_REVOKED", "message": "This invitation has been revoked" } }`

#### Scenario E6: Should handle acceptance when user already has an active membership in workspace (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: idempotent vs conflict response
- **Given**: Elena is already an active member of ws-01 (invited and accepted previously). A second invite to `elena@example.com` somehow exists (stale or re-invited).
- **When**: Elena clicks the second invite link.
- **Then**: `200` with existing membership (idempotent) OR `409 ALREADY_MEMBER`. **Recommendation**: 200 idempotent — same behavior as token replay (Scenario 2.4).

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate
| Type | Count | Notes |
|------|-------|-------|
| Positive | 5 | Happy path: invite create + accept (new user, signed-in user, role hierarchy pass), idempotent re-click |
| Negative | 11 | Role hierarchy violations (3 tiers), email mismatch, email uniqueness, token tampering, token expiry, missing workspace, invalid email format, caller below admin, missing role, wrong-user acceptance |
| Boundary | 4 | Empty email, email at max length (254 chars), Unicode email normalization, expired token at exact boundary |
| Integration | 3 | Auth redirect flow (unauthenticated → login → accept), email dispatch failure, HMAC signing with workspace secret |
| API | 4 | Response envelope validation, error code stability, rate limiting on invite creation, rate limiting on accept |
| **Total** | **27** | High count driven by CRITICAL 27 score — RBAC + HMAC token security mandates exhaustive coverage of all role tiers, token tampering, and expiry edge cases |

**Rationale**: 27-outline count reflects the CRITICAL score of 27 on this Story. Auth/RBAC Stories demand full role-matrix testing (viewer, member, admin, owner × invite create + accept). HMAC token security adds tamper/replay/expiry vectors. Email dispatch integration adds failure-mode coverage. This is the highest-security Story in wave-1 — skimping on outlines risks production auth bypass.

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive
- **Should create invite when owner invites member with valid email** — Pre: owner auth'd, ws exists, email not in use. Expected: 201 + invite row + email dispatched.
- **Should create invite when owner invites admin role** — Pre: owner auth'd, role=admin (owner ≥ admin). Expected: 201 + invite with role=admin.
- **Should create invite when admin invites viewer role** — Pre: admin auth'd, role=viewer (admin ≥ viewer). Expected: 201.
- **Should accept invite and create membership when unauthenticated user signs in with matching email** — Pre: valid pending invite token, user not signed in. Expected: login redirect → 200/201 + membership row + invite marked accepted + redirect to /home.
- **Should accept invite when user is already signed in with matching email** — Pre: valid token, matching email session. Expected: 200/201 + membership without redirect.

#### Negative
- **Should reject invite creation when member (non-admin) attempts to invite** — Pre: member auth'd. Expected: 403 FORBIDDEN.
- **Should reject invite creation when viewer attempts to invite** — Pre: viewer auth'd. Expected: 403 FORBIDDEN.
- **Should reject invite creation when admin invites owner role** — Pre: admin auth'd, role=owner (admin < owner). Expected: 403 ROLE_HIERARCHY_VIOLATION.
- **Should reject invite creation when member (non-admin) invites any role** — Pre: member auth'd, role=viewer. Expected: 403 (any role fails when caller < admin).
- **Should reject invite creation when email already belongs to active member** — Pre: active member with same email exists. Expected: 409 EMAIL_ALREADY_MEMBER.
- **Should reject invite creation when email format is invalid** — Pre: email="not-an-email". Expected: 400 VALIDATION_ERROR.
- **Should reject invite creation to non-existent workspace** — Pre: workspace_id does not exist. Expected: 404 WORKSPACE_NOT_FOUND.
- **Should reject invite acceptance when authenticated email does not match token email** — Pre: token email=elena@test.com, auth'd as carlos@test.com. Expected: 403 INVITE_EMAIL_MISMATCH.
- **Should reject invite acceptance when token is tampered (role changed from viewer to admin)** — Pre: modified token payload. Expected: 403 INVITE_TOKEN_INVALID (HMAC mismatch).
- **Should reject invite acceptance when token is expired (>24h)** — Pre: token exp in past. Expected: 410 INVITE_EXPIRED.
- **Should reject invite acceptance with garbage/invalid token** — Pre: random base64 string. Expected: 404 INVITE_NOT_FOUND.

#### Boundary
- **Should reject invite creation when email is empty string** — Pre: email="". Expected: 400 VALIDATION_ERROR "email is required".
- **Should reject invite creation when email exceeds maximum length (254 chars)** — Pre: email with 255 chars. Expected: 400 VALIDATION_ERROR or 400 "email too long".
- **Should normalize email to lowercase before uniqueness check** — Pre: member "Elena@Example.com" exists. Invite "elena@example.com". Expected: 409 EMAIL_ALREADY_MEMBER.
- **Should reject acceptance when token is at exact expiry boundary (24h + 1s)** — Pre: token created 24h+1s ago. Expected: 410 INVITE_EXPIRED.

#### Integration
- **Should handle email dispatch failure gracefully — invite still created** — Pre: SMTP/email provider down. Expected: 201 (invite row exists), UI shows success with "resend" option. No email sent.
- **Should redirect unauthenticated user through login and back to accept-invite** — Pre: user not signed in, clicks `/accept-invite?token=...`. Expected: redirect to `/login?redirect=...` → after OAuth → redirect back → auto-trigger accept.
- **Should verify HMAC signature against correct workspace-level secret** — Pre: invite created with workspace-A secret. Token replayed against workspace-B endpoint. Expected: 403 or 404 (cross-workspace token rejection).

#### API
- **Should return standard error envelope on validation failure** — Pre: any invalid input. Expected: `{ success: false, error: { code: "VALIDATION_ERROR", message: "...", details: [...] } }`.
- **Should return stable error code on role hierarchy violation** — Pre: admin invites owner. Expected: `error.code = "ROLE_HIERARCHY_VIOLATION"` (not a prose message or different code).
- **Should enforce rate limit on invite creation endpoint** — Pre: 100+ POST invites in 1 min. Expected: 429 + Retry-After header.
- **Should enforce rate limit on invite acceptance endpoint** — Pre: 100+ POST accepts in 1 min. Expected: 429 + Retry-After header.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|-----------|-------------------|-------------|--------|
| 1 | Two admins invite same email concurrently — both pending, first accepted wins | No | **Critical** | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 2 | Invite accepted during token expiry window (race condition) | No | **High** | Add to AC — transaction atomicity confirmation |
| 3 | Token tampering — attacker modifies HMAC payload to elevate role | No | **Critical** | Add to AC — HMAC verification must fail |
| 4 | Invitee already has active membership in workspace | No | **High** | Add to AC — 200 idempotent or 409 conflict |
| 5 | Inviter demoted/removed before invitee accepts | No | **Medium** | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 6 | Invite to non-existent workspace redirect (UUID in path) | No | **Medium** | Test only (covered by N-7) |
| 7 | Invite acceptance by wrong user (email mismatch) | No | **Critical** | Add to AC (covered by N-8) |
| 8 | Invite with viewer role — lowest permission tier | No | **Medium** | Add to AC — viewer accepts successfully |
| 9 | Unicode/non-Latin email normalization (IDN, NFC) | No | **Medium** | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 10 | Email with +alias (john+test@example.com) — uniqueness enforcement | No | **Medium** | Discuss with PO — strict equality or alias-aware? |
| 11 | Revoked token — admin cancels invite before acceptance | No | **High** | Add to AC (NEEDS PO/DEV CONFIRMATION) — depends on revoke endpoint |
| 12 | Email dispatch failure (SMTP down, rate-limited) — invite still created | No | **High** | Add to AC — 201 with resend affordance |
| 13 | Workspace deleted after invite created but before acceptance | No | **Medium** | Add to AC — 404 WORKSPACE_NOT_FOUND |

---

## Story Quality Assessment

**Verdict**: **Needs Improvement** — the Story describes the core flow well but has significant gaps for a CRITICAL 27 Auth/RBAC ticket.

**Key findings**:
- `POST /api/v1/invites/{token}/accept` is the primary acceptance endpoint but **does not exist in `api-contracts.yaml` v1.0**. Without this contract, frontend and Karim agent cannot implement. This is a release-blocking gap.
- No list/revoke/resend invite endpoints exist. Admin cannot audit pending invites or cancel mistakes. This is a UX gap that will surface immediately in partner feedback.
- HMAC signing strategy (algorithm, key source, rotation) is unspecified. Token security depends on this detail — guessing wrong could create an auth bypass.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **Does email uniqueness include pending invites, or only active members?**
   - **Context**: Story says "active workspace members" but doesn't address concurrent invites. Two admins could invite the same email.
   - **Impact if unanswered**: Cannot design the dedup flow. Could result in duplicate invites, confusing UX ("which invite link do I click?").
   - **Suggested answer**: "Uniqueness applies to active members only. Duplicate pending invites are allowed. First accepted invite wins; the other becomes stale."

2. **What is the idempotency behavior when an already-accepted invite is re-clicked by a user who was later removed from the workspace?**
   - **Context**: "Idempotent: re-clicking accepted invite returns 200 with current membership." What if membership no longer exists (member was removed)?
   - **Impact if unanswered**: Cannot test the re-join flow. Undefined behavior could result in 200 returning stale data or 404.
   - **Suggested answer**: "If member was removed, return 200 with the invite's accepted status (invite row reflects it was used). Do NOT re-create membership — admin must send a fresh invite."

3. **Should the inviter's current role affect the validity of a pending invite?**
   - **Context**: Admin invites someone, then gets demoted to member before acceptance.
   - **Impact if unanswered**: Cannot define token validation rules. A strict reading would reject the invite (inviter no longer has authority), but this breaks UX.
   - **Suggested answer**: "No. The token is self-contained — role and authority are embedded at creation time. Inviter's current status is irrelevant."

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **Which HMAC algorithm and key source?** — HMAC-SHA256 with a workspace-level `invite_secret` column? A global `INVITE_SIGNING_KEY` env var? This decides whether token rotation on key change is workspace-scoped or global.

2. **Is invite acceptance a single DB transaction covering token validation + membership insert + invite status update?** — Race conditions (token expiring mid-accept, concurrent accepts on same token) depend on transaction atomicity.

3. **Email dispatch: Supabase transactional email or a custom provider?** — Determines whether dispatch is synchronous in the request or async/queued. Affects 201 vs 202 response pattern.

4. **Is `POST /api/v1/invites/{token}/accept` going into `api-contracts.yaml` before `/project-bootstrap`?** — Currently absent. Without it, frontend and Karim agent have no contract.

5. **What is the `workspace_invites` table schema?** — Not in the canonical ERD. Columns needed: `id, workspace_id, email, role, token_hash, invited_by_user_id, status, expires_at, created_at, accepted_at, accepted_by_user_id`.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | No `POST /invites/{token}/accept` in `api-contracts.yaml` | Add endpoint with full request/response shapes to api-contracts.yaml | Unblocks frontend + agent implementation |
| 2 | No list/revoke/resend invite endpoints | Add `GET /workspaces/{id}/invites`, `DELETE /workspaces/{id}/invites/{invite_id}`, `POST /workspaces/{id}/invites/{invite_id}/resend` to MVP scope | Closes Gap #1-2 from business-api-map and business-feature-map |
| 3 | HMAC signing details unspecified | Add to Story: "HMAC-SHA256 with workspace-level `invite_secret` column. Token payload: `{workspace_id, email, role, exp}`. Encoded as URL-safe Base64." | Dev can implement without guessing |
| 4 | Email dispatch failure undefined | Add to AC: "Invite created with 201 regardless of email dispatch success. UI shows 'Invite sent' with resend option if dispatch fails." | Defines graceful degradation path |
| 5 | No AC for token tampering | Add Negative AC: "Modified token (role elevated, email changed) fails HMAC verification → 403" | Critical for security testing |
| 6 | No AC for email mismatch on accept | Add Negative AC: "Auth'd email ≠ token email → 403 INVITE_EMAIL_MISMATCH" | Critical for preventing wrong-user joins |
| 7 | Email normalization unspecified | Add business rule: "Emails are normalized to lowercase + Unicode NFC before storage and comparison" | Prevents duplicate emails with different casing |

---

## Data feasibility flags

- **`workspace_invites` table not in canonical ERD** — schema must be defined during `/project-bootstrap`. Column list proposed in Gap #10 above.
- **API contract gap**: `POST /api/v1/invites/{token}/accept` missing from `api-contracts.yaml`. Must be added before implementation.
- **No live DB** — all data is generated: create workspace via `POST /workspaces`, create members via invite/accept flow, or seed directly for testing.
- **Email dispatch needs mocking** — use MSW or Nock to intercept SMTP/Supabase email calls for deterministic tests. No live email testing in CI.
- **HMAC token generation** — test helper needed to generate signed tokens programmatically for accept-flow tests and tampering tests.

---

## Recommended testing strategy

### Pre-implementation
- Review and extend `api-contracts.yaml` with `POST /invites/{token}/accept`, `GET /workspaces/{id}/invites`, `DELETE /workspaces/{id}/invites/{invite_id}`
- Confirm HMAC algorithm + key source with Dev
- Define `workspace_invites` table schema + migration

### During implementation
- Unit tests: HMAC signing/verification, role hierarchy validation, email uniqueness check, token expiry check
- Integration tests: invite creation → token verification → membership creation transaction
- Contract tests: validate response shapes against OpenAPI spec
- Security tests: token tampering, replay, cross-workspace token rejection

### Post-implementation (in-sprint by /sprint-testing)
- Manual exploratory: full invite → accept flow (unauthenticated + authenticated paths)
- RBAC matrix: every role tier attempting to invite every role (4×4 matrix)
- Token lifecycle: create → wait 24h → expire; create → accept → re-click (idempotent); create → revoke → try accept
- Cross-workspace isolation: token from workspace-A cannot grant access to workspace-B
- Email dispatch failure simulation (mock SMTP down)

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|-----------------------------|
| 1 | HMAC secret exposure allows token forgery → unauthorized workspace access | Low | **Critical** | N-9, N-10 (tampering + cross-workspace rejection), I-3 |
| 2 | Race condition on token acceptance creates duplicate memberships | Medium | **High** | E2 (transaction atomicity), N-9 (replay) |
| 3 | Email dispatch is unreliable → invites silently lost | Medium | **Medium** | I-1 (dispatch failure), P-1 (invite still created) |
| 4 | Role hierarchy check can be bypassed via direct API call with elevated role in token | Low | **Critical** | N-3 (admin invites owner), N-9 (token tampering) |
| 5 | Email uniqueness bypass via case-sensitivity (Elena@test.com ≠ elena@test.com) | Medium | **Medium** | B-3 (normalization), N-5 (uniqueness check) |
| 6 | Expired token accepted due to timezone/clock skew | Low | **High** | B-4 (boundary expiry), N-10 (expired rejection) |
| 7 | No revoke endpoint → mistaken invites cannot be corrected | High | **Medium** | E5 (revoke — needs endpoint), documented as Gap #3 |
| 8 | `POST /invites/{token}/accept` not in api-contracts → frontend/agent blocked | **Certain** | **Critical** | Gap #1 — must resolve before sprint start |

---

## Next steps

- [ ] PO answers Critical Questions #1-3 before sprint planning
- [ ] Dev answers Technical Questions #1-5 before estimation
- [ ] **BLOCKER**: Add `POST /api/v1/invites/{token}/accept` to `api-contracts.yaml` — release-blocking gap
- [ ] **BLOCKER**: Add `GET /workspaces/{id}/invites` and `DELETE /workspaces/{id}/invites/{invite_id}` to scope — minimum viable invite management
- [ ] Define `workspace_invites` table schema for `/project-bootstrap`
- [ ] Story enters sprint at status `Ready For Dev` once estimated and blockers cleared
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected)
