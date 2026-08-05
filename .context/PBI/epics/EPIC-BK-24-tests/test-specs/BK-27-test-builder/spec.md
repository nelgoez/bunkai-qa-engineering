# BK-27: TMS-Test Builder — Automation Spec

## Feature: Assemble a Test by chaining ATCs

**API:** `POST /api/v1/tests`
**Headers:** `Idempotency-Key` (optional, UUID string)
**Auth:** PAT with `test:write` scope (member+)

### Request Body
```json
{
  "title": "string (1-200 chars, trimmed, whitespace-only rejected)",
  "atc_ids": ["uuid", ...],
  "workspace_id": "uuid (optional, defaults to session workspace)"
}
```

### Responses
- `201` — Test created. Body: `{ id, title, atc_ids: [{id, position}], workspace_id, created_by, created_at }`
- `400` — Missing Idempotency-Key (when required)
- `409` — Conflict (same Idempotency-Key, different payload)
- `422` — Validation: empty title, empty chain, title too long, etc.
- `404` — One or more ATCs not available (byte-identical for foreign/nonexistent/archived)

## Business Rules (from Jira BK-27)
1. Title required, max 200 chars, whitespace-only rejected
2. Chain must include at least one ATC; duplicates allowed (sequence, not set)
3. Test binds to workspace active at creation; binding immutable
4. Cross-workspace ATC → uniform 404 non-disclosure (INV-3)
5. Idempotency-Key: 24h TTL, same key+user+endpoint → cached response
6. viewer → 403; member+ → allowed
7. Activity log records creation (via RPC)
