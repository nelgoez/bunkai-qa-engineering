import type { DefectCreatePayload, Severity } from '@schemas/defect.types';

import { faker } from '@faker-js/faker';
import { expect, test } from '@TestFixture';

function buildDefectPayload(overrides?: Partial<DefectCreatePayload>): DefectCreatePayload {
  return {
    title: `Defect ${faker.lorem.words(3)}`,
    description: faker.lorem.sentence(),
    severity: 'major' as Severity,
    module_id: faker.string.uuid(),
    ...overrides,
  };
}

test.describe('BK-43: TMS-Defect Sync', { tag: ['@defect-sync', '@critical'] }, () => {
  test('BK-43-TDS01: New defect auto-syncs when integration enabled', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'critical' });
    const [response, defect] = await api.defects.createDefectSyncs(payload);

    expect(response.status()).toBe(201);
    expect(defect.sync_status).toBe('synced');
    expect(defect.external_id).toBeDefined();
  });

  test('BK-43-TDS02: Fire-and-forget sync when external tracker unreachable', async ({ api }) => {
    const payload = buildDefectPayload();
    const [response] = await api.defects.createDefectFireAndForget(payload);

    expect(response.status()).toBe(201);
  });

  test('BK-43-TDS03: Failed sync auto-retries and eventually succeeds', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'minor' });
    const [response, defect] = await api.defects.createDefectAutoRetries(payload);

    expect(response.status()).toBe(201);
    expect(defect.sync_status).toBe('synced');
  });

  test('BK-43-TDS04: Sync-failed state shown on persistent failure', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'trivial' });
    const [response, defect] = await api.defects.getDefectSyncFailed(payload);

    expect(response.status()).toBe(201);
    expect(defect.sync_status).toBe('failed');
  });

  test('BK-43-TDS05: External tracker update does not flow back to Bunkai', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'major' });
    const [response, defect] = await api.defects.externalUpdateDoesNotFlowBack(payload);

    expect(response.status()).toBe(201);
    expect(defect.id).toBeDefined();
  });

  test('BK-43-TDS06: No sync attempted when integration not configured', async ({ api }) => {
    const payload = buildDefectPayload();
    const [response] = await api.defects.createDefectNoIntegration(payload);

    expect(response.status()).toBe(201);
  });

  test('BK-43-TDS07: Re-syncing does not create duplicate external items', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'critical' });
    const [response, defect] = await api.defects.reSyncDoesNotDuplicate(payload);

    expect(response.status()).toBe(201);
    expect(defect.external_id).toBeDefined();
  });

  test('BK-43-TDS08: Permanent auth failure stops retries', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'major' });
    const [response, defect] = await api.defects.syncFailsOnPermanentAuth(payload);

    expect(response.status()).toBe(201);
    expect(defect.sync_status).toBe('failed');
  });

  test('BK-43-TDS09: Synced defect update triggers re-sync', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'critical' });
    const [, defect] = await api.defects.createDefectSyncs(payload);

    const [response, updated] = await api.defects.updateDefectReSyncs(defect.id, {
      severity: 'major',
    });

    expect(response.status()).toBe(200);
    expect(updated.external_id).toBeDefined();
  });

  test('BK-43-TDS10: Deleting a synced defect does not remove external item', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'minor' });
    const [, defect] = await api.defects.createDefectSyncs(payload);

    const [response] = await api.defects.deleteDoesNotRemoveExternal(defect.id);
    expect(response.ok()).toBeTruthy();
  });

  test('BK-43-TDS11: Rate limit backoff recovers and syncs', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'major' });
    const [response, defect] = await api.defects.rateLimitBackoff(payload);

    expect(response.status()).toBe(201);
    expect(defect.sync_status).toBe('synced');
  });

  test('BK-43-TDS12: Field mapping accuracy across severity levels', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'critical' });
    const [response, defect] = await api.defects.fieldMappingAccuracy(payload);

    expect(response.status()).toBe(201);
    expect(defect.sync_status).toBe('synced');
  });

  test('BK-43-TDS13: Workspace isolation keeps defects in correct projects', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'major' });
    const [response, defect] = await api.defects.workspaceIsolation(payload);

    expect(response.status()).toBe(201);
    expect(defect.workspace_id).toBeDefined();
  });

  test('BK-43-TDS14: Synced defect carries external link back to Bunkai', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'critical' });
    const [response, defect] = await api.defects.createDefectCarriesExternalLink(payload);

    expect(response.status()).toBe(201);
    expect(defect.external_url).toBeDefined();
    expect(defect.external_url).toContain('http');
  });
});
