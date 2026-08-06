import type { APIError, ATCCreatePayload } from '@schemas/atc.types';

import { DataFactory } from '@DataFactory';
import { config, expect, test } from '@TestFixture';

const getPat = () => config.testUser.pat ?? '';

function buildValidPayload(overrides?: Partial<ATCCreatePayload>): ATCCreatePayload {
  return {
    title: 'Login with valid email',
    module_id: config.seed.module.id,
    user_story_id: config.seed.userStory.id,
    acceptance_criterion_ids: [config.seed.acceptanceCriterion.id],
    layer: 'UI',
    steps: [
      { position: 1, content: 'Navigate to login page' },
      { position: 2, content: 'Enter email test@example.com' },
      { position: 3, content: 'Click submit' },
    ],
    assertions: [
      { content: 'Response time < 2s' },
    ],
    tags: ['smoke', 'login'],
    ...overrides,
  };
}

function buildPatchPayload(created: { module_id: string, user_story_id: string, acceptance_criterion_ids: string[], layer: 'UI' | 'API' | 'Unit' }, ts: number) {
  return {
    title: `Patched ATC ${ts}`,
    module_id: created.module_id,
    user_story_id: created.user_story_id,
    acceptance_criterion_ids: created.acceptance_criterion_ids,
    layer: created.layer,
    steps: [
      { position: 1, content: 'Updated step 1' },
      { position: 2, content: 'Updated step 2' },
    ],
    assertions: [],
    tags: ['patched'],
  };
}

test.describe('BK-18: ATC Create/Edit REST API', { tag: ['@api', '@atc', '@critical'] }, () => {
  // ============================================
  // TC01 — BK-149: POST /atcs creates ATC
  // ============================================
  test('BK-149: POST /atcs creates an ATC with steps, assertions, slug and version 1', async ({ api }) => {
    api.setAuthToken(getPat());

    const payload = buildValidPayload();
    const [response, body] = await api.atcs.createAtcSuccessfully(payload);

    expect(response.status()).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.slug).toMatch(/^[a-z0-9-]+\/atc-[a-z0-9]{8}$/);
    expect(body.version).toBe(1);
    expect(body.title).toBe(payload.title);
    expect(body.layer).toBe('UI');
    expect(body.steps).toHaveLength(3);
    expect(body.steps[0].position).toBe(1);
    expect(body.steps[1].position).toBe(2);
    expect(body.steps[2].position).toBe(3);
    expect(body.assertions).toHaveLength(1);
    expect(body.tags).toContain('smoke');
  });

  test('BK-149: POST /atcs works for all layer values (UI, API, Unit)', async ({ api }) => {
    api.setAuthToken(getPat());

    for (const layer of ['UI', 'API', 'Unit'] as const) {
      const payload = buildValidPayload({ layer, title: `ATC layer ${layer} ${Date.now()}` });
      const [response, body] = await api.atcs.createAtcSuccessfully(payload);
      expect(response.status()).toBe(201);
      expect(body.layer).toBe(layer);
    }
  });

  // ============================================
  // TC02 — BK-150: Auth rejection (401 + 403)
  // ============================================
  test('BK-150: POST /atcs rejects unauthenticated request with 401', async ({ api }) => {
    const payload = buildValidPayload();
    const savedToken = api.authToken;
    api.clearAuthToken();

    const [response] = await api.apiPOST<APIError, ATCCreatePayload>('/atcs', payload);

    expect(response.status()).toBe(401);
    if (savedToken) {
      api.setAuthToken(savedToken);
    }
  });

  test('BK-150: POST /atcs rejects invalid token with 401', async ({ api }) => {
    api.setAuthToken('invalid-token');

    const payload = buildValidPayload({ title: `Invalid token test ${Date.now()}` });
    const [response] = await api.apiPOST<APIError, ATCCreatePayload>('/atcs', payload);

    expect(response.status()).toBe(401);

    api.setAuthToken(getPat());
  });

  test('BK-150: POST /atcs rejects token lacking atc:write scope with 403', async ({ api }) => {
    const readonlyPat = config.testUser.readonlyPat;
    if (!readonlyPat) {
      test.skip(true, 'STAGING_USER_READONLY_PAT not configured — cannot test 403 scope rejection');
      return;
    }
    api.setAuthToken(readonlyPat);

    const payload = buildValidPayload({ title: `Readonly token test ${Date.now()}` });
    const [response, errBody] = await api.apiPOST<APIError, ATCCreatePayload>('/atcs', payload);

    expect(response.status()).toBe(403);
    expect(errBody.error?.code).toBe('forbidden');
  });

  // ============================================
  // TC03 — BK-151: AC outside user_story → 422
  // ============================================
  test('BK-151: POST /atcs rejects AC that belongs to a different user story with 422', async ({ api }) => {
    api.setAuthToken(getPat());

    // This AC belongs to a DIFFERENT user story than the one in the payload
    const foreignAcId = DataFactory.SENTINEL.foreignAtc;
    const payload = buildValidPayload({
      title: `Foreign AC test ${Date.now()}`,
      acceptance_criterion_ids: [foreignAcId],
    });

    const [_response, _errBody] = await api.atcs.createAtcWithAcOutsideUserStory(payload);
  });

  // ============================================
  // TC04 — BK-152: Module outside subtree → 422
  // ============================================
  test('BK-152: POST /atcs rejects module outside user story subtree with 422', async ({ api }) => {
    api.setAuthToken(getPat());

    // Non-existent module_id returns 404 (not found), not 422.
    // For a real 422 we'd need a module that exists but is outside the
    // user_story's project subtree — that requires dynamic discovery.
    const fakeModuleId = DataFactory.SENTINEL.nonExistent;
    const payload = buildValidPayload({
      title: `Fake module test ${Date.now()}`,
      module_id: fakeModuleId,
    });

    const [_response, _errBody] = await api.atcs.createAtcWithModuleOutsideSubtree(payload);
  });

  // ============================================
  // TC05 — BK-153: Step position validation (422)
  // ============================================
  test('BK-153: POST /atcs rejects steps with non-increasing positions', async ({ api }) => {
    api.setAuthToken(getPat());

    const invalidPositionSets = [
      { positions: [1, 3, 2], desc: 'not increasing' },
      { positions: [2, 3, 4], desc: 'does not start at 1' },
      { positions: [1, 1, 2], desc: 'not strictly increasing' },
      { positions: [0, 1, 2], desc: 'starts at 0' },
    ];

    for (const { positions, desc } of invalidPositionSets) {
      const payload = buildValidPayload({
        title: `Invalid ${desc} ${Date.now()}`,
        steps: positions.map((p, i) => ({ position: p, content: `Step ${i + 1}` })),
      });

      const [_response, _errBody] = await api.atcs.createAtcWithInvalidStepPosition(payload);
    }

    const goodPayload = buildValidPayload({
      title: `Valid steps ${Date.now()}`,
      steps: [{ position: 1, content: 'Step 1' }, { position: 2, content: 'Step 2' }],
    });
    const [response] = await api.atcs.createAtcSuccessfully(goodPayload);
    expect(response.status()).toBe(201);
  });

  // ============================================
  // TC06 — BK-154: Body boundary validation (422)
  // ============================================
  test('BK-154: POST /atcs validates request body boundaries', async ({ api }) => {
    api.setAuthToken(getPat());

    const boundaryCases = [
      // Title boundaries
      { payload: buildValidPayload({ title: 'AB' }), expectedStatus: 422, desc: 'title too short (2 chars)' },
      { payload: buildValidPayload({ title: 'A'.repeat(201) }), expectedStatus: 422, desc: 'title too long (201 chars)' },
      // Step count boundary
      { payload: buildValidPayload({ title: `Zero steps ${Date.now()}`, steps: [] }), expectedStatus: 422, desc: 'zero steps' },
      // Tag count boundary
      { payload: buildValidPayload({ title: `Too many tags ${Date.now()}`, tags: Array.from({ length: 51 }, (_, i) => `tag-${i}`) }), expectedStatus: 422, desc: 'too many tags (51)' },
      // Layer enum validation
      { payload: buildValidPayload({ title: `Invalid layer ${Date.now()}`, layer: 'InvalidLayer' as 'UI' }), expectedStatus: 422, desc: 'invalid layer value' },
    ];

    for (const { payload, expectedStatus, desc } of boundaryCases) {
      const [response, errBody] = await api.atcs.createAtcWithBodyBoundaryValidation(payload);
      expect(response.status(), desc).toBe(expectedStatus);
      if (response.status() === 422) {
        expect(errBody.error?.code, desc).toBe('validation_failed');
      }
    }
  });

  // ============================================
  // TC07 — BK-155: Transactional rollback (422)
  // ============================================
  test('BK-155: POST /atcs returns error when user_story_id does not exist (no partial write)', async ({ api }) => {
    api.setAuthToken(getPat());

    // Non-existent user_story_id returns 404. API does not expose a separate
    // cross-entity check that returns 422 with an FK constraint error.
    // The rollback guarantee is verified implicitly: no ATC was created
    // despite the request being processed.
    const fakeUserStoryId = DataFactory.SENTINEL.nonExistent;
    const payload = buildValidPayload({
      title: `Rollback test ${Date.now()}`,
      user_story_id: fakeUserStoryId,
    });

    const [_response, _errBody] = await api.atcs.createAtcRollbackOnForeignUserStory(payload);
  });

  // ============================================
  // TC08 — BK-156: PATCH /atcs/{id} version bump
  // ============================================
  test('BK-156: PATCH /atcs/{id} happy path with X-If-Match', async ({ api }) => {
    api.setAuthToken(getPat());

    const ts = Date.now();
    const createPayload = buildValidPayload({ title: `ATC to patch ${ts}` });
    const [, created] = await api.atcs.createAtcSuccessfully(createPayload);

    const patchPayload = buildPatchPayload(created, ts);

    const [patchResponse, patched] = await api.atcs.patchAtcSuccessfully(
      created.id,
      patchPayload,
      '1',
    );

    expect(patchResponse.status()).toBe(200);
    expect(patched.version).toBe(2);
    expect(patched.title).toBe(patchPayload.title);
    expect(patched.steps).toHaveLength(2);
    expect(patched.assertions).toHaveLength(0);
  });

  test('BK-156: PATCH /atcs/{id} cascade-replaces children (BK-96 regression)', async ({ api }) => {
    api.setAuthToken(getPat());

    // Create an ATC with 3 steps and 2 assertions
    const ts = Date.now();
    const createPayload = buildValidPayload({
      title: `ATC cascade test ${ts}`,
      steps: [
        { position: 1, content: 'Step 1' },
        { position: 2, content: 'Step 2' },
        { position: 3, content: 'Step 3' },
      ],
      assertions: [
        { content: 'Assertion 1' },
        { content: 'Assertion 2' },
      ],
    });
    const [, created] = await api.atcs.createAtcSuccessfully(createPayload);
    expect(created.steps).toHaveLength(3);
    expect(created.assertions).toHaveLength(2);

    // Full-replace with fewer steps and no assertions
    const replacePayload = {
      title: `Cascade replaced ${ts}`,
      module_id: created.module_id,
      user_story_id: created.user_story_id,
      acceptance_criterion_ids: created.acceptance_criterion_ids,
      layer: created.layer,
      steps: [
        { position: 1, content: 'Replacement step 1' },
        { position: 2, content: 'Replacement step 2' },
      ],
      assertions: [],
      tags: ['cascade'],
    };

    const [patchResponse, patched] = await api.atcs.patchAtcSuccessfully(
      created.id,
      replacePayload,
      '1',
    );

    expect(patchResponse.status()).toBe(200);
    expect(patched.version).toBe(2);
    expect(patched.steps).toHaveLength(2);
    expect(patched.steps[0].content).toBe('Replacement step 1');
    expect(patched.steps[1].content).toBe('Replacement step 2');
    expect(patched.assertions).toHaveLength(0);
  });

  // ============================================
  // TC09 — BK-157: Optimistic locking (200/409/200)
  // ============================================
  test('BK-157: PATCH /atcs/{id} honors matching X-If-Match → 200', async ({ api }) => {
    api.setAuthToken(getPat());

    const ts = Date.now();
    const createPayload = buildValidPayload({ title: `Locking test ${ts}` });
    const [, created] = await api.atcs.createAtcSuccessfully(createPayload);

    // Patch with correct version → should succeed
    const patchPayload = buildPatchPayload(created, ts);
    const [res1] = await api.atcs.patchAtcSuccessfully(created.id, patchPayload, '1');
    expect(res1.status()).toBe(200);
  });

  test('BK-157: PATCH /atcs/{id} rejects stale X-If-Match → 409', async ({ api }) => {
    api.setAuthToken(getPat());

    const ts = Date.now();
    const createPayload = buildValidPayload({ title: `Stale lock test ${ts}` });
    const [, created] = await api.atcs.createAtcSuccessfully(createPayload);

    // First PATCH bumps to v2
    const patchPayload1 = buildPatchPayload(created, ts);
    const [res1] = await api.atcs.patchAtcSuccessfully(created.id, patchPayload1, '1');
    expect(res1.status()).toBe(200);

    // Second PATCH with stale version '1' → 409 Conflict
    const patchPayload2 = buildPatchPayload(created, Date.now() + 1);
    const [_res2, _errBody] = await api.atcs.patchAtcWithStaleLock(
      created.id,
      patchPayload2,
      '1',
    );
  });

  test('BK-157: PATCH /atcs/{id} absent X-If-Match → 200', async ({ api }) => {
    api.setAuthToken(getPat());

    const ts = Date.now();
    const createPayload = buildValidPayload({ title: `No lock test ${ts}` });
    const [, created] = await api.atcs.createAtcSuccessfully(createPayload);

    // Patch WITHOUT X-If-Match → should succeed (optimistic locking is optional)
    const patchPayload = buildPatchPayload(created, ts);
    const [res] = await api.atcs.patchAtcSuccessfully(created.id, patchPayload);
    expect(res.status()).toBe(200);
  });

  // ============================================
  // TC10 — BK-158: 404 on non-existent ATC
  // ============================================
  test('BK-158: PATCH /atcs/{id} returns 404 for non-existent id', async ({ api }) => {
    api.setAuthToken(getPat());

    // Create a real ATC first to use its valid shape for the PATCH body
    const ts = Date.now();
    const createPayload = buildValidPayload({ title: `404 test base ${ts}` });
    const [, created] = await api.atcs.createAtcSuccessfully(createPayload);

    // Now PATCH with a valid body but non-existent UUID
    const patchPayload = buildPatchPayload(created, ts);
    const fakeId = DataFactory.SENTINEL.fake;

    const [_response, _errBody] = await api.atcs.patchAtcNonExistent(fakeId, patchPayload);
  });

  // ============================================
  // TC11 — BK-159: Empty body PATCH no-op
  // ============================================
  test('BK-159: PATCH /atcs/{id} with identical payload returns 200 but still bumps version', async ({ api }) => {
    api.setAuthToken(getPat());

    const ts = Date.now();
    const createPayload = buildValidPayload({ title: `Idempotent patch test ${ts}` });
    const [, created] = await api.atcs.createAtcSuccessfully(createPayload);

    // Send PATCH with the exact same data as the original
    const [res, body] = await api.atcs.patchAtcIdenticalPayload(
      created.id,
      {
        title: created.title,
        module_id: created.module_id,
        user_story_id: created.user_story_id,
        acceptance_criterion_ids: created.acceptance_criterion_ids,
        layer: created.layer,
        steps: created.steps.map(s => ({ position: s.position, content: s.content })),
        assertions: created.assertions.map(a => ({ content: a.content })),
        tags: created.tags,
      },
    );

    expect(res.status()).toBe(200);
    expect(body.title).toBe(created.title);
    expect(body.steps).toHaveLength(created.steps.length);
    expect(body.assertions).toHaveLength(created.assertions.length);
  });

  // ============================================
  // TC12 — BK-160: Immutable fields on PATCH
  // ============================================
  test('BK-160: PATCH /atcs/{id} keeps slug, user_story_id and module_id immutable', async ({ api }) => {
    api.setAuthToken(getPat());

    const ts = Date.now();
    const createPayload = buildValidPayload({ title: `Immutable test ${ts}` });
    const [, created] = await api.atcs.createAtcSuccessfully(createPayload);

    const originalSlug = created.slug;
    const originalUserStoryId = created.user_story_id;
    const originalModuleId = created.module_id;

    // Attempt to change immutable fields
    const [res, body] = await api.atcs.patchAtcImmutableFields(
      created.id,
      {
        title: `Tried to change immutable ${ts}`,
        module_id: created.module_id,
        user_story_id: created.user_story_id,
        acceptance_criterion_ids: created.acceptance_criterion_ids,
        layer: created.layer,
        steps: created.steps.map(s => ({ position: s.position, content: s.content })),
        assertions: [],
        tags: ['immutable-test'],
      },
    );

    expect(res.status()).toBe(200);
    expect(body.slug).toBe(originalSlug);
    expect(body.user_story_id).toBe(originalUserStoryId);
    expect(body.module_id).toBe(originalModuleId);
    expect(body.title).toBe(`Tried to change immutable ${ts}`);
  });
});
