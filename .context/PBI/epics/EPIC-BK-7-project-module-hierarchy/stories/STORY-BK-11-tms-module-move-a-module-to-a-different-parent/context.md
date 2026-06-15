# BK-11 — Session Context

## Source
- Jira: https://upexgalaxy69.atlassian.net/browse/BK-11
- PR: https://github.com/upex-galaxy/upex-bunkai-tms/pull/11 (merged to staging, commit 8fd44e2)
- Epic: BK-7 (Project & Module Hierarchy)
- Status: Ready For QA
- Assigned Dev: Micaela Virga García
- Story Points: 3

## Implementation
- Extends `PATCH /api/v1/modules/{id}` with `parent_module_id` field
- SQL function `bunkai_move_module` (migration 0015): SECURITY DEFINER, atomic re-parent + path rebuild
- Guards: cycle detection via materialized path, depth ≤ 6, same-project, no-op short-circuit
- UI: `<MoveModuleDialog />` with valid-targets picker, pre-flight client check

## Key technical details
- Error codes: `move_cycle` (422), `depth_exceeded` (422), `parent_invalid` (422), `module_slug_duplicate` (409), `not_a_member` (403), `module_not_found` (404)
- Path rebuild: re-bases every descendant's path via SQL `UPDATE ... SET path = new_prefix || substring(path from ...)`
- Destination picker excludes: module itself, descendants, current parent, targets exceeding depth 6

## QA focus areas
- Move leaf under new parent → breadcrumbs update
- Move parent-with-subtree → whole branch carries
- Move back to project root
- Cycle: move onto own descendant → blocked
- Depth: boundary at 6 levels (6 ok, 7 blocked)
- No-op: same parent → 200, zero writes
- Viewer/non-member → 403
- Duplicate slug at destination → 409

## Final Status

**Result:** PASSED
**Workflow Complete:** 2026-06-15
**Next:** QA Approved (manual transition required — user nahuelgomez.cti@gmail.com lacks transition permission)
