## Unified QA Test Results — BK-4 & BK-5 (Staging)

**Date**: 2026-05-28 | **Tester**: Nahuel Gomez | **Env**: https://upexbunkai.vercel.app

### BK-4 — Create Workspace ✅ 9/9 tested

| AC | Scenario | Result |
|----|----------|:---:|
| AC-1 | POST /workspaces {name:"QA Test Workspace", slug:"qa-test-workspace"} → 201, slug derived, caller=owner | ✅ |
| AC-5 | Name too short ("AB") → 400 validation_failed | ✅ |
| AC-5 | Slug too short ("ab") → 400 too_small min:3 | ✅ |
| AC-5 | Empty name → 400 too_small min:1 | ✅ |
| AC-6 | Duplicate slug → 409 "already taken" | ✅ |
| AC-8 | Reserved slug "admin" → 400 "Slug is reserved" | ✅ |
| AC-8 | GET /workspaces → 200, 1 workspace | ✅ |
| AC-8 | GET /workspaces/{id} → 200, correct slug/name | ✅ |
| AC-8 | GET /workspaces/{bad-id} → 404 not_found | ✅ |
| PATCH | Rename to "QA Test Renamed" → 200, persisted | ✅ |

### BK-5 — Invite Teammate ✅ 6/6 tested

| AC | Scenario | Result |
|----|----------|:---:|
| AC-1 | POST /invites (API) → 201, token bk_inv_*, 7d expiry | ✅ |
| AC-1 | Create invite (UI) → 201, clipboard copy | ✅ |
| AC-8 | GET /invites → 200, 1 pending | ✅ |
| AC-12 | Accept with mismatched email → 403 "different email address" | ✅ |
| AC-10 | DELETE /invites/{id} → {ok:true} | ✅ |
| AC-10 | Revoked invite shows in UI as "revoked" | ✅ |

### Known Gaps (not tested)
- BK-5.2: Accept invite (needs second authenticated user with matching email)
- BK-5.5: RBAC non-admin rejection (needs second user)
- BK-5.11: Rotate invite token
- BK-4.11: Transaction atomicity (workspace + owner rollback)
- No workspace deletion endpoint

### Cleanup
- Workspace "QA Test Renamed" (8a2d1ff6-5e00) left on staging (no DELETE endpoint)
- Invite qa-member@bunkai.io revoked
