# BK-9 — Create Modules (with nested sub-modules) inside a Project

- **Key**: BK-9
- **Type**: Story
- **Status**: Shift-Left QA
- **Priority**: Medium
- **Score**: MEDIUM 6
- **Labels**: mvp, project-module, wave-1
- **Epic**: EPIC-BK-002 — Project & Module Hierarchy
- **Feature**: FEAT-006 — Module create / rename / move / soft-delete with nesting (depth ≤ 6)
- **FR**: BK-006
- **Module**: tenancy
- **API**: `POST /api/v1/projects/{id}/modules`, `GET /api/v1/projects/{id}/modules`
- **Entities**: `modules` (tree via `parent_module_id`, materialized `path`)
- **Shift-left refinement**: `shift-left-refinement.md` (pre-sprint analysis done 2026-05-27)
