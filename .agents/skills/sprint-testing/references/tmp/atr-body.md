BK-8 TEST RESULTS
Tested: 2026-06-15
Environment: Staging
Tester: nahuelgomez.cti@gmail.com
Result: PASSED (All tests passing)

SUMMARY
  BK-8 Create Project — retest after fixes for 3 defects
  All 3 bugs verified as FIXED. Full regression PASSED.

RETEST RESULTS
| Bug | Description | Verdict |
|-----|-------------|---------|
| BK-51 | Reserved project slugs not rejected | VERIFIED — 422 slug_reserved |
| BK-52 | Project detail not workspace-scoped | VERIFIED — workspace-scoped |
| BK-53 | Non-Latin names rejected | VERIFIED — 201 with fallback slug |

REGRESSION
  Full ATP suite: PASSED
  AC-1 through AC-11: PASSED

TEST DATA
  Workspace: bc75c0d4-6d92-4d3f-a92f-f41e4b1774fe
  Reserved slugs tested: api, new, settings, admin, null, docs
  Multi-workspace test: WS1 (qa-bk8…) / WS2 (qa-bk8b…)
  Non-Latin names: 日本語プロジェクト, Проект Бункай

BUGS VERIFIED
  BK-51 — Major — VERIFIED
  BK-52 — Major — VERIFIED
  BK-53 — Minor — VERIFIED

OBSERVATIONS
  All 3 fixes confirmed in staging. No regression found.
  PR #36 (merged) addressed all 3 defects.

RECOMMENDATIONS
  Close bugs. Move BK-8 to QA Approved.
