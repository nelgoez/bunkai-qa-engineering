# BK-4 Test Session Memory

## Environment

- **Active env**: staging
- **WEB_URL**: https://staging-upexbunkai.vercel.app
- **API_URL**: https://staging-upexbunkai.vercel.app/api/v1
- **DB_MCP**: dbhub (qa_inspector_ro)
- **API_MCP**: openapi
- **Curl flag**: --ssl-no-revoke (Windows schannel CRL workaround)

## TMS modality

- **Modality**: jira-native
- **ATP storage**: Story custom field (`🧪 Acceptance Test Results (ATR)`)
- **ATR storage**: Story custom field + QA comment fallback
- **Traceability**: Story-linked (no Xray Test/TestPlan/TestExecution issues)

## Credentials

- **STAGING_USER_EMAIL**: qa-headless@bunkai.io
- **STAGING_USER_PASSWORD**: Bunkai-QA-Headless-2025!
- **STAGING_USER_PAT**: bk_pat_ZBOc7TnyHEdA.DXzR212tezyGiGNXIGgpRUd6Nh2Es34
- **PAT scopes**: atc:read, atc:write, run:execute, workspace:admin

## Ticket state

- **Key**: BK-4
- **Status at start**: Ready For QA
- **Assignee**: Ely (dev) — QA ownership during In Test
- **Labels**: mvp, shift-left-2026-05-27, shift-left-reviewed, tenancy, wave-1
- **Shift-Left short-circuit**: Phases 1-3 of ATP planning skipped

## Stage state

| Stage | Status | Artifacts |
|-------|--------|-----------|
| Session Start | completed | context.md, test-session-memory.md, plan.md, progress.md |
| Stage 1 - Planning | pending | ATP, TCs |
| Stage 2 - Execution | pending | Evidence, TC statuses |
| Stage 3 - Reporting | pending | ATR, QA comment, transition |
