# BK-14 — Session Context

**Ticket:** BK-14 | **Title:** TMS-US | Manage user stories anchored to a module
**Status:** Ready For QA | **Epic:** BK-12 (User Stories & Acceptance Criteria)
**Assignee:** Samuel Amonzabel | **Tester:** Nahuel Gomez

## Story

As a Senior QA Engineer, I want to create, view, edit and remove User Stories anchored to a Module, each with a Markdown description and an optional link to a Jira issue, so that test work always sits next to its product area.

## ACs (6)

1. Create a User Story under a Module (title + Markdown description)
2. Title shorter than minimum (3 chars) rejected
3. Link a User Story to an upstream Jira issue (BK-42)
4. Malformed Jira key rejected ("not a key")
5. Same Jira key cannot be linked to two Stories in a Project
6. Removing a User Story archives it (soft-delete)

## Prior work

- Ely merged PR#13 (8a19b1f) to staging on 4 Jun, marked Ready For QA
- Nahuel ran 5 API automation tests on 30 Jun — all PASSED
- API tests covered: create, title validation, Jira key link, soft-delete, duplicate key

## Tech notes

- DB: `user_stories` table (id, module_id FK, title, description, external_id, external_url, status, deleted_at)
- API: POST /api/v1/modules/{moduleId}/user-stories, GET/PATCH/DELETE /api/v1/user-stories/{id}
- RLS: workspace membership-gated via module → project → workspace_members
- Title: 3-200 chars, Jira key: LETTERS-NUMBER regex, immutable once set
- Description: Markdown ≤ 50KB via BK-16 editor
- Soft-delete: sets deleted_at, filtered by default

## Testing strategy (Balanced)

API layer: 8 tests covering validation boundaries, RLS, idempotency, soft-delete
UI layer: 4 tests covering forms, Markdown preview, Jira key linking UX, error display
