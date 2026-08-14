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

// BK-43 (TMS-Defect Sync) was aborted and re-scoped into BK-372 ("Send a newly
// filed defect to Jira") and BK-373 ("Recover a failed sync"), both still in
// Backlog. The /defects API is not deployed yet, so these ATCs 404. Skipped
// until BK-372/BK-373 ship; TC keys BK-234/240/241/246/247 are now re-parented
// to BK-372/BK-373 in Jira.
test.describe.skip('Defect Sync (BK-372/BK-373) — /defects not deployed', { tag: ['@defect-sync', '@critical'] }, () => {
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
