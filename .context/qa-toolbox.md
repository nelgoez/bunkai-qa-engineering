# QA Toolbox — BK Project Quick Reference

> Generated: 2026-06-09 · Session: BK-98 + BK-96 sprint-testing
> Purpose: Single-file reference for Jira, auth, tools, formatting — no searching.

---

## Jira Credentials & Fields

| Item | Value |
|------|-------|
| Atlassian URL | `https://upexgalaxy69.atlassian.net` |
| Project Key | `BK` (Bunkai TMS) |
| My display name | Nahuel Gomez |
| My account ID | `609005c5f0db130069a64294` |
| ATLASSIAN_API_TOKEN | `.env` → `ATLASSIAN_API_TOKEN` |
| Sprint board | Board 7 — `https://upexgalaxy69.atlassian.net/jira/software/c/projects/BK/boards/7` |

### Jira Custom Fields (jira-native TMS)

| Slug | Field ID | Name | Used for |
|------|----------|------|----------|
| `acceptance_test_plan` | `customfield_10120` | ATP | Sprint-testing Stage 1 planning |
| `acceptance_test_results` | `customfield_10147` | ATR | Sprint-testing Stage 3 reporting |
| `acceptance_criteria` | `customfield_10063` | AC (Gherkin) | Story ACs |
| `actual_result` | `customfield_10056` | Actual Result | Bug report |
| `expected_result` | `customfield_10055` | Expected Result | Bug report |
| `severity` | `customfield_10047` | Severity | Bug classification |
| `root_cause` | `customfield_10062` | Root Cause | Bug post-mortem |
| `evidence` | `customfield_10064` | Evidence | Bug evidence |
| `test_environment` | `customfield_10115` | Test Env | Bug env |

### Story Transitions (most used)

| Slug | ID | From | To |
|------|----|------|-----|
| `start_testing` | 9 | Ready For QA (10100) | In Test (10134) |
| `qa_sign_off` | 10 | In Test (10134) | QA Approved (10113) |
| `defect_reported` | 11 | In Test | BLOCKED |

### Bug Transitions

| Slug | ID | From | To |
|------|----|------|-----|
| `retest_passed` | 41 | Ready For QA (10100) | Closed (6) |
| `re_open` | — | any | Open |

---

## Environment & Auth

| Item | Value |
|------|-------|
| Staging URL | `https://staging-upexbunkai.vercel.app` |
| Staging API | `https://staging-upexbunkai.vercel.app/api/v1` |
| Test user email | `qa-headless@bunkai.io` |
| Test user password | (in `.env` → `STAGING_USER_PASSWORD`) |
| PAT | `STAGING_USER_PAT` (in `.env`, prefix `bk_pat_`) |
| PAT works for | `/api/v1/me`, `/api/v1/workspaces`, `/api/v1/atcs` |
| **⚠️ Browser auth** | `qa-headless@bunkai.io` NOT in Supabase Auth — magic-link fails. Use `testing-api@vexaakarii.resend.app` (Supabase-registered) |

### Magic-link flow
1. `POST /api/v1/auth/magic-link` → `{email, next?}` → sends Supabase OTP email
2. User clicks link → `GET /auth/callback?code=SUPABASE_CODE&next=/projects`
3. Backend: `exchangeCodeForSession(code)` → sets Supabase cookie → redirects to app
4. `magic_link_tokens` table: audit trail only (UUID, not OTP code)

### DBHub (read-only)
| Var | Value |
|-----|-------|
| User | `qa_inspector_ro` |
| DB | PostgreSQL 17 (Supabase pooler) |
| Access | Schema `public` (18 tables), schema `auth` blocked by RLS |

---

## API Endpoints (Bunkai Staging)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/v1/me` | 200 | User + workspaces ✅ |
| GET | `/api/v1/workspaces` | 200 | Workspace list ✅ |
| GET | `/api/v1/workspaces/{id}` | 200 | Workspace detail ✅ |
| POST | `/api/v1/auth/magic-link` | 200 | Send magic link ✅ |
| GET | `/auth/callback?code=...` | 302 | Supabase OTP exchange ✅ |
| GET | `/api/v1/projects` | 404 | Not yet implemented |
| GET | `/api/v1/modules` | 404 | Not yet implemented |
| GET | `/api/v1/atcs` | 405 | Method not allowed (POST only?) |
| POST | `/api/v1/atcs` | 422 | Needs valid module_id, user_story_id, ac_ids |
| PATCH | `/api/v1/atcs/{id}` | 200/409/412 | Uses X-If-Match header (BK-96 fix) |
| GET | `/api/v1/user-stories` | 404 | Not yet implemented |

---

## ADF Formatting (Jira Rich Text)

| Tool | Path |
|------|------|
| MD→ADF converter | `.claude/skills/acli/scripts/md-to-adf.ts` |
| Reference ticket | BK-91 (showcases ADF capabilities) |

Usage:
```ts
import { mdToAdf } from '.claude/skills/acli/scripts/md-to-adf.ts';
const adf = mdToAdf(markdownString);
// adf = { type: "doc", version: 1, content: [...] }
```

**Covers:** headings, bold/italic, tables, bullet/ordered lists, code blocks, panels, expand, links, blockquotes, horizontal rules, emoji, status lozenges, mentions.
**Out of scope:** images/media, nested expands in tables.

### How Jira fields handle content
- `jira_update_issue` with `fields` parameter → markdown string → Jira renders it
- `jira_add_comment` → markdown string → Jira renders as wiki-format
- `jira_transition_issue` with `comment` → requires ADF (not markdown) — post QA comment separately then transition without comment
- Custom text fields (ATP/ATR) → plain text or markdown — Jira wiki-format rendering applies
- **⚠️** Descriptions get reformatted by Jira (markdown → Jira wiki) on every write via `jira_update_issue`

---

## Image Attachments

Upload via `jira_update_issue` with `attachments` parameter (absolute path):
```json
{ "fields": "{}", "attachments": "D:\\path\\to\\screenshot.png" }
```

Reference in comments: `![label](filename.png)` — Jira converts to `!filename.png!` wiki format.

Playwright screenshots save to `./bk98-*.png` by default. Use absolute paths for attachments.

---

## Ticket Assignment (Jira Cloud)

**Direct REST** (Atlassian MCP `jira_update_issue` doesn't reliably set assignee):
```bash
PUT https://upexgalaxy69.atlassian.net/rest/api/3/issue/{KEY}/assignee
Body: {"accountId": "609005c5f0db130069a64294"}
```
Unassign: `{"accountId": null}`

Account IDs found via `GET /rest/api/3/myself`.

---

## Session Management

| Item | Path |
|------|------|
| Session dir | `.session/sprint-testing/{KEY}/` |
| Plan | `plan.md` |
| Progress | `progress.md` |
| Archive | `.session/.archive/{YYYY-MM-DD}-sprint-testing-{KEY}/` |
| PBI data | `.context/PBI/epics/EPIC-BK-{N}-.../stories/STORY-BK-{N}-.../` |
| Synced Jira | `story.md`, `acceptance-criteria.md`, `comments.md` (read-only) |
| Hand-authored | `context.md`, `test-session-memory.md` |

---

## Commands Quickref

| Command | Purpose |
|---------|---------|
| `bun run jira:sync-issues get {KEY} --include-comments` | Fetch ticket to PBI folder |
| `bun run kata:manifest` | Regenerate KATA component registry |
| `bun run jira:check` | Validate Jira field/workflow setup |
| `bun run vars:check` | Validate project variables |
| `bun run pw:install` | Install Playwright browsers |

---

## Known Gaps

1. **Test data:** QA user has 12 workspaces but zero modules/stories/ATCs — can't create or PATCH ATCs in any workspace. Seed QA workspace with test fixtures.
2. **Supabase Auth:** `qa-headless@bunkai.io` not registered in Supabase — blocks browser login. PAT works for API.
3. **API maturity:** Many endpoints return 404 (GET /projects, /modules, /user-stories). Only `/me`, `/workspaces`, `/atcs`, `/auth/*` are live.
4. **Example files** (`ExamplePage.ts`, `ExampleApi.ts`, etc.) still present — framework cleanup incomplete. Doesn't block sprint-testing.
5. **config/variables.ts** points to `https://dojo.upexgalaxy.com` (Dojo), not Bunkai staging. `api-login` script won't work for Bunkai.
