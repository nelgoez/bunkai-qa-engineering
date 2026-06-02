# BK-5 Shift-Left Refinement Summary

**Verdict**: Needs Improvement — auth-sensitive Story missing accept endpoint in api-contracts.yaml, no invite list/revoke/resend endpoints.

## Refined Acceptance Criteria

### AC1 — Invite creation by admin/owner

- **1.1** Owner invites valid email+role → 201, HMAC token generated, email dispatched
- **1.2** Admin invites viewer (subordinate role) → 201 (admin ≥ viewer)
- **1.3** Admin invites owner → 403 ROLE_HIERARCHY_VIOLATION
- **1.4** Member (non-admin) invites → 403 FORBIDDEN
- **1.5** Viewer attempts invite → 403
- **1.6** Email already active member → 409 EMAIL_ALREADY_MEMBER
- **1.7** Invalid email format → 400 VALIDATION_ERROR
- **1.8** Empty email → 400
- **1.9** Invalid role → 400
- **1.10** Non-existent workspace → 404

### AC2 — HMAC-signed single-use token

- **2.1** Token embeds workspace_id, email, role, expiry (24h), HMAC-signed
- **2.2** Tampered token (elevated role) → 403 INVITE_TOKEN_INVALID
- **2.3** Expired token (>24h) → 410 INVITE_EXPIRED
- **2.4** Token replay after acceptance → 200 idempotent (existing membership returned)

### AC3 — Invite acceptance flow

- **3.1** Unauthenticated user signs in with matching email → redirect to /login → back to /accept-invite → 200/201 + membership created
- **3.2** Already signed in with matching email → 200, no redirect
- **3.3** Authenticated email ≠ token email → 403 INVITE_EMAIL_MISMATCH
- **3.4** Garbage/malformed token → 404 INVITE_NOT_FOUND

### Edge Cases (NEEDS PO/DEV CONFIRMATION)

- **E1** Two admins invite same email → both pending, first accepted wins
- **E2** Token expiry race → transaction atomicity required
- **E3** Inviter demoted after sending → token is self-contained, invite remains valid
- **E4** Email normalization (lowercase + Unicode NFC) before uniqueness check
- **E5** Revoked invite → 410 (depends on revoke endpoint)
- **E6** User already member → 200 idempotent

## Key Questions

### PO Questions

1. Email uniqueness: active members only, or pending invites too? (Suggested: active members only)
2. Idempotency when re-clicking accepted invite after member removed? (Suggested: 200, don't re-create)
3. Should inviter's current role affect pending invite? (Suggested: No, token is self-contained)

### Dev Questions

1. HMAC algorithm + key source? (HMAC-SHA256, workspace-level secret)
2. Single DB transaction for token validation + membership insert + invite update?
3. Email provider: Supabase transactional or custom?
4. Will POST /invites/{token}/accept be added to api-contracts.yaml? (Currently absent — release-blocking)
5. workspace_invites table schema confirmation needed

### Blocker

- POST /api/v1/invites/{token}/accept NOT in api-contracts.yaml v1.0 — must be added before implementation
- Missing GET /workspaces/{id}/invites and DELETE /workspaces/{id}/invites/{id} (list/revoke)
