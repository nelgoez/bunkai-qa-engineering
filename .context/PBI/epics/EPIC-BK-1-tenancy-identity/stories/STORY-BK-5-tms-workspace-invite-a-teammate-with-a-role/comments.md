# Comments for BK-5

[View in Jira](https://jira.upexgalaxy.com/browse/BK-5)

---

### Ely - 19/5/2026, 21:05:44

🧱 ****Architect Annotation****

**Posted by repo automation. Sections below are the architecture-grade complement to the user-facing fields (description / AC / Scope / Business Rules / Workflow). Source-of-truth on dev-side concerns — synced to local `comments.md` by `sync-jira-issues`.**

1. 

- Settings page: `<MembersTab />` with invite form + pending-invites list.
- Page: `app/accept-invite/page.tsx`.

1. 

- Routes:
- `POST app/api/v1/workspaces/[id]/invites/route.ts`
- `POST app/api/v1/invites/[token]/accept/route.ts`
- `GET  app/api/v1/workspaces/[id]/invites/route.ts`
- Token signing: HMAC-SHA256 with secret from env.
- Email dispatch: Supabase Auth's `inviteUserByEmail` OR custom Resend integration.

1. 

- Tables: `workspace*invites`, `workspace*members`.
- Index: `(workspace_id, lower(email))` unique pending.

1. 

- [https://jira.upexgalaxy.com/browse/BK-4#icft=BK-4](https://jira.upexgalaxy.com/browse/BK-4#icft=BK-4) (workspace creation).

1. 

- [https://jira.upexgalaxy.com/browse/BK-2#icft=BK-2](https://jira.upexgalaxy.com/browse/BK-2#icft=BK-2) / [https://jira.upexgalaxy.com/browse/BK-3#icft=BK-3](https://jira.upexgalaxy.com/browse/BK-3#icft=BK-3) (sign-in flows — invitee must be able to sign in).

1. 

- [ ] All 7 AC scenarios pass on staging.
- [ ] HMAC token-signing unit tests.
- [ ] Email actually arrives in invitee's inbox (smoke test on staging).
- [ ] Role-hierarchy enforced server-side (NOT only client-side filter).
- [ ] RLS policy verifies caller membership before listing pending invites.

---

### Ely - 27/5/2026, 20:50:18

Implementado este sprint.

Code on main:

- 3c851d5 feat(invites): workspace invite issuance + accept flow (bk-5)

Schema: migration 0010*workspace*invites — token*hash storage (SHA-256), 7-day default expiry, RLS gated to admins/owners via bunkai*is*workspace*admin.

Surfaces ready for QA:

- POST /api/v1/workspaces/{id}/invites — issue invite (admin/owner only). Returns raw bk*inv*<secret> token + accept_url exactly once.
- GET /api/v1/workspaces/{id}/invites — list (status derived: pending / accepted / revoked / expired).
- POST /api/v1/workspaces/{id}/invites/{inviteId} — rotate (resend) token; clears accept/revoke flags + extends expiry 7d.
- DELETE /api/v1/workspaces/{id}/invites/{inviteId} — revoke.
- POST /api/v1/invites/accept — invitee redeems token; email match enforced; upserts workspace_members.
- /workspaces/{id}/members UI with invite form + clipboard copy + rotate / revoke buttons.
- /invites/accept?token=... public landing.

Known gap: transactional email dispatch stubbed (no Resend / SES integration yet). MVP copies the accept link to the inviter's clipboard.

Testability guide: /qa + Jira Epic [https://jira.upexgalaxy.com/browse/BK-29#icft=BK-29](https://jira.upexgalaxy.com/browse/BK-29#icft=BK-29).

---

### Nahuel Gomez - 27/5/2026, 22:04:41

# Shift-Left Refinement: [https://jira.upexgalaxy.com/browse/BK-5#icft=BK-5](https://jira.upexgalaxy.com/browse/BK-5#icft=BK-5) — Invite a teammate to a Workspace

***Status****: Refined — Awaiting PO Estimation | ****Score****: CRITICAL 27 | ****Refined***: 2026-05-27

## Verdict: Needs Improvement

Core flow described well, but significant gaps for a CRITICAL 27 Auth/RBAC ticket.

## Key Gaps (10 found)

1. ***POST /invites/{token}/accept*** absent from `api-contracts.yaml` v1.0 — release-blocking gap. Frontend and Karim agent have no contract.
2. ***No list/revoke/resend invite endpoints*** — Admin cannot audit pending invites or cancel mistakes.
3. ***HMAC signing unspecified*** — algorithm, key source, rotation strategy all undocumented. Token security depends on this.
4. ***No AC for email dispatch failure*** — behavior when SMTP down is undefined.
5. ***No AC for token tampering*** — missing security AC (critical for Auth story).
6. ***No AC for email mismatch on accept*** — missing wrong-user rejection AC.
7. ***No AC for deleted workspace edge case*** — invite to workspace later deleted.
8. ***Email uniqueness scope unclear*** — active members only vs active + pending invites.
9. ***workspace_invites table schema*** not in canonical ERD.
10. ***No AC for duplicate membership idempotency*** — replay attack vector.

## Critical Questions for PO (block sprint planning)

1. ***Does email uniqueness include pending invites, or only active members?*** Two admins could invite same email concurrently.
2. ***Idempotency behavior when already-accepted invite is re-clicked by removed member?*** Return 200 with stale data or 404?
3. ***Should inviter's current role affect pending invite validity?*** Admin demoted to member after sending invite.

## Technical Questions for Dev

1. HMAC algorithm + key source (workspace-level `invite*secret` column or global `INVITE*SIGNING_KEY`)?
2. Is accept a single DB transaction (token validation + member insert + invite status update)?
3. Email dispatch: Supabase transactional email or custom provider?
4. Will POST /invites/{token}/accept be added to api-contracts.yaml before /project-bootstrap?
5. workspace_invites table schema?

## Blockers

- ***[****BLOCKER]*** Add POST /invites/{token}/accept to api-contracts.yaml
- ***[****BLOCKER]*** Add GET /workspaces/{id}/invites and DELETE /workspaces/{id}/invites/{invite_id} to scope

## Test Coverage Estimate

| Type  | Count  |
| --- | --- |
| ------ | ------- |
| Positive  | 5  |
| Negative  | 11  |
| Boundary  | 4  |
| Integration  | 3  |
| API  | 4  |
| ***Total****  | ****27***  |

High count driven by RBAC role matrix (4 roles × invite create + accept) + HMAC token security (tamper/replay/expiry).

## Suggested Story Improvements

1. Add POST /invites/{token}/accept to api-contracts.yaml
2. Add list/revoke/resend invite endpoints to MVP scope
3. Specify HMAC-SHA256 with workspace-level secret
4. Define email dispatch failure behavior (201 + resend affordance)
5. Add security ACs: token tampering, email mismatch, replay
6. Specify email normalization (lowercase + Unicode NFC)
7. Define workspace_invites table schema for /project-bootstrap

**Shift-Left QA refinement — batch session 2026-05-27**

---

### Nahuel Gomez - 27/5/2026, 22:04:43

## Unified QA Test Results — [https://jira.upexgalaxy.com/browse/BK-4#icft=BK-4](https://jira.upexgalaxy.com/browse/BK-4#icft=BK-4) & [https://jira.upexgalaxy.com/browse/BK-5#icft=BK-5](https://jira.upexgalaxy.com/browse/BK-5#icft=BK-5) (Staging)

***Date****: 2026-05-28 | ****Tester****: Nahuel Gomez | ****Env***: [https://upexbunkai.vercel.app](https://upexbunkai.vercel.app/)

### [https://jira.upexgalaxy.com/browse/BK-4#icft=BK-4](https://jira.upexgalaxy.com/browse/BK-4#icft=BK-4) — Create Workspace ✅ 9/9 tested

| AC  | Scenario  | Result  |
| --- | --- | --- |
| ---- | ---------- | :---: |
| AC-1  | POST /workspaces {name:"QA Test Workspace", slug:"qa-test-workspace"} → 201, slug derived, caller=owner  | ✅  |
| AC-5  | Name too short ("AB") → 400 validation_failed  | ✅  |
| AC-5  | Slug too short ("ab") → 400 too_small min:3  | ✅  |
| AC-5  | Empty name → 400 too_small min:1  | ✅  |
| AC-6  | Duplicate slug → 409 "already taken"  | ✅  |
| AC-8  | Reserved slug "admin" → 400 "Slug is reserved"  | ✅  |
| AC-8  | GET /workspaces → 200, 1 workspace  | ✅  |
| AC-8  | GET /workspaces/{id} → 200, correct slug/name  | ✅  |
| AC-8  | GET /workspaces/{bad-id} → 404 not_found  | ✅  |
| PATCH  | Rename to "QA Test Renamed" → 200, persisted  | ✅  |

### [https://jira.upexgalaxy.com/browse/BK-5#icft=BK-5](https://jira.upexgalaxy.com/browse/BK-5#icft=BK-5) — Invite Teammate ✅ 6/6 tested

| AC  | Scenario  | Result  |
| --- | --- | --- |
| ---- | ---------- | :---: |
| AC-1  | POST /invites (API) → 201, token bk*inv**, 7d expiry  | ✅  |
| AC-1  | Create invite (UI) → 201, clipboard copy  | ✅  |
| AC-8  | GET /invites → 200, 1 pending  | ✅  |
| AC-12  | Accept with mismatched email → 403 "different email address"  | ✅  |
| AC-10  | DELETE /invites/{id} → {ok:true}  | ✅  |
| AC-10  | Revoked invite shows in UI as "revoked"  | ✅  |

### Known Gaps (not tested)

- [https://jira.upexgalaxy.com/browse/BK-5#icft=BK-5](https://jira.upexgalaxy.com/browse/BK-5#icft=BK-5).2: Accept invite (needs second authenticated user with matching email)
- [https://jira.upexgalaxy.com/browse/BK-5#icft=BK-5](https://jira.upexgalaxy.com/browse/BK-5#icft=BK-5).5: RBAC non-admin rejection (needs second user)
- [https://jira.upexgalaxy.com/browse/BK-5#icft=BK-5](https://jira.upexgalaxy.com/browse/BK-5#icft=BK-5).11: Rotate invite token
- [https://jira.upexgalaxy.com/browse/BK-4#icft=BK-4](https://jira.upexgalaxy.com/browse/BK-4#icft=BK-4).11: Transaction atomicity (workspace + owner rollback)
- No workspace deletion endpoint

### Cleanup

- Workspace "QA Test Renamed" (8a2d1ff6-5e00) left on staging (no DELETE endpoint)
- Invite qa-member@bunkai.io revoked

---


_Synced from Jira by sync-jira-issues_
