import type { APIError, ATCCreatePayload } from '@schemas/atc.types';
import type { TestCreatePayload } from '@schemas/tests.types';

import { DataFactory } from '@DataFactory';
import { config, expect, test } from '@TestFixture';

const getPat = () => config.testUser.pat ?? '';

function buildAtcPayload(overrides?: Partial<ATCCreatePayload>): ATCCreatePayload {
  return {
    title: `ATC for test builder ${Date.now()}`,
    module_id: config.seed.module.id,
    user_story_id: config.seed.userStory.id,
    acceptance_criterion_ids: [config.seed.acceptanceCriterion.id],
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
    atc_ids: [DataFactory.SENTINEL.defaultAtc],
    workspace_id: config.seed.workspace.id,
    ...overrides,
  };
}

test.describe('BK-27: Test Builder API', { tag: ['@api', '@tests', '@critical'] }, () => {
  // ============================================
  // TC01 — Happy path: Create test with ATC chain
  // ============================================
  test('BK-305: POST /tests creates a test chaining 3 ATCs', async ({ api }) => {
    api.setAuthToken(getPat());

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
    expect(testEntity.steps).toHaveLength(3);
    expect(testEntity.steps[0].atc_id).toBe(atc1.id);
    expect(testEntity.steps[0].position).toBe(1);
    expect(testEntity.steps[1].atc_id).toBe(atc2.id);
    expect(testEntity.steps[1].position).toBe(2);
    expect(testEntity.steps[2].atc_id).toBe(atc3.id);
    expect(testEntity.steps[2].position).toBe(3);
    expect(testEntity.workspace_id).toBe(config.seed.workspace.id);
    expect(testEntity.created_by).toBeDefined();
    expect(testEntity.created_at).toBeDefined();
  });

  // ============================================
  // TC02 — Duplicate ATC in chain
  // ============================================
  test('BK-305: POST /tests allows duplicate ATC IDs in chain', async ({ api }) => {
    api.setAuthToken(getPat());

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
    expect(testEntity.steps).toHaveLength(2);
    expect(testEntity.steps[0].atc_id).toBe(atc.id);
    expect(testEntity.steps[0].position).toBe(1);
    expect(testEntity.steps[1].atc_id).toBe(atc.id);
    expect(testEntity.steps[1].position).toBe(2);
  });

  // ============================================
  // TC03 — Empty ATC chain → 422
  // ============================================
  test('BK-306: POST /tests rejects empty atc_ids with 422', async ({ api }) => {
    api.setAuthToken(getPat());

    const [response, errBody] = await api.tests.createTestEmptyChain(
      buildTestPayload({ atc_ids: [] }),
    );

    expect(response.status()).toBe(422);
    expect(errBody.error?.code).toBeDefined();
  });

  // ============================================
  // TC04 — Invalid title → 422
  // ============================================
  test('BK-307: POST /tests rejects whitespace-only title with 422', async ({ api }) => {
    api.setAuthToken(getPat());

    const [response, errBody] = await api.tests.createTestWithInvalidTitle(
      buildTestPayload({ title: '   ' }),
    );

    expect(response.status()).toBe(422);
    expect(errBody.error?.code).toBeDefined();
  });

  test('BK-307: POST /tests rejects 201-character title with 422', async ({ api }) => {
    api.setAuthToken(getPat());

    const [response, errBody] = await api.tests.createTestWithInvalidTitle(
      buildTestPayload({ title: 'A'.repeat(201) }),
    );

    expect(response.status()).toBe(422);
    expect(errBody.error?.code).toBeDefined();
  });

  // ============================================
  // TC05 — Foreign/non-existent ATC → 404
  // ============================================
  test('BK-308: POST /tests returns 404 for non-existent ATC IDs', async ({ api }) => {
    api.setAuthToken(getPat());

    const fakeAtcId = DataFactory.SENTINEL.fake;

    const [response, errBody] = await api.tests.createTestForeignAtc(
      buildTestPayload({ atc_ids: [fakeAtcId] }),
    );

    expect(response.status()).toBe(404);
    expect(errBody.error?.code).toBe('not_found');
  });

  // ============================================
  // TC06 — Idempotency: same key → one test
  // ============================================
  test('BK-309: POST /tests with Idempotency-Key returns same test on retry', async ({ api }) => {
    api.setAuthToken(getPat());

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
  test('BK-310: POST /tests rejects unauthenticated request with 401', async ({ api }) => {
    const [response] = await api.tests.createTestUnauthenticated(
      buildTestPayload(),
    );

    expect(response.status()).toBe(401);
  });

  // ============================================
  // TC08 — Missing title → 422
  // ============================================
  test('BK-307: POST /tests rejects empty title with 422', async ({ api }) => {
    api.setAuthToken(getPat());

    const [response, errBody] = await api.apiPOST<APIError, TestCreatePayload>('/tests', buildTestPayload({ title: '' }));

    expect(response.status()).toBe(422);
    expect(errBody.error?.code).toBeDefined();
  });
});
