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

## 3. VCR (Value / Cost / Risk) — implemented this pass

Upstream reference: `agentic-diplo-track-sys/.claude/skills/sprint-development/references/vcr-framework.md` (UPEX FLUJOS DE TRABAJO step 3). Dimensions 1-5:

- **value** — business risk covered (1=cosmetic, 5=critical path)
- **cost** — cost to automate/maintain (1=trivial, 5=prohibitive)
- **risk** — likelihood the scenario breaks (1=never changes, 5=highly volatile)

Changes landed:

1. `tests/utils/decorators.ts` — added `VcrScore { value, cost, risk }` + `vcr?` (+ `story?`/`feature?`) to `AtcOptions`; `vcr` persisted in `AtcResult` → NDJSON → `reports/atc_results.json`.
2. **24 ATCs annotated** with `@atc('BK-xxx', { vcr: { value, cost, risk } })` across WorkspacesApi, ProjectsApi, UserStoriesApi, TestsApi, AuthApi, LoginPage.
3. `tests/utils/jiraSync.ts` — best-effort write of `customfield_10113` (💊 VCR Estimation) as `V5 · C2 · R3`.

**Blocked (Jira config):** `customfield_10113` is **not on the Test edit screen** (editmeta confirms it absent on both Test and Story), so the field write returns 400. The sync logs a warning and skips — the main field write (test_status / to_be_automated / qa_framework / test_environment) is unaffected. VCR is captured in code + report; Jira reflection unblocks once an admin places the field on the Test screen.

## 4. Other alignment findings

- **Traceability links (`is tested by`)** — not created. Nahuel's account lacks the project-level `Link Issues` permission (`No Link Issue Permission`). Expected to be handled by the Bunkai-TMS dev CI pipeline once coverage is approved. The `test` link type exists in the workspace (id 10006).
- **Defect Sync re-parenting** — BK-43 aborted → sliced into BK-371/372/373 (successors). 13 TCs re-parented (summaries `BK-372-TDSxx` / `BK-373-TDSxx`); BK-242 (TDS09) retired to DEPRECATED; DefectsApi suite skipped until `/defects` ships.

## 5. Certification scorecard (QA-side dimensions only)

| Dimension | Max | Score | Notes |
|---|---|---|---|
| KATA Architecture Compliance | 15 | 13 | Layers + manifest + aliases + tuples OK; Steps layer empty; minor alias drift |
| IQL Early-Game (Prevention) | 15 | 12 | Context + shift-left OK; VCR now annotated; BDD ACs partial |
| IQL Mid-Game (Detection) | 25 | 22 | Trifuerza + @atc + CI OK; POM coverage limited to LoginPage |
| CI/CD & DevOps | 10 | 8 | GitHub Actions + Allure + TMS sync wired |
| Documentation & Context | 10 | 9 | .context/ + skills + reports present |
| **TOTAL (QA-side)** | **75** | **64** | ~85% |

## 6. Remediation backlog

1. **Jira admin:** add `customfield_10113` (💊 VCR Estimation) to the Test edit screen → unblocks VCR field sync.
2. **Jira admin:** grant `Link Issues` to QA → unblocks `is tested by` traceability (24 TCs + 7 OAuth TCs).
3. Populate or remove `tests/components/steps/` (Layer 3.5).
4. (Optional) align aliases to canonical `@config/*` / `@components/*`.
