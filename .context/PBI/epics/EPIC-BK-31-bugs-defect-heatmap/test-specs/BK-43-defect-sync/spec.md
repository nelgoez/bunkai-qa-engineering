# BK-43 — TMS-Defect Sync: ATC Specification

## Scope

Automate API-level integration tests for one-way defect sync from Bunkai to an external tracker. Covers defect creation→sync, fire-and-forget on failure, sync-failed states, field mapping, workspace isolation, duplicate prevention, and one-way semantics. UI elements (badge rendering) out of scope — only sync state machine via API.

## ATC Derivation (AC → 1:N)

### AC-1: Automatic sync on defect creation

Given integration enabled → defect filed → sent to external tracker.

| ATC ID | Technique | Description |
|--------|-----------|-------------|
| BK-43-TDS01 | Happy | New defect auto-syncs. POST defect → 201 + sync_status=synced + external_id present |
| BK-43-TDS09 | BVA (update) | Synced defect edited → PATCH triggers re-sync. external_id unchanged, re-synced |
| BK-43-TDS12 | EP + BVA (fields) | Field mapping: severity→priority, module→component, evidence→attachment. All severity classes (critical, major, minor, trivial) map correctly |

### AC-2: Fire-and-forget sync

External tracker unreachable → defect created locally, retried later.

| ATC ID | Technique | Description |
|--------|-----------|-------------|
| BK-43-TDS02 | Error Guessing | External tracker unreachable (connection refused). POST defect → 201 + sync_status=pending. No sync error returned |
| BK-43-TDS03 | State-Transition | Transient failure → auto-retry. pending→failed→retrying→synced. Verify final sync_status=synced |
| BK-43-TDS11 | Error Guessing (429) | Rate limit. External returns 429 → backoff applied → retry succeeds |

### AC-3: Sync-failed state

Persistent failure → sync-failed badge, remains usable.

| ATC ID | Technique | Description |
|--------|-----------|-------------|
| BK-43-TDS04 | State-Transition | Persistent failure. pending→failed (terminal after threshold). GET defect → sync_status=failed |
| BK-43-TDS08 | Error Guessing | Auth failure (401). permanent → retries exhaust → sync_status=failed. No further retries |

### AC-4: External link back to Bunkai

Synced item carries link back to Bunkai.

| ATC ID | Technique | Description |
|--------|-----------|-------------|
| BK-43-TDS14 | Happy | POST defect → response body includes `external_url` field pointing to Bunkai defect |

### AC-5: One-way sync only

No data flows from external tracker back to Bunkai.

| ATC ID | Technique | Description |
|--------|-----------|-------------|
| BK-43-TDS05 | Error Guessing | External item updated → no change in Bunkai defect. GET defect → fields unchanged |
| BK-43-TDS10 | Boundary | Bunkai defect deleted → external item NOT deleted. External still accessible |

### AC-6: Integration not configured

No sync attempted, no sync errors.

| ATC ID | Technique | Description |
|--------|-----------|-------------|
| BK-43-TDS06 | Boundary | Workspace without external tracker config. POST defect → 201 + no sync fields in response. No sync_status, no external_id |

### Risk-beyond-AC

| ATC ID | Risk | Technique | Description |
|--------|------|-----------|-------------|
| BK-43-TDS07 | Duplicate prevention | Error Guessing | Synced defect → re-trigger sync → no duplicate external item. Same external_id returned |
| BK-43-TDS13 | Workspace isolation | EP | Workspace A's defects go to tracker project A, workspace B's to project B. Verify external_id targets correct project |

## State-Transition Model

```
[pending] ──sync_ok──→ [synced]
[pending] ──failure──→ [failed] ──retry──→ [pending] ──sync_ok──→ [synced]
[failed] ──retry_exhausted──→ [failed] (terminal, no auto-retry)
[failed] ──manual_retry──→ [pending] ──sync_ok──→ [synced]
```

Tested via TDS01 (pending→synced), TDS02 (pending→pending on failure), TDS03 (failed→pending→synced), TDS04 (failed terminal), TDS08 (failed terminal with auth).

## EP/BVA Summary

| Field | Partition | Values | ATC |
|-------|-----------|--------|-----|
| severity | 4 classes | critical, major, minor, trivial | TDS12 |
| sync_status | 3 states | synced, pending, failed | TDS01-TDS04 |
| integration | 2 states | configured, not configured | TDS01, TDS06 |
| network | 3 cases | reachable, unreachable, timeout | TDS01, TDS02, TDS11 |
| auth | 2 cases | valid, invalid(permanent) | TDS01, TDS08 |
| workspace | N | unique workspace → unique project | TDS13 |

## Error Guessing Summary

- Network: connection refused (TDS02), DNS failure (TDS02), timeout (TDS02)
- HTTP errors: 429 rate limit (TDS11), 401 auth (TDS08), 5xx server error (TDS03)
- Data: duplicate re-sync (TDS07), field mapping mismatch (TDS12)
- Semantics: reverse sync (TDS05), delete cascade (TDS10)
