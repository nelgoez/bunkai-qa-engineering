# KATA / VCR Alignment Audit — bunkai-qa-engineering

> Cross-referenced against: agentic-qa-boilerplate (KATA canonical), UPEX FLUJOS DE TRABAJO step 3 (VCR), ATLAS Model, IQL Methodology.
> Date: 2026-08-14 · Author: Nahuel Gomez (QA)

## 1. Parentage

`bunkai-qa-engineering` is a direct child of `agentic-qa-boilerplate` (Playwright + KATA + Allure, ~955 files), unlike `agentic-diplo-track-sys` which descends from `agentic-dev-boilerplate`. This makes the QA-side KATA architecture fully inherited rather than retrofitted.

## 2. KATA Architecture Compliance

| Layer / convention | Canonical (`test-automation/references/kata-architecture.md`) | Status |
|---|---|---|
| Layer 1 — TestContext | `tests/components/TestContext.ts` | OK |
| Layer 2 — ApiBase / UiBase | `tests/components/api/ApiBase.ts` + `tests/components/ui/UiBase.ts` | OK |
| Layer 3 — Domain components | 7 API + LoginPage UI (`@atc` lives here) | OK |
| Layer 3.5 — Steps | `tests/components/steps/` | PARTIAL — dir exists, empty |
| Layer 4 — Fixtures | TestFixture / ApiFixture / UiFixture (DI, lazy) | OK |
| `@atc` / `@step` decorators | `tests/utils/decorators.ts` | OK |
| kata-manifest.json (source of truth) | husky `kata:manifest:check` enforced | OK |
| Inline-locator rule | no `locators/*.ts`; locators inline | OK |
| Import aliases | `@api/@ui/@steps/@utils/@data/@schemas/@variables/@TestFixture/…` | OK (minor drift: `@/*` catch-all vs `@config/*`/`@components/*`) |
| Tuple returns | `[response, body, payload]` per verb | OK |
| jiraSync (TMS sync) | field-based, assignee-scoped | OK |
| KataReporter + global teardown | `tests/KataReporter.ts` + `tests/teardown/global.teardown.ts` | OK |
| Trifuerza (UI/API/DB) | API + UI + DB-persistence tests | OK |

## 3. VCR (Value / Cost / Risk) — DROPPED (2026-08-21)

Originally implemented this pass (2026-08-14) as a leftover-field sync, then **removed by PO decision**.

Context: Elys (PO) confirmed `customfield_10113` (💊 VCR Estimation) is **not** part of the boilerplate or KATA — it is a leftover field from the UPEX workspace / prior workflows, with no owner.

Rollback performed (2026-08-21):
1. `tests/utils/jiraSync.ts` — removed the best-effort write of `customfield_10113`.
2. `tests/utils/decorators.ts` — removed `VcrScore` + `vcr?` from `AtcOptions`/`AtcResult`, plus the write-only `story?`/`feature?` fields added in the same pass (no consumer).
3. **24 ATCs** stripped of `vcr: { value, cost, risk }` (WorkspacesApi, ProjectsApi, UserStoriesApi, TestsApi, AuthApi, LoginPage).
4. `.agents/jira-fields.json` — removed `vcr_estimation` entry.

Outstanding (not QA-owned): the Jira-side custom field `customfield_10113` itself remains in the workspace. Its deletion is a Jira-admin / PO call — repo code no longer references it.

## 4. Other alignment findings

- **Traceability links (`is tested by`)** — not created. Nahuel's account lacks the project-level `Link Issues` permission (`No Link Issue Permission`). Expected to be handled by the Bunkai-TMS dev CI pipeline once coverage is approved. The `test` link type exists in the workspace (id 10006).
- **Defect Sync re-parenting** — BK-43 aborted → sliced into BK-371/372/373 (successors). 13 TCs re-parented (summaries `BK-372-TDSxx` / `BK-373-TDSxx`); BK-242 (TDS09) retired to DEPRECATED; DefectsApi suite skipped until `/defects` ships.

## 5. Certification scorecard (QA-side dimensions only)

| Dimension | Max | Score | Notes |
|---|---|---|---|
| KATA Architecture Compliance | 15 | 13 | Layers + manifest + aliases + tuples OK; Steps layer empty; minor alias drift |
| IQL Early-Game (Prevention) | 15 | 12 | Context + shift-left OK; BDD ACs partial |
| IQL Mid-Game (Detection) | 25 | 22 | Trifuerza + @atc + CI OK; POM coverage limited to LoginPage |
| CI/CD & DevOps | 10 | 8 | GitHub Actions + Allure + TMS sync wired |
| Documentation & Context | 10 | 9 | .context/ + skills + reports present |
| **TOTAL (QA-side)** | **75** | **64** | ~85% |

## 6. Remediation backlog

1. **Jira admin (PO call):** delete `customfield_10113` (💊 VCR Estimation) from the workspace — leftover field, no longer referenced by repo code (see §3).
2. **Jira admin:** grant `Link Issues` to QA → unblocks `is tested by` traceability (24 TCs + 7 OAuth TCs).
3. Populate or remove `tests/components/steps/` (Layer 3.5).
4. (Optional) align aliases to canonical `@config/*` / `@components/*`.
