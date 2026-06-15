BK-11 TEST RESULTS
Tested: 2026-06-15
Environment: Staging (https://staging-upexbunkai.vercel.app)
Tester: Nahuel Gomez (qa-headless@bunkai.io)
Result: PASSED (14/18)

SUMMARY
  Completed full ATP execution for BK-11 (TMS-Module | Move a module to a different parent).
  14 of 18 outlines passed. 0 failures, 1 blocked (TC-12: no viewer user), 3 observations.
  Core ACs (1-5) all verified. Cycle detection, depth enforcement, and subtree carry work correctly.

TEST CASES
  TC-01: Move leaf module under another ... PASSED
  TC-02: Move parent with subtree ... PASSED
  TC-03: Descendant breadcrumbs after ancestor move ... PASSED
  TC-04: Move onto descendant (cycle) ... PASSED
  TC-05: Self-move (cycle) ... PASSED
  TC-06: Depth exceeded (>6) ... PASSED
  TC-07: Depth boundary (=6) ... PASSED
  TC-08: Move nested to root ... PASSED
  TC-09: No-op (same parent) ... PASSED
  TC-10: Archived source module ... PASSED
  TC-11: Unauthenticated caller ... PASSED
  TC-12: Viewer 403 ... BLOCKED
  TC-13: Non-existent UUID ... PASSED
  TC-14: Cross-project move ... PASSED
  TC-15: Duplicate slug at destination ... PASSED
  TC-16: Invalid UUID format ... OBSERVATION
  TC-17: Concurrent move ... OBSERVATION
  TC-18: Root module no-op ... PASSED

TEST DATA
  Module: Payment (root) - moved under Checkout
  Module: Refunds (sub-module) - subtree carry verified
  Module: ModuleA/B/C/D - 4-level descendant path rebase verified
  Module: L1-L6 - depth boundary verified
  Target: Checkout, Target, X (various targets for different TCs)

BUGS FOUND
  None

OBSERVATIONS
  1. TC-16: Invalid UUID returns 422 validation_failed instead of 400 bad_request (Zod validation behaviors) — minor spec discrepancy
  2. TC-17: Concurrent move — basic test done, both concurrent requests complete. P2, not fully provable without race-condition harness
  3. Modules table lacks `updated_at` column — cannot verify "zero DB writes" via timestamp for TC-09 no-op. Verified by path unchanged instead.

RECOMMENDATIONS
  - Add `updated_at` column to modules table for future no-op/idempotency verification
  - Provision a viewer-role test user for auth/permission regression coverage
  - Consider adding `GET /api/v1/modules/{id}` endpoint for direct state verification after PATCH
