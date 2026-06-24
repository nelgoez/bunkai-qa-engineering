# BK-148 — Session Context

## Ticket
BK-148: TMS-Project Environments | List, add, rename and remove environments
Epic: BK-7 (Project & Module Hierarchy)
Status: Ready For QA
Story Points: 1

## Summary
CRUD for project environments used as run targets. No shift-left done (full planning). No mockup but live-first per design approach comment (2026-06-20). Relates to BK-34 (Start manual run, QA Approved) — environments are selected when starting a run.

## 9 ACs
1. List environments of a project (stable order)
2. Add unique environment name
3. Trim surrounding whitespace on add
4. Reject duplicate name (case-insensitive?)
5. Reject empty / whitespace-only name
6. Reject name > 50 chars
7. Rename existing environment
8. Reject rename collision with existing name
9. Remove unused environment
10. Block removal when runs reference it (with count message)

## Design notes
- No mockup, live-first against project settings shell
- Per Ely's comment: "A dedicated mockup is NOT a hard blocker; the live UI is the fidelity source"
- PR merged 2026-06-20

## Test approach
- Primary surface: API (CRUD endpoints for project environments)
- Secondary: UI validation if browser testing is viable
- DB cross-validation: verify row changes in environments table

## Open questions
- Endpoint structure? Expecting /api/v1/projects/{id}/environments
- Case sensitivity on name uniqueness?
- Max length 50 chars per AC
- Runs referencing guard: soft-reject or hard transaction check?
