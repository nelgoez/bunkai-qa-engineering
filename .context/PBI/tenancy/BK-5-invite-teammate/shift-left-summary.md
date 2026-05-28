# Shift-Left Refinement: BK-5 — Invite a teammate to a Workspace

**Status**: Refined — Awaiting PO Estimation | **Score**: CRITICAL 27 | **Refined**: 2026-05-27

## Verdict: Needs Improvement

Core flow described well, but significant gaps for a CRITICAL 27 Auth/RBAC ticket.

## Key Gaps (10 found)

1. **POST /invites/{token}/accept** absent from `api-contracts.yaml` v1.0 — release-blocking gap. Frontend and Karim agent have no contract.
2. **No list/revoke/resend invite endpoints** — Admin cannot audit pending invites or cancel mistakes.
3. **HMAC signing unspecified** — algorithm, key source, rotation strategy all undocumented. Token security depends on this.
4. **No AC for email dispatch failure** — behavior when SMTP down is undefined.
5. **No AC for token tampering** — missing security AC (critical for Auth story).
6. **No AC for email mismatch on accept** — missing wrong-user rejection AC.
7. **No AC for deleted workspace edge case** — invite to workspace later deleted.
8. **Email uniqueness scope unclear** — active members only vs active + pending invites.
9. **workspace_invites table schema** not in canonical ERD.
10. **No AC for duplicate membership idempotency** — replay attack vector.

## Critical Questions for PO (block sprint planning)

1. **Does email uniqueness include pending invites, or only active members?** Two admins could invite same email concurrently.
2. **Idempotency behavior when already-accepted invite is re-clicked by removed member?** Return 200 with stale data or 404?
3. **Should inviter's current role affect pending invite validity?** Admin demoted to member after sending invite.

## Technical Questions for Dev

1. HMAC algorithm + key source (workspace-level `invite_secret` column or global `INVITE_SIGNING_KEY`)?
2. Is accept a single DB transaction (token validation + member insert + invite status update)?
3. Email dispatch: Supabase transactional email or custom provider?
4. Will POST /invites/{token}/accept be added to api-contracts.yaml before /project-bootstrap?
5. workspace_invites table schema?

## Blockers

- **[BLOCKER]** Add POST /invites/{token}/accept to api-contracts.yaml
- **[BLOCKER]** Add GET /workspaces/{id}/invites and DELETE /workspaces/{id}/invites/{invite_id} to scope

## Test Coverage Estimate

| Type | Count |
|------|-------|
| Positive | 5 |
| Negative | 11 |
| Boundary | 4 |
| Integration | 3 |
| API | 4 |
| **Total** | **27** |

High count driven by RBAC role matrix (4 roles × invite create + accept) + HMAC token security (tamper/replay/expiry).

## Suggested Story Improvements

1. Add POST /invites/{token}/accept to api-contracts.yaml
2. Add list/revoke/resend invite endpoints to MVP scope
3. Specify HMAC-SHA256 with workspace-level secret
4. Define email dispatch failure behavior (201 + resend affordance)
5. Add security ACs: token tampering, email mismatch, replay
6. Specify email normalization (lowercase + Unicode NFC)
7. Define workspace_invites table schema for /project-bootstrap

_Shift-Left QA refinement — batch session 2026-05-27_
