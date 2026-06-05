# Test Session Memory — BK-5

**TMS Modality**: jira-native
**ATP field**: customfield_10120
**ATR field**: customfield_10284 (not writable via MCP — use comment fallback)
**Workspace ID**: aed86386-2ed8-424e-934b-ca7a0ef6af37
**Owner PAT**: bk_pat_REDACTED
**Owner email**: qa-headless@bunkai.io
**Owner user_id**: 0cdfea29-cbf7-4762-b4aa-f6d152492f43
**Env**: staging

## Environment Override
WEB_URL_OVERRIDE: https://staging-upexbunkai.vercel.app
API_URL_OVERRIDE: https://staging-upexbunkai.vercel.app/api/v1

## Invite Test Data
- **Valid email 1**: qa-invitee-1@bunkai.io (no account)
- **Valid email 2**: qa-invitee-2@bunkai.io (no account)
- **Existing member**: qa-headless@bunkai.io (workspace owner)
- **Invalid email**: "not-an-email"
- **Bad workspace**: "00000000-0000-0000-0000-000000000000"

## Stage State
- Session Start: completed 2026-06-05
- Stage 1 (Planning): in progress
- Stage 2 (Execution): pending
- Stage 3 (Reporting): pending
