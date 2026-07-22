# BK-43 — TMS-Defect Sync: Automation Plan

## Target Files

| File | Purpose |
|------|---------|
| `tests/components/api/DefectsApi.ts` | New API component — Defect CRUD + sync operations |
| `tests/integration/defects/defect-sync.test.ts` | Integration test file — ATC execution |

## Fixture Selection

`api` (API-only fixture from `@TestFixture`). No browser needed — all ATCs verify sync state machine via REST.

## New Component: DefectsApi

Extends `ApiBase`. Follows `AtcsApi` pattern exactly.

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/defects` | Create defect (triggers sync if integration enabled) |
| GET | `/defects/:id` | Read defect (sync_status, external_id, external_url) |
| PATCH | `/defects/:id` | Update defect (may trigger re-sync) |
| POST | `/defects/:id/retry-sync` | Manual retry of failed sync |
| DELETE | `/defects/:id` | Delete defect |

### Helper Methods (decorated @step)

- `getDefectById(id)` — GET /defects/:id
- `getSyncStatus(id)` — GET /defects/:id → extract sync sync_status

### ATC Methods (decorated @atc)

| Method | ATC ID | Action | Fixed Assertions |
|--------|--------|--------|------------------|
| `createDefectSyncs` | BK-43-TDS01 | POST defect → verify sync | 201, body.sync_status=synced, body.external_id defined |
| `createDefectFireAndForget` | BK-43-TDS02 | POST with tracker unreachable | 201, body.sync_status=pending |
| `createDefectAutoRetries` | BK-43-TDS03 | POST → failure → auto-retry succeeds | sync_status transitions to synced |
| `getDefectSyncFailed` | BK-43-TDS04 | POST → persistent failure | 200, sync_status=failed, sync_attempts >= threshold |
| `externalUpdateDoesNotFlowBack` | BK-43-TDS05 | External changes → GET defect unchanged | All Bunkai fields unchanged |
| `createDefectNoIntegration` | BK-43-TDS06 | POST without integration config | 201, no sync fields |
| `reSyncDoesNotDuplicate` | BK-43-TDS07 | POST → sync → re-trigger sync | Same external_id as first sync |
| `syncFailsOnPermanentAuth` | BK-43-TDS08 | POST with bad credentials | sync_status=failed, retries exhausted |
| `updateDefectReSyncs` | BK-43-TDS09 | PATCH synced defect → triggers re-sync | sync_status=synced, external_id unchanged |
| `deleteDoesNotRemoveExternal` | BK-43-TDS10 | DELETE synced defect → external persists | External tracker still has item |
| `rateLimitBackoff` | BK-43-TDS11 | POST → 429 → backoff → retry succeeds | Final sync_status=synced after backoff |
| `fieldMappingAccuracy` | BK-43-TDS12 | POST with all severity levels | external item shows correct priority mapping per severity |
| `workspaceIsolation` | BK-43-TDS13 | Two workspaces → two tracker projects | Each defect lands in correct target project |
| `createDefectCarriesExternalLink` | BK-43-TDS14 | POST defect → verify external_url | 201, body.external_url contains Bunkai defect URL |

### Type Schema (new file: `api/schemas/defect.types.ts`)

```typescript
export type Severity = 'critical' | 'major' | 'minor' | 'trivial';
export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface DefectCreatePayload {
  title: string;
  description: string;
  severity: Severity;
  module_id: string;
  evidence?: string[];
}

export interface DefectResponse {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  sync_status: SyncStatus;
  external_id?: string;
  external_url?: string;
  sync_attempts?: number;
  // ... other defect fields
}

export interface DefectUpdatePayload {
  title?: string;
  description?: string;
  severity?: Severity;
}
```

## Registration

Add to `tests/components/ApiFixture.ts`:

```typescript
import { DefectsApi } from '@api/DefectsApi';

// In class body:
readonly defects: DefectsApi;

// In constructor:
this.defects = new DefectsApi(options);

// In setAuthToken/clearAuthToken:
this.defects.setAuthToken(token);
this.defects.clearAuthToken();
```

## Test File Structure

`tests/integration/defects/defect-sync.test.ts`:

- `describe` block: `'BK-43: TMS-Defect Sync'` with tags `['@api', '@defect-sync', '@critical']`
- One `test` block per ATC (14 total)
- Helper factory `buildDefectPayload(overrides)` for test data
- Mock/stub external tracker endpoint in test setup (network intercept or test double)

## ATC Count

14 ATCs: TDS01-TDS14.

## Dependencies

- `AuthApi` must authenticate first (or use pre-loaded PAT from `api-state.json`)
- Workspace with integration config required for TDS01, TDS03, TDS07, TDS09, TDS10, TDS11, TDS12, TDS13, TDS14
- Workspace without integration config required for TDS06
- Second workspace required for TDS13
- External tracker mock/stub that can simulate: success, connection refused, 429, 401, timeout

## Open Questions

1. Is there a dedicated `/retry-sync` endpoint, or is retry triggered by PATCH on the defect?
2. What external tracker fields does severity→priority, module→component mapping target (Jira priority ID, custom field)?
3. Is the external URL returned inline in the DefectResponse or must it be fetched separately per sync result?
4. Are there rate-limit headers we can observe for backoff verification (Retry-After, X-RateLimit-Reset)?
5. Does the workspace isolation config use a separate external_tracker_project_id per workspace?
6. Can test workspaces be provisioned via API or do we need pre-seeded test data?
