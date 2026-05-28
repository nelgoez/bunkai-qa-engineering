# BK-17 — Async one-way Jira import by JQL

**Status**: Shift-Left QA (pre-sprint refinement)
**Module**: project
**Epic**: EPIC-BK-003 (User Stories & Acceptance Criteria)
**Feature**: FEAT-011 — One-way Jira import (JQL → US + auto-extracted AC bullets)
**FR**: FR-009 ({{PROJECT_KEY}}-009)
**Primary persona**: Mateo (QA Lead)
**Score**: CRITICAL 18

**Sources**:
- `.context/business/business-data-map.md` §2 (imports entity, Discovery Gap G1), §3 Flow 1 step 5, §4.6 imports status state machine, §5 Async Workers
- `.context/business/business-feature-map.md` §2.3 FEAT-009/011/013, §3 CRUD matrix
- `.context/business/business-api-map.md` §4.12 POST /imports/jira, GET /imports/{import_job_id}, §3 Journey 1 step 5
- `.context/SRS/architecture-specs.md` (canonical ERD)
- `.claude/skills/sprint-testing/references/acceptance-test-planning.md`
- `.claude/skills/shift-left-testing/references/atp-draft-template.md`
