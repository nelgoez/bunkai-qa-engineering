# BK-11 — Move a Module to a different parent (with cycle-detection + path rebuild)

- **Key**: BK-11
- **Type**: Story
- **Status**: Shift-Left QA
- **Priority**: HIGH (12)
- **Score**: HIGH 12
- **Labels**: mvp, project-module, wave-1, tree-algorithm
- **Epic**: EPIC-BK-002 — Project & Module Hierarchy
- **Feature**: FEAT-006 — Module create / rename / move / soft-delete with nesting (depth ≤ 6)
- **FR**: BK-006
- **Module**: tenancy
- **API**: `POST /api/v1/modules/{id}/move` with `{parent_module_id, position?}` → 200
- **Entities**: `modules` (tree via `parent_module_id`, materialized `path`, `depth`, `position`, `children_count`)
- **Shift-left refinement**: `shift-left-refinement.md` (pre-sprint analysis done 2026-05-27)
