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
  test('BK-234: Auto-sync — new defect syncs and carries external ID', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'critical' });
    const [response, defect] = await api.defects.createDefectSyncs(payload);

    expect(response.status()).toBe(201);
    expect(defect.sync_status).toBe('synced');
    expect(defect.external_id).toBeDefined();
  });

  test('BK-240: Re-sync idempotency — no duplicate external items', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'critical' });
    const [response, defect] = await api.defects.reSyncDoesNotDuplicate(payload);

    expect(response.status()).toBe(201);
    expect(defect.external_id).toBeDefined();
  });

  test('BK-241: Auth boundary — permanent auth failure stops retries', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'major' });
    const [response, defect] = await api.defects.syncFailsOnPermanentAuth(payload);

    expect(response.status()).toBe(201);
    expect(defect.sync_status).toBe('failed');
  });

  test('BK-246: Workspace isolation — defects scoped to correct workspace', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'major' });
    const [response, defect] = await api.defects.workspaceIsolation(payload);

    expect(response.status()).toBe(201);
    expect(defect.workspace_id).toBeDefined();
  });

  test('BK-247: External link — synced defect carries link back to Bunkai', async ({ api }) => {
    const payload = buildDefectPayload({ severity: 'critical' });
    const [response, defect] = await api.defects.createDefectCarriesExternalLink(payload);

    expect(response.status()).toBe(201);
    expect(defect.external_url).toBeDefined();
    expect(defect.external_url).toContain('http');
  });
});
