# BK-4 Session Context

## Session meta

- **Started**: 2026-06-05
- **Mode**: Single-ticket User Story
- **Env**: Staging (`https://staging-upexbunkai.vercel.app`)
- **Auth**: Headless PAT (`qa-headless@bunkai.io`, PAT `bk_pat_ZBOc7TnyHEdA`)
- **Modality**: Jira-native (ATP/ATR as Story custom fields + comments)
- **Automation tool**: Playwright MCP (UI) + curl (API) + DBHub (DB)

## Story summary

Authenticated user creates a Workspace via `POST /api/v1/workspaces`. Slug auto-derived from name (lowercase, kebab-case). Creator auto-enrolled as owner. Validations: name length (3-60 chars), alphanumeric requirement, slug uniqueness, reserved slug list.

## Shift-Left notes

- `shift-left-reviewed` label dated 2026-05-27 (<30 days) — Stage 1 short-circuits phases 1-3.
- Extensive AC refinement in comments (Luis Eduardo, Ciprian Romero, Maibeth Vega).
- Open grey zones: slug global vs per-owner uniqueness, event emission synchronicity, Unicode normalization.
- Dev annotation: route at `app/api/v1/workspaces/route.ts`, zod validation, DB transaction.

## Dependencies

- Blocks: BK-5, BK-6, EPIC-BK-2
- Blocked by: BK-2 or BK-3 (auth/sign-in)
- PAT user has no workspaces — clean state for testing

## Open questions

1. Slug uniqueness scope: global or per-owner? (ZG-1 from Luis Eduardo ACs)
2. Event emission: synchronous (blocking) or async (best-effort)?
3. Reserved slug list: exact values?
4. Unicode normalization: NFKD or ASCII-only?
