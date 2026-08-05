import type { APIError, ATCCreatePayload } from '@schemas/atc.types';
import type { TestCreatePayload } from '@schemas/tests.types';

import { config, expect, test } from '@TestFixture';

const TEST_DATA = {
  projectId: '1a6fdae6-8b0c-47bb-b444-0e2563deab4b',
  userStoryId: '0f4a6636-d845-4459-9262-ebae2657ca62',
  moduleId: '37aa2ba9-47eb-4e45-ad2d-085c1ee36ef4',
  acId: '96587255-b61d-4f8b-9cf7-a09f945c4bb1',
  workspaceId: '1a6fdae6-8b0c-47bb-b444-0e2563deab4b',
  get pat(): string {
    return config.testUser.pat ?? '';
  },
};

function buildAtcPayload(overrides?: Partial<ATCCreatePayload>): ATCCreatePayload {
  return {
    title: `ATC for test builder ${Date.now()}`,
    module_id: TEST_DATA.moduleId,
    user_story_id: TEST_DATA.userStoryId,
    acceptance_criterion_ids: [TEST_DATA.acId],
    layer: 'API',
    steps: [{ position: 1, content: 'Step 1' }, { position: 2, content: 'Step 2' }],
    assertions: [],
    tags: [],
    ...overrides,
  };
}

function buildTestPayload(overrides?: Partial<TestCreatePayload>): TestCreatePayload {
  return {
    title: `Test from ATC chain ${Date.now()}`,
    atc_ids: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
    workspace_id: TEST_DATA.workspaceId,
    ...overrides,
  };
}

test.describe('BK-27: Test Builder API', { tag: ['@api', '@tests', '@critical'] }, () => {
  // ============================================
  // TC01 — Happy path: Create test with ATC chain
  // ============================================
  test('BK-xxx: POST /tests creates a test chaining 3 ATCs', async ({ api }) => {
    api.setAuthToken(TEST_DATA.pat);

    const ts = Date.now();
    const [, atc1] = await api.atcs.createAtcSuccessfully(
      buildAtcPayload({ title: `ATC-1 for test ${ts}` }),
    );
    const [, atc2] = await api.atcs.createAtcSuccessfully(
      buildAtcPayload({ title: `ATC-2 for test ${ts}` }),
    );
    const [, atc3] = await api.atcs.createAtcSuccessfully(
      buildAtcPayload({ title: `ATC-3 for test ${ts}` }),
    );

    const [response, testEntity] = await api.tests.createTestSuccessfully(
      buildTestPayload({
        title: `Test from chain ${ts}`,
        atc_ids: [atc1.id, atc2.id, atc3.id],
      }),
    );

    expect(response.status()).toBe(201);
    expect(testEntity.id).toBeDefined();
    expect(testEntity.title).toBe(`Test from chain ${ts}`);
    expect(testEntity.atc_ids).toHaveLength(3);
    expect(testEntity.atc_ids[0].id).toBe(atc1.id);
    expect(testEntity.atc_ids[0].position).toBe(1);
    expect(testEntity.atc_ids[1].id).toBe(atc2.id);
    expect(testEntity.atc_ids[1].position).toBe(2);
    expect(testEntity.atc_ids[2].id).toBe(atc3.id);
    expect(testEntity.atc_ids[2].position).toBe(3);
    expect(testEntity.workspace_id).toBe(TEST_DATA.workspaceId);
    expect(testEntity.created_by).toBeDefined();
    expect(testEntity.created_at).toBeDefined();
  });

  // ============================================
  // TC02 — Duplicate ATC in chain
  // ============================================
  test('BK-xxx: POST /tests allows duplicate ATC IDs in chain', async ({ api }) => {
    api.setAuthToken(TEST_DATA.pat);

    const ts = Date.now();
    const [, atc] = await api.atcs.createAtcSuccessfully(
      buildAtcPayload({ title: `ATC dup for test ${ts}` }),
    );

    const [response, testEntity] = await api.tests.createTestSuccessfully(
      buildTestPayload({
        title: `Test duplicate ATC ${ts}`,
        atc_ids: [atc.id, atc.id],
      }),
    );

    expect(response.status()).toBe(201);
    expect(testEntity.atc_ids).toHaveLength(2);
    expect(testEntity.atc_ids[0].id).toBe(atc.id);
    expect(testEntity.atc_ids[0].position).toBe(1);
    expect(testEntity.atc_ids[1].id).toBe(atc.id);
    expect(testEntity.atc_ids[1].position).toBe(2);
  });

  // ============================================
  // TC03 — Empty ATC chain → 422
  // ============================================
  test('BK-xxx: POST /tests rejects empty atc_ids with 422', async ({ api }) => {
    api.setAuthToken(TEST_DATA.pat);

    const [response, errBody] = await api.tests.createTestEmptyChain(
      buildTestPayload({ atc_ids: [] }),
    );

    expect(response.status()).toBe(422);
    expect(errBody.error?.code).toBeDefined();
  });

  // ============================================
  // TC04 — Invalid title → 422
  // ============================================
  test('BK-xxx: POST /tests rejects whitespace-only title with 422', async ({ api }) => {
    api.setAuthToken(TEST_DATA.pat);

    const [response, errBody] = await api.tests.createTestWithInvalidTitle(
      buildTestPayload({ title: '   ' }),
    );

    expect(response.status()).toBe(422);
    expect(errBody.error?.code).toBeDefined();
  });

  test('BK-xxx: POST /tests rejects 201-character title with 422', async ({ api }) => {
    api.setAuthToken(TEST_DATA.pat);

    const [response, errBody] = await api.tests.createTestWithInvalidTitle(
      buildTestPayload({ title: 'A'.repeat(201) }),
    );

    expect(response.status()).toBe(422);
    expect(errBody.error?.code).toBeDefined();
  });

  // ============================================
  // TC05 — Foreign/non-existent ATC → 404
  // ============================================
  test('BK-xxx: POST /tests returns 404 for non-existent ATC IDs', async ({ api }) => {
    api.setAuthToken(TEST_DATA.pat);

    const fakeAtcId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    const [response, errBody] = await api.tests.createTestForeignAtc(
      buildTestPayload({ atc_ids: [fakeAtcId] }),
    );

    expect(response.status()).toBe(404);
    expect(errBody.error?.code).toBe('not_found');
  });

  // ============================================
  // TC06 — Idempotency: same key → one test
  // ============================================
  test('BK-xxx: POST /tests with Idempotency-Key returns same test on retry', async ({ api }) => {
    api.setAuthToken(TEST_DATA.pat);

    const ts = Date.now();
    const [, atc] = await api.atcs.createAtcSuccessfully(
      buildAtcPayload({ title: `ATC idempotency ${ts}` }),
    );

    const idempotencyKey = `test-idem-${ts}`;
    const payload = buildTestPayload({
      title: `Test idempotency ${ts}`,
      atc_ids: [atc.id],
    });

    const [res1, test1] = await api.tests.createTestIdempotentRetry(payload, idempotencyKey);
    expect(res1.status()).toBe(201);

    const [res2, test2] = await api.tests.createTestIdempotentRetry(payload, idempotencyKey);
    expect(res2.status()).toBe(201);
    expect(test2.id).toBe(test1.id);
  });

  // ============================================
  // TC07 — Unauthenticated → 401
  // ============================================
  test('BK-xxx: POST /tests rejects unauthenticated request with 401', async ({ api }) => {
    const [response] = await api.tests.createTestUnauthenticated(
      buildTestPayload(),
    );

    expect(response.status()).toBe(401);
  });

  // ============================================
  // TC08 — Missing title → 422
  // ============================================
  test('BK-xxx: POST /tests rejects empty title with 422', async ({ api }) => {
    api.setAuthToken(TEST_DATA.pat);

    const [response, errBody] = await api.apiPOST<APIError, TestCreatePayload>('/tests', buildTestPayload({ title: '' }));

    expect(response.status()).toBe(422);
    expect(errBody.error?.code).toBeDefined();
  });
});
