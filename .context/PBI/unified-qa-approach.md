# Unified QA Approach — BK-4 (Create Workspace) + BK-5 (Invite Teammate)

**Environment**: https://upexbunkai.vercel.app
**Staging API**: https://upexbunkai.vercel.app/api/v1
**OpenAPI docs**: https://upexbunkai.vercel.app/api/docs
**Date**: 2026-05-27
**Source documents**:
- `.context/PBI/tenancy/BK-4-create-workspace/shift-left-refinement.md` (Nahuel's comprehensive analysis)
- `.context/PBI/tenancy/BK-5-invite-teammate/shift-left-refinement.md` (Nahuel's comprehensive analysis)
- Ely's implementation notes (BK-4 commit beae616, BK-5 commit 3c851d5)

---

## 1. Unified Gherkin Scenarios

### BK-4 — Create a Workspace

#### AC-1: Create workspace with valid name (Positive — Critical)
**Best source**: All contributors (Nahuel, Luis Eduardo, Ciprian, Diego, Ramiro, Ely)

```gherkin
Given a user is authenticated with a valid JWT session
And no workspace with slug "acme-qa" exists globally
When the user sends POST /api/v1/workspaces with body { "name": "Acme QA" }
Then the server responds 201 Created
And the response body contains { "success": true, "data": { "id": "<uuid>", "slug": "acme-qa", "name": "Acme QA", "role": "owner", "plan": "community" } }
And a workspaces row exists with slug "acme-qa" and name "Acme QA"
And a workspace_members row exists with user_id = <caller>, role = "owner", workspace_id = <new_id>
And an activity_log row exists with action = "workspace.created", entity_type = "workspace", entity_id = <new_id>
And the creator is now owner of the workspace
```

#### AC-2: Name with leading/trailing spaces trimmed (Positive — Medium)
**Best source**: Luis Eduardo

```gherkin
Given a user is authenticated
When the user sends POST /api/v1/workspaces with body { "name": "  Acme   QA  " }
Then the server responds 201 Created
And the stored name is "Acme QA" (whitespace trimmed)
And the derived slug is "acme-qa"
```

#### AC-3: Accented characters stripped from slug (Positive — High)
**Best source**: Luis Eduardo, Nahuel

```gherkin
Given a user is authenticated
When the user sends POST /api/v1/workspaces with body { "name": "Área QA" }
Then the server responds 201 Created
And the derived slug is "area-qa"
And accented characters are normalized (NFKD) and stripped of combining marks
```

#### AC-4: Extra/unknown fields ignored (Positive — Medium)
**Best source**: Ely

```gherkin
Given a user is authenticated
When the user sends POST /api/v1/workspaces with body { "name": "My Team", "extraField": "should-be-ignored", "malicious": true }
Then the server responds 201 Created
And extra fields are silently ignored by Zod strict parsing or strip
And the workspace is created with only the "name" field used
```

#### AC-5: Slug preview matches server-derived slug (Positive — Medium)
**Best source**: Ciprian, Ramiro

```gherkin
Given a user is on the workspace creation UI
When the user types "My QA Team" into the name input
Then the client-side slug preview shows "my-qa-team"
And after submission, the server-derived slug equals "my-qa-team" (client/server share same sluggification logic)
```

#### AC-6: Duplicate slug rejected (Negative — Critical)
**Best source**: Diego, Ramiro

```gherkin
Given a workspace exists with slug "my-team"
When a user sends POST /api/v1/workspaces with body { "name": "My Team" }
Then the server responds 409 Conflict
And the error body contains { "success": false, "error": { "code": "SLUG_NOT_UNIQUE", "message": "A workspace with this slug already exists" } }
And no new workspace or membership rows are created
```

#### AC-7: Cross-tenant slug collision rejected (Negative — Critical)
**Best source**: Ely

```gherkin
Given workspace "my-team" exists in tenant A
When a user in tenant B sends POST /api/v1/workspaces with body { "name": "My Team" }
Then the server responds 409 Conflict
And slug uniqueness is enforced globally (across all tenants)
```

#### AC-8: Reserved slug rejected (Negative — Critical)
**Best source**: Nahuel, Ely, Ramiro

```gherkin
Given the server has a reserved slug list including "api", "admin", "settings"
When a user sends POST /api/v1/workspaces with body { "name": "Admin" }
Then the server responds 400 Bad Request
And the error body contains { "success": false, "error": { "code": "SLUG_RESERVED", "message": "This workspace slug is reserved and cannot be used" } }
```

#### AC-9: Name validation boundaries (Negative/Boundary — High)
**Best source**: Luis Eduardo, Ciprian, Ramiro

```gherkin
Scenario: Name too short
Given a user is authenticated
When the user sends POST /api/v1/workspaces with body { "name": "AB" }
Then the server responds 400 Bad Request
And the error body contains { "success": false, "error": { "code": "NAME_TOO_SHORT" } }

Scenario: Name too long
Given a user is authenticated
When the user sends POST /api/v1/workspaces with body { "name": "<61 chars>" }
Then the server responds 400 Bad Request
And the error body contains { "success": false, "error": { "code": "NAME_TOO_LONG" } }

Scenario: No alphanumeric characters
Given a user is authenticated
When the user sends POST /api/v1/workspaces with body { "name": "!!! @@@ ###" }
Then the server responds 400 Bad Request
And the error body contains { "success": false, "error": { "code": "NAME_NO_ALPHANUMERIC" } }

Scenario: Exact minimum boundary (3 chars)
Given a user is authenticated
When the user sends POST /api/v1/workspaces with body { "name": "ABC" }
Then the server responds 201 Created
And the slug is "abc"

Scenario: Exact maximum boundary (60 chars)
Given a user is authenticated
When the user sends POST /api/v1/workspaces with body { "name": "<60 alphanumeric chars>" }
Then the server responds 201 Created
And the slug length is ≤ 60 characters
```

#### AC-10: Auth enforcement (Negative — High)
**Best source**: Nahuel, Ramiro, Ciprian

```gherkin
Given no valid auth token is provided
When a user sends POST /api/v1/workspaces with body { "name": "Test" }
Then the server responds 401 Unauthorized
And the error body contains { "success": false, "error": { "code": "UNAUTHORIZED" } }
And no DB changes occur
```

#### AC-11: Transaction atomicity (Integration — Critical)
**Best source**: Ramiro, Ciprian

```gherkin
Given a simulated failure on workspace_members insert (e.g., FK constraint violation)
When a user sends POST /api/v1/workspaces with body { "name": "Atomic Test" }
Then the entire transaction rolls back
And no workspaces row exists
And no workspace_members row exists
And the server responds with 500 or appropriate error (NOT 201)
```

#### AC-12: Data isolation between workspaces (Integration — Critical)
**Best source**: Diego, Nahuel

```gherkin
Given user Alice is owner of workspace-A
And user Alice is NOT a member of workspace-B
When Alice attempts to access workspace-B resources (GET /api/v1/workspaces/{workspace-B-id})
Then the server responds 403 Forbidden
And RLS prevents cross-workspace data access
```

#### AC-13: Concurrent creation — one wins, one gets 409 (Edge — Medium)
**Best source**: Nahuel, Ciprian

```gherkin
Given two authenticated users send POST /api/v1/workspaces simultaneously with name "Concurrent Team"
When both requests arrive at the server within the same window
Then exactly one request returns 201 Created
And the other request returns 409 Conflict (SLUG_NOT_UNIQUE)
And no duplicate workspace rows exist
```

#### AC-14: Derived slug from mostly-special-chars name produces too-short slug (Edge — Medium)
**Best source**: Ely

```gherkin
Given a user is authenticated
When the user sends POST /api/v1/workspaces with body { "name": "!@#A" }
Then the server derives a slug with fewer than 3 valid characters
And the server responds 400 Bad Request
And the error body contains { "success": false, "error": { "code": "SLUG_EMPTY" } }
```

---

### BK-5 — Invite a Teammate

#### AC-1: Admin creates invite successfully (Positive — Critical)
**Best source**: Story (original)

```gherkin
Given Mateo is authenticated as workspace owner of ws-01
And no active member or pending invite exists for elena@example.com
When Mateo sends POST /api/v1/workspaces/ws-01/invites with body { "email": "elena@example.com", "role": "member" }
Then the server responds 201 Created
And the response body contains { "success": true, "data": { "invite_id": "<uuid>", "email": "elena@example.com", "role": "member", "status": "pending", "expires_at": "<ISO 24h from now>" } }
And a workspace_invites row exists with workspace_id=ws-01, email=elena@example.com, role=member, status=pending
And the invite token is HMAC-signed containing { workspace_id, email, role, exp }
And the token is embedded in a raw link (email dispatch is stubbed)
```

#### AC-2: Invitee accepts invite and gets membership (Positive — Critical)
**Best source**: Story (original)

```gherkin
Given a valid pending invite exists with token for elena@example.com, role=member, workspace=ws-01
And Elena is authenticated with email elena@example.com
When Elena sends POST /api/v1/invites/accept with body { "token": "<valid_token>" }
Then the server responds 200 OK
And the response body contains { "success": true, "data": { "workspace_id": "ws-01", "member_id": "<uuid>", "role": "member" } }
And a workspace_members row exists with user_id=<elena_uid>, workspace_id=ws-01, role=member
And the workspace_invites row is updated to status=accepted, accepted_at=<now>
```

#### AC-3: HMAC token validation — tampered token rejected (Negative — Critical)
**Best source**: Story (original), Nahuel

```gherkin
Given a valid invite token is signed with HMAC containing role=viewer
When an attacker modifies the payload to role=admin and sends POST /api/v1/invites/accept with the tampered token
Then the server responds 403 Forbidden
And the error body contains { "success": false, "error": { "code": "INVITE_TOKEN_INVALID" } }
And no membership is created
And the invite remains in pending status
```

#### AC-4: Expired token rejected (Negative — Critical)
**Best source**: Story (original)

```gherkin
Given an invite was created more than 24 hours ago
And the token's embedded expiry is in the past
When the invitee sends POST /api/v1/invites/accept with the expired token
Then the server responds 410 Gone
And the error body contains { "success": false, "error": { "code": "INVITE_EXPIRED" } }
And no membership is created
```

#### AC-5: Non-admin cannot create invite (Negative — Critical)
**Best source**: Story (original)

```gherkin
Given Elena is a workspace member (not admin)
When Elena sends POST /api/v1/workspaces/ws-01/invites with body { "email": "carlos@example.com", "role": "member" }
Then the server responds 403 Forbidden
And the error body contains { "success": false, "error": { "code": "FORBIDDEN", "message": "Admin or owner role required to invite teammates" } }
And no invite row is created
```

#### AC-6: Cannot invite higher role than caller (Negative — Critical)
**Best source**: Story (original), Nahuel

```gherkin
Given Mateo is a workspace admin (not owner)
When Mateo sends POST /api/v1/workspaces/ws-01/invites with body { "email": "new-owner@example.com", "role": "owner" }
Then the server responds 422 Unprocessable Entity
And the error body contains { "success": false, "error": { "code": "ROLE_HIERARCHY_VIOLATION", "message": "Caller role 'admin' cannot assign role 'owner'" } }
And no invite row is created
```

#### AC-7: Idempotent accept on already-accepted invite (Positive — High)
**Best source**: Story (original)

```gherkin
Given an invite has already been accepted (status=accepted, membership exists)
When the user re-submits POST /api/v1/invites/accept with the same token
Then the server responds 200 OK
And the response body contains { "success": true, "data": { "workspace_id": "ws-01", "member_id": "<existing_member_id>", "role": "member", "already_accepted": true } }
And no duplicate membership row is created
```

#### AC-8: Duplicate email invite rejected (Negative — High)
**Best source**: Story (original)

```gherkin
Given Elena is already an active workspace_member of ws-01 with email elena@example.com
When an admin sends POST /api/v1/workspaces/ws-01/invites with body { "email": "elena@example.com", "role": "member" }
Then the server responds 409 Conflict
And the error body contains { "success": false, "error": { "code": "EMAIL_ALREADY_MEMBER" } }
And no invite row is created
```

#### AC-9: Auth enforcement on invite creation (Negative — High)
**Best source**: Derived (standard security)

```gherkin
Given no valid auth token is provided
When a user sends POST /api/v1/workspaces/ws-01/invites with body { "email": "test@example.com", "role": "member" }
Then the server responds 401 Unauthorized
And no invite row is created
```

#### AC-10: Revoke invite (Positive — High)
**Best source**: Ely (architect comment, implemented in commit 3c851d5)

```gherkin
Given an admin has created an invite for elena@example.com
When the admin sends DELETE /api/v1/workspaces/ws-01/invites/{inviteId}
Then the server responds 200 OK
And the invite status is set to "revoked"
When the invitee later sends POST /api/v1/invites/accept with the revoked token
Then the server responds 410 Gone
And the error body contains { "success": false, "error": { "code": "INVITE_REVOKED" } }
```

#### AC-11: Resend/rotate invite (Positive — Medium)
**Best source**: Ely (architect comment, implemented in commit 3c851d5)

```gherkin
Given an admin has created a pending invite for elena@example.com
When the admin sends POST /api/v1/workspaces/ws-01/invites/{inviteId}/rotate
Then the server responds 200 OK
And a new token is generated with a new 7-day expiry
And the old token is immediately invalidated
When the invitee tries to accept with the old token
Then the server responds 404 or 410
```

#### AC-12: Invite email must match caller email on accept (Negative — Critical)
**Best source**: From story specs

```gherkin
Given an invite token encodes email=elena@example.com
And Carlos is authenticated with email carlos@example.com
When Carlos sends POST /api/v1/invites/accept with the valid token
Then the server responds 403 Forbidden
And the error body contains { "success": false, "error": { "code": "INVITE_EMAIL_MISMATCH", "message": "Token email 'elena@example.com' does not match authenticated email 'carlos@example.com'" } }
And no membership is created
```

#### AC-13: Member cannot see invites list (Negative — High)
**Best source**: Nahuel

```gherkin
Given Elena is a workspace member (not admin)
When Elena sends GET /api/v1/workspaces/ws-01/invites
Then the server responds 403 Forbidden
And only admins and owners can view the invite list
```

---

## 2. Test Execution Plan

### 2.1 API Tests (Postman/curl/Playwright API)

#### BK-4 API Test Flow
| # | Scenario | Method | Endpoint | Auth | Body | Expected | Priority |
|---|----------|--------|----------|------|------|----------|----------|
| 1 | Create workspace (valid) | POST | /workspaces | Bearer | `{"name":"Acme QA"}` | 201 + id, slug, role, plan | Critical |
| 2 | Spaces trimmed | POST | /workspaces | Bearer | `{"name":"  Acme   QA  "}` | 201, slug "acme-qa" | Medium |
| 3 | Accented chars | POST | /workspaces | Bearer | `{"name":"Área QA"}` | 201, slug "area-qa" | High |
| 4 | Extra fields ignored | POST | /workspaces | Bearer | `{"name":"My Team","extra":"ignored"}` | 201, no extra effect | Medium |
| 5 | Name too short | POST | /workspaces | Bearer | `{"name":"AB"}` | 400 NAME_TOO_SHORT | High |
| 6 | Name too long | POST | /workspaces | Bearer | `{"name":"<61 chars>"}` | 400 NAME_TOO_LONG | High |
| 7 | No alphanumeric | POST | /workspaces | Bearer | `{"name":"!!! @@@ ###"}` | 400 NAME_NO_ALPHANUMERIC | High |
| 8 | Name at min boundary | POST | /workspaces | Bearer | `{"name":"ABC"}` | 201 | High |
| 9 | Name at max boundary | POST | /workspaces | Bearer | `{"name":"<60 chars>"}` | 201 | High |
| 10 | Duplicate slug | POST | /workspaces | Bearer | `{"name":"Acme QA"}` (repeat) | 409 SLUG_NOT_UNIQUE | Critical |
| 11 | Reserved slug | POST | /workspaces | Bearer | `{"name":"Admin"}` | 400 SLUG_RESERVED | Critical |
| 12 | Unauth request | POST | /workspaces | None | `{"name":"Test"}` | 401 UNAUTHORIZED | High |
| 13 | Derived slug too short | POST | /workspaces | Bearer | `{"name":"!@#A"}` | 400 SLUG_EMPTY | Medium |
| 14 | List workspaces | GET | /workspaces | Bearer | — | 200, includes new workspace | Medium |
| 15 | Get single workspace | GET | /workspaces/{id} | Bearer | — | 200 | Medium |
| 16 | Get non-member workspace | GET | /workspaces/{other-id} | Bearer | — | 403 (RLS isolation) | Critical |

#### BK-5 API Test Flow
| # | Scenario | Method | Endpoint | Auth | Body | Expected | Priority |
|---|----------|--------|----------|------|------|----------|----------|
| 1 | Owner creates invite | POST | /workspaces/{id}/invites | Bearer (owner) | `{"email":"invitee@test.com","role":"member"}` | 201 + invite_id, token | Critical |
| 2 | Admin creates invite | POST | /workspaces/{id}/invites | Bearer (admin) | `{"email":"viewer@test.com","role":"viewer"}` | 201 | High |
| 3 | Member cannot invite | POST | /workspaces/{id}/invites | Bearer (member) | `{"email":"test@test.com","role":"member"}` | 403 FORBIDDEN | Critical |
| 4 | Viewer cannot invite | POST | /workspaces/{id}/invites | Bearer (viewer) | `{"email":"test@test.com","role":"viewer"}` | 403 FORBIDDEN | High |
| 5 | Admin invites higher role | POST | /workspaces/{id}/invites | Bearer (admin) | `{"email":"test@test.com","role":"owner"}` | 422 ROLE_HIERARCHY_VIOLATION | Critical |
| 6 | Duplicate email | POST | /workspaces/{id}/invites | Bearer (owner) | `{"email":"<existing_member>","role":"member"}` | 409 EMAIL_ALREADY_MEMBER | High |
| 7 | Invalid email format | POST | /workspaces/{id}/invites | Bearer (owner) | `{"email":"not-an-email","role":"member"}` | 400 VALIDATION_ERROR | High |
| 8 | Empty email | POST | /workspaces/{id}/invites | Bearer (owner) | `{"email":"","role":"member"}` | 400 VALIDATION_ERROR | High |
| 9 | Invalid role | POST | /workspaces/{id}/invites | Bearer (owner) | `{"email":"test@test.com","role":"superadmin"}` | 400 VALIDATION_ERROR | High |
| 10 | Non-existent workspace | POST | /workspaces/{fake-id}/invites | Bearer (owner) | `{"email":"test@test.com","role":"member"}` | 404 | Medium |
| 11 | Unauth invite creation | POST | /workspaces/{id}/invites | None | `{"email":"test@test.com","role":"member"}` | 401 | High |
| 12 | List invites (admin) | GET | /workspaces/{id}/invites | Bearer (admin) | — | 200 | Medium |
| 13 | List invites (member) | GET | /workspaces/{id}/invites | Bearer (member) | — | 403 | High |
| 14 | Accept invite (matching email) | POST | /invites/accept | Bearer (invitee) | `{"token":"<valid>"}` | 200 + membership | Critical |
| 15 | Accept invite (wrong email) | POST | /invites/accept | Bearer (other user) | `{"token":"<valid>"}` | 403 INVITE_EMAIL_MISMATCH | Critical |
| 16 | Accept tampered token | POST | /invites/accept | Bearer | `{"token":"<tampered>"}` | 403 INVITE_TOKEN_INVALID | Critical |
| 17 | Accept expired token | POST | /invites/accept | Bearer | `{"token":"<expired>"}` | 410 INVITE_EXPIRED | Critical |
| 18 | Idempotent re-accept | POST | /invites/accept | Bearer (invitee) | `{"token":"<already_accepted>"}` | 200 (no dup) | High |
| 19 | Accept invalid token | POST | /invites/accept | Bearer | `{"token":"garbage"}` | 404 INVITE_NOT_FOUND | Medium |
| 20 | Revoke invite | DELETE | /workspaces/{id}/invites/{invId} | Bearer (admin) | — | 200 | High |
| 21 | Accept revoked token | POST | /invites/accept | Bearer | `{"token":"<revoked>"}` | 410 INVITE_REVOKED | High |
| 22 | Rotate invite token | POST | /workspaces/{id}/invites/{invId}/rotate | Bearer (admin) | — | 200 + new token | Medium |
| 23 | Old token after rotate | POST | /invites/accept | Bearer | `{"token":"<old>"}` | 404 or 410 | Medium |

### 2.2 UI Tests (Playwright)

#### BK-4 UI Flow
| # | Scenario | Steps | Expected | Priority |
|---|----------|-------|----------|----------|
| 1 | Onboarding workspace creation | Sign in → Onboarding page → Enter name "My QA Team" → Slug preview shows "my-qa-team" → Click Create | Redirect to /my-qa-team | Critical |
| 2 | Slug preview live update | Type "Hello World" → Type additional chars → Observe preview | Preview updates in real-time, matches server slug | Medium |
| 3 | Name too short UX | Type "AB" → Attempt submit | Client-side validation blocks, error message shown | High |
| 4 | Name too long UX | Type 61+ chars | Client-side validation blocks or input capped | Medium |
| 5 | Create second workspace | Already have workspace → Navigate to create → Submit new name | Second workspace created, both accessible | Medium |

#### BK-5 UI Flow
| # | Scenario | Steps | Expected | Priority |
|---|----------|-------|----------|----------|
| 1 | Full invite accept flow (new user) | Click invite link → Redirect to login → Sign in with matching email → Redirect back | Auto-accepts, membership created, lands on workspace home | Critical |
| 2 | Invite accept (already signed in) | Signed in as elena@ → Click "accept" → No login redirect needed | Membership created, redirect to workspace | High |
| 3 | Invite with wrong user | Signed in as carlos@ → Click elena's invite link | Error: "This invite is for elena@..." | Critical |
| 4 | Members page with invite list | Navigate to /workspaces/{slug}/settings/members | See member list + pending invites with status | Medium |
| 5 | Create invite via UI | Members page → Invite button → Fill email + select role → Submit | Toast "Invite sent", invite appears in list, clipboard copies token | Critical |
| 6 | Revoke invite via UI | Pending invite → Click revoke | Invite shows revoked status | High |
| 7 | Rotate invite via UI | Pending invite → Click rotate | New token generated, old one invalidated | Medium |
| 8 | Expired invite page | Visit /invites/accept?token=<expired> | Shows "This invite has expired" | High |

### 2.3 Integration Tests
| # | Scenario | Approach | Expected | Priority |
|---|----------|----------|----------|----------|
| 1 | BK-4 → BK-5 chain | Create workspace via API → Use new workspace id to create invites → Invitee accepts | Full end-to-end tenancy flow works | Critical |
| 2 | Data isolation | Create WS-A, WS-B as different owners → WS-A owner cannot access WS-B | RLS enforced, cross-workspace 403 | Critical |
| 3 | Concurrent workspace creation | 2 users POST same name simultaneously | One 201, one 409 | Medium |
| 4 | Transaction rollback | Simulate membership insert failure during workspace creation | No orphaned workspace rows | Critical |

---

## 3. Auth Setup Instructions for Staging

### 3.1 Authentication Mechanism
Bunkai uses Supabase Auth with JWT sessions. The API accepts:
- **Bearer token**: JWT from Supabase session (obtained via OAuth or magic link sign-in)
- The JWT carries `user_id`, `email`, and optionally `workspace_id` + `scopes`

### 3.2 Obtaining Tokens for Testing

#### Option A: UI-driven (recommended for manual QA)
1. Navigate to https://upexbunkai.vercel.app
2. Sign up / Sign in via GitHub OAuth or email magic link
3. Open DevTools → Application → Local Storage → find `sb-*-auth-token`
4. Extract the `access_token` field from the stored Supabase session
5. Use as `Authorization: Bearer <access_token>` in API requests

#### Option B: Programmatic (for automated tests)
1. Use Playwright to perform OAuth sign-in (store auth state as `storageState`)
2. Or use Supabase client SDK `supabase.auth.signInWithPassword()` / `signInWithOAuth()`
3. Save the session for reuse across test runs

### 3.3 Required Test Accounts
| Persona | Email | Role | Purpose |
|---------|-------|------|---------|
| Owner (Mateo) | `<test-owner>` | owner | Create workspace, create invites, manage members |
| Admin | `<test-admin>` | admin | Create invites for viewer/member roles |
| Member (Elena) | `<test-member>` | member | Accept invites, access workspace resources |
| Viewer (Sara) | `<test-viewer>` | viewer | Read-only workspace access |
| External (Carlos) | `<test-external>` | none | Attempt unauthorized access, wrong-user invite acceptance |

**Note**: Use real email accounts you control (Gmail with `+alias` syntax works well). Example pattern: `bunkai-qa+owner@<domain>`, `bunkai-qa+member@<domain>`, etc.

### 3.4 Auth Token Notes
- JWTs expire (typically 1h for Supabase sessions). Use refresh tokens for long-running test sessions.
- PATs (Personal Access Tokens) exist for Karim/agent personas but are out of scope for BK-4/BK-5 manual testing.
- Staging environment may have different Supabase project — verify the auth domain.

---

## 4. Test Data Requirements

### 4.1 Workspace Names (BK-4)
| # | Name | Expected Slug | Test Type |
|---|------|---------------|-----------|
| 1 | `Acme QA` | `acme-qa` | Positive |
| 2 | `  Acme   QA  ` | `acme-qa` | Whitespace trim |
| 3 | `Área QA` | `area-qa` | Accent strip |
| 4 | `ABC` | `abc` | Min boundary |
| 5 | `A` × 60 | 60-char kebab | Max boundary |
| 6 | `A` × 61 | — | Too long (rejected) |
| 7 | `AB` | — | Too short (rejected) |
| 8 | `!!! @@@ ###` | — | No alphanumeric (rejected) |
| 9 | `Admin` | — | Reserved slug (rejected) |
| 10 | `Api` | — | Reserved slug (rejected) |
| 11 | `Settings` | — | Reserved slug (rejected) |
| 12 | `!@#A` | — | Slug too short (rejected) |
| 13 | `My QA Team` | `my-qa-team` | UI slug preview |
| 14 | `München QA` | `munchen-qa` | NFKD normalization |
| 15 | `Concurrent Team` | — | Race condition test |

### 4.2 Invite Test Data (BK-5)
| # | Inviter | Invitee Email | Role | Expected |
|---|---------|---------------|------|----------|
| 1 | Owner | `bunkai-qa+member@<domain>` | member | 201 |
| 2 | Admin | `bunkai-qa+viewer@<domain>` | viewer | 201 |
| 3 | Member | any | any | 403 |
| 4 | Viewer | any | any | 403 |
| 5 | Admin | any | owner | 422 ROLE_HIERARCHY_VIOLATION |
| 6 | Owner | `<existing member email>` | member | 409 EMAIL_ALREADY_MEMBER |
| 7 | Owner | `not-an-email` | member | 400 |
| 8 | Owner | `` (empty) | member | 400 |
| 9 | Owner | `test@<domain>` | superadmin | 400 |

### 4.3 Token Lifecycle Test Data
| # | Token State | How to Create | Test |
|---|-------------|---------------|------|
| 1 | Valid pending | Standard invite creation | Happy path accept |
| 2 | Tampered | Base64-decode, change role, re-encode | 403 INVITE_TOKEN_INVALID |
| 3 | Expired | Create invite, wait 24h+ | 410 INVITE_EXPIRED |
| 4 | Already accepted | Accept invite once, retry | 200 idempotent |
| 5 | Revoked | Create invite → DELETE | 410 INVITE_REVOKED |
| 6 | Rotated | Create invite → POST rotate → use old token | 404 or 410 |
| 7 | Garbage/malformed | Random string | 404 INVITE_NOT_FOUND |

### 4.4 Data Cleanup Strategy
- After each test run, delete created workspaces (if delete endpoint exists) or use unique suffixes to avoid slug collisions across test runs.
- Pattern: `qa-{timestamp}-{random}` for workspace names in automated tests.
- For manual tests, coordinate with the team to avoid stepping on each other's data.
- Staging DB may be reset periodically — coordinate with dev team.

---

## 5. Known Gaps

### 5.1 Email Dispatch Stubbed
- **Impact**: Email delivery cannot be verified end-to-end. The invite token is returned in the API response and clipboard-copied in the UI instead of being emailed.
- **Workaround**: Extract the token from the API response or UI clipboard copy. The accept flow itself works — only the email transport is bypassed.
- **Test implication**: ACs involving email failure handling are untestable until email dispatch is wired. Scenario: "Invite created regardless of email failure" cannot be verified.

### 5.2 BK-4: Reserved Slug List Undefined
- **Impact**: Cannot exhaustively test all reserved slug rejections. The PO has not confirmed the full list.
- **Probable list** (inferred): `admin`, `api`, `app`, `auth`, `bunkai`, `dashboard`, `settings`, `www`, `mail`, `status`, `docs`, `help`, `blog`, `test`, `dev`, `staging`, `prod`, `login`, `signup`, `logout`, `workspace`, `workspaces`, `project`, `projects`, `new`, `create`, `edit`, `delete`, `search`, `403`, `404`, `500`.
- **Action**: Test at least `admin`, `api`, `settings` as critical reserved values. Flag any other reserved slug as a discovery item.

### 5.3 BK-4: Unicode Normalization Unspecified
- **Impact**: Non-Latin workspace names behavior is undefined. Assumed NFKD decomposition → strip combining marks → keep only `[a-z0-9-]`.
- **Recommendation**: Test with "München", "東京", "Привет" during exploratory QA and document actual behavior.

### 5.4 BK-5: HMAC Signing Strategy Undocumented
- **Impact**: Token structure cannot be independently verified. Tampered token tests rely on behavior observation only.
- **Current known behavior** (from Ely's implementation): Tokens follow `bk_inv_<secret>` format. HMAC signed with workspace-level secret. Payload: `{workspace_id, email, role, exp}`.
- **Action**: Document the actual token format found during testing.

### 5.5 BK-5: No Dedicated Error Catalog
- **Impact**: Error codes and messages are inferred from the refinement documents but not confirmed by the deployed API.
- **Expected codes**: `EMAIL_ALREADY_MEMBER`, `ROLE_HIERARCHY_VIOLATION`, `INVITE_TOKEN_INVALID`, `INVITE_EXPIRED`, `INVITE_REVOKED`, `INVITE_EMAIL_MISMATCH`, `INVITE_NOT_FOUND`, `FORBIDDEN`.
- **Action**: Verify actual error codes returned by staging API and document discrepancies.

### 5.6 BK-4: Response Body Shape Inconsistency
- **Impact**: Story says `{workspace_id, slug}`, API map says `{id, slug, name, role, plan}`.
- **Deployed behavior** (commit beae616): Check actual response from staging POST /workspaces.
- **Action**: Document the actual field names (`id` vs `workspace_id`) for test assertions.

### 5.7 No Workspace Deletion in MVP
- **Impact**: Cannot clean up test workspaces programmatically. Slugs accumulate in staging.
- **Workaround**: Use unique, timestamped names: `qa-20260527-<random>`.

### 5.8 BK-5: `workspace_invites` Table Schema Not in ERD
- **Impact**: Cannot verify DB state for invite rows.
- **Action**: Verify via API responses and UI. Document discovered schema fields.

### 5.9 BK-4: Activity Log and Event Emission Verification
- **Impact**: No consumer for `workspace.created` event is documented. Activity log cannot be queried via API (no GET /activity endpoint in MVP).
- **Action**: Mark AC-11 (activity log) and event emission as "verify if possible" — may be deferred.

---

## 6. Test Environment

| Property | Value |
|----------|-------|
| **Base URL** | https://upexbunkai.vercel.app |
| **API Base** | https://upexbunkai.vercel.app/api/v1 |
| **OpenAPI Docs** | https://upexbunkai.vercel.app/api/docs |
| **Auth Provider** | Supabase Auth (GitHub OAuth, email magic link) |
| **BK-4 Deployed** | Commit beae616 |
| **BK-5 Deployed** | Commit 3c851d5 |
| **Email Dispatch** | STUBBED — clipboard copy instead of email |
| **Staging DB** | Supabase (shared staging instance) |

### Pre-test Checklist
- [ ] Verify staging app is accessible at https://upexbunkai.vercel.app
- [ ] Confirm API docs load at /api/docs
- [ ] Create test accounts for owner, admin, member, viewer, external personas
- [ ] Extract and verify JWT tokens work with curl
- [ ] Confirm no conflicting test data exists (coordinate with team)
- [ ] Clear localStorage / cookies between persona switches in UI tests

---

## Appendix: Scope & Dependencies

### BK-4 Dependencies
- **BK-1 (Auth)**: User must be authenticated (JWT session) — dependency satisfied.
- **BK-037 (Idempotency-Key)**: May apply to POST /workspaces — verify if supported.
- **BK-038 (Activity Log)**: workspace.created event should produce activity_log row — observe.

### BK-5 Dependencies
- **BK-4 (Workspace)**: A workspace must exist to create invites — create workspace first.
- **BK-1 (Auth)**: Both inviter and invitee must authenticate — dependency satisfied.
- **Email service**: Stubbed — not a blocker for testing.

### Test Execution Order
1. **BK-4 first**: Create workspace → obtain workspace ID
2. **BK-5 second**: Use workspace ID → create invites → accept → verify membership
3. **Isolation test**: Cross-workspace access denied
4. **Cleanup**: Coordinate with team for staging data management
