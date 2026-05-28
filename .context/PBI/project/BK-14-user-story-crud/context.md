# BK-14: User Story CRUD anchored to Module (Markdown body, optional Jira external_id)

**Ticket:** BK-14 | **Module:** project | **Status:** Shift-Left QA | **Sprint:** n/a — pre-sprint

## Acceptance Criteria (original)

- US belongs to exactly one Module (mandatory `module_id`)
- `body` stored in Markdown format
- Optional `external_id` for Jira sync (`[A-Z]+-\d+` pattern)
- Soft-delete support (`archived_at`)
- `position` field for ordering within Module
- Markdown body sanitization before render
- `external_id` uniqueness per Project

## Team Discussion (from comments)

No team discussions found.

## Parent epic

EPIC-BK-003: User Stories & Acceptance Criteria

## Pre-sprint status

Shift-Left refinement: in progress (started 2026-05-27)
