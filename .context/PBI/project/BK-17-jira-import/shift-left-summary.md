# Shift-Left Refinement: BK-17 — Async one-way Jira import by JQL

**Status**: Refined — Awaiting PO Estimation | **Score**: CRITICAL 18 | **Refined**: 2026-05-27

## Verdict: Needs Improvement

High integration complexity (Jira REST, ADF parsing, async reliability) with critical gaps in crash recovery and heuristic specification.

## Key Gaps (5 found)

1. **No crash recovery specification** — Worker crashes mid-job (e.g., 7/20 chunks). No checkpoint/resume mechanism. CRITICAL 18 feature with 20+ chunks MUST define failure recovery.
2. **No AC for Jira credential failure** — Worker picks up queued job with expired/invalid PAT, behavior undefined.
3. **ADF→Markdown node support list undocumented** — No contract for what ADF nodes are supported. Tables, emoji, expand macros, panels — which are converted vs stripped?
4. **Jira custom fields silently discarded** — Epic link, story points, labels, fixVersions, issue type, priority have no mapping to Bunkai entities.
5. **Concurrent imports on same project behavior unspecified** — Race on Jira rate limits and idempotency.

## Key Ambiguities (8 found)

1. Auto-chunking mechanism: pagination-based or JQL partitioning?
2. Inbox Module parent placement in tree (root level?)
3. Idempotency key composition (BR1 says "Project + Jira key" — exact format?)
4. AC heuristic extraction algorithm (heading detection, bullet parsing, stop condition)
5. Component→Module match strategy (exact/partial, case-sensitive, multi-component)
6. created_count vs updated_count vs skipped_count definitions
7. pg_cron frequency and worker race-condition handling
8. Jira key case normalization (lowercase from external tool?)

## Critical Questions for PO (block sprint planning)

1. **Crash recovery strategy?** Option A: mark failed, user re-submits, idempotency prevents duplicates. Option B: resume from last chunk on next cron tick.
2. **Concurrent imports on same project?** Serialize (409 Conflict) or allow (idempotency handles overlaps)?
3. **Oversized descriptions (>50KB)?** Truncate with marker, reject entire issue, or store in overflow column?
4. **Jira custom field mapping?** Phase 1: store as jsonb `jira_metadata`. Phase 2: promote to first-class columns?

## Blockers

- Define worker crash recovery semantics before sprint planning
- Document ADF node type support list (what converts, what strips, what errors)
- Specify AC extraction heuristic with pseudocode
- Resolve concurrent-import behavior
- Confirm Inbox Module placement in tree

## Test Coverage Estimate

| Type | Count |
|------|-------|
| Positive | 15 |
| Negative | 12 |
| Boundary | 8 |
| Integration | 6 |
| API | 5 |
| **Total** | **46** |

High count reflects CRITICAL 18 score + heavy integration surface (Jira REST pagination, ADF parsing, rate-limit backoff, async worker lifecycle).

## Top Suggested Improvements

1. Add crash recovery AC with timeout sweeper (stuck running → failed after 5min)
2. Add credential-failure AC (status=failed, error=JIRA_AUTH_FAILED)
3. Document ADF node support list with fallback behavior
4. Add `jira_metadata` jsonb column to `user_stories` for custom field capture
5. Serialize concurrent imports per project (409 Conflict)
6. Specify truncation behavior for >50KB descriptions

_Shift-Left QA refinement — batch session 2026-05-27_
