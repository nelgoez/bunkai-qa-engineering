# BK-5 — TMS-Workspace | Invite a teammate with a role

**Session**: Sprint Testing — autonomous=full
**Date**: 2026-06-05
**Tester**: Nahuel Gomez
**Env**: Staging (https://staging-upexbunkai.vercel.app)
**Modality**: Jira-native
**Shift-Left**: Short-circuit — `shift-left-reviewed` label 2026-05-27 (<30 days)

## Quick Facts
- **Key**: BK-5
- **Epic**: BK-1 (Tenancy & Identity)
- **FR**: FR-003 — Invite teammate
- **Role hierarchy**: viewer ⊂ member ⊂ admin ⊂ owner
- **Caller**: Must be admin+ to invite. Invited role ≤ caller's role.
- **Token**: HMAC-signed (generated via `bk_inv_<secret>`, SHA-256 hash stored in `workspace_invite_secrets`)
- **Accept**: `POST /api/v1/invites/accept` with `{ token: "..." }` in body
- **MVP**: No transactional email — link returned in API response

## Key Endpoints
- `POST /api/v1/workspaces/{id}/invites` — create invite (admin+)
- `GET /api/v1/workspaces/{id}/invites` — list invites (admin+)
- `POST /api/v1/workspaces/{id}/invites/{inviteId}` — rotate/resend token
- `DELETE /api/v1/workspaces/{id}/invites/{inviteId}` — revoke invite
- `POST /api/v1/invites/accept` — accept invite (any authenticated user)

## Implementation Notes (from code review)
- Role enum: `viewer | member | admin` (owner cannot be invited)
- Already-accepted invite → 409 conflict, NOT idempotent 200
- Email case-insensitive matching on accept
- RLS-gated: only workspace admins/owners can create/list/manage invites
- Token hash in `workspace_invite_secrets` table (admin-only read)
- 7-day expiry (not 24h as originally specified)
- Rotate clears accept/revoke flags + extends expiry 7d

## Primary Workspace
- Name: QA Test Workspace
- ID: aed86386-2ed8-424e-934b-ca7a0ef6af37
- Slug: qa-test-ws-20260605
- Owner: qa-headless@bunkai.io (user_id: 0cdfea29-cbf7-4762-b4aa-f6d152492f43)

## Open Questions
- Role hierarchy enforcement server-side: caller role check — is admin→admin valid? (spec says "less than or equal")
- Cross-workspace token: is token tied to workspace_id? Yes via invite lookup
- Email uniqueness across pending invites: code regex suggests email uniqueness only checked at DB constraint level
