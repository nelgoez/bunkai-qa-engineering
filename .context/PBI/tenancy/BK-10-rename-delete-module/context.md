# BK-10 — Rename and soft-delete a Module (with cascade)

- **Key**: BK-10
- **Type**: Story
- **Status**: Shift-Left QA
- **Priority**: Medium (6)
- **Labels**: mvp, project-module, wave-1
- **Epic**: EPIC-BK-002 — Project & Module Hierarchy
- **Feature**: FEAT-006 — Module create / rename / move / soft-delete with nesting (depth ≤6)
- **FR**: BK-006 + BK-039
- **Module**: tenancy
- **API**: `PATCH /api/v1/modules/{id}`, `DELETE /api/v1/modules/{id}`, `POST /api/v1/modules/{id}/restore`
- **Entities**: `modules` (rename → slug?, soft-delete → archived_at cascade)
- **Shift-left refinement**: `shift-left-refinement.md` (pre-sprint analysis)

## Acceptance Criteria (original)

Single-sentence Story: "Rename and soft-delete a Module (with cascade)."

## Team Discussion (from comments)

No team discussions found.

## Parent epic

EPIC-BK-002: Project & Module Hierarchy

## Pre-sprint status

Shift-Left refinement: in progress (started 2026-05-27)
