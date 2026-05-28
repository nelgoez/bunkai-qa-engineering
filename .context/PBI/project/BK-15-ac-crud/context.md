# BK-15: Acceptance Criterion CRUD with position rebalance and ready_to_test gating
**Ticket:** BK-15 | **Module:** project | **Status:** Backlog | **Sprint:** n/a — pre-sprint

## Acceptance Criteria (original)
- AC belongs to exactly one User Story
- AC has: description (Markdown), position (integer), ready_to_test (boolean)
- Position auto-rebalances on insert/delete
- ready_to_test gating: US can't be "Ready For Dev" if any AC has ready_to_test=false
- `POST /api/v1/user-stories/{id}/acceptance-criteria` → 201
- `GET /api/v1/user-stories/{id}/acceptance-criteria` → list ordered by position
- `PATCH /api/v1/acceptance-criteria/{id}` → update description/position/ready_to_test
- `DELETE /api/v1/acceptance-criteria/{id}` → soft-delete + rebalance positions
- `POST /api/v1/acceptance-criteria/{id}/toggle-ready` → flip ready_to_test

## Team Discussion (from comments)
No team discussions found.

## Parent epic
EPIC-BK-003: User Stories & Acceptance Criteria

## Pre-sprint status
Shift-Left refinement: in progress (started 2026-05-27)
