import { config, expect, test } from '@TestFixture';

const pat = config.testUser.pat!;
const moduleId = '37aa2ba9-47eb-4e45-ad2d-085c1ee36ef4';

interface UserStoryResponse {
  user_story: {
    id: string
    module_id: string
    project_id: string
    title: string
    description: string | null
    external_id: string | null
    archived_at: string | null
  }
}

const uid = () => Date.now().toString(36);

test.describe('BK-14: User Story CRUD API', { tag: ['@api', '@story'] }, () => {
  test('BK-14: POST /api/v1/modules/{id}/user-stories creates story → 201', async ({ api }) => {
    api.setAuthToken(pat);

    const [res, body] = await api.apiPOST<UserStoryResponse, { title: string }>(
      `/modules/${moduleId}/user-stories`,
      { title: `BK-14 test ${uid()}` },
    );

    expect(res.status()).toBe(201);
    expect(body.user_story).toBeDefined();
    expect(body.user_story.title).toMatch(/^BK-14 test /);
    expect(body.user_story.module_id).toBe(moduleId);
    expect(body.user_story.archived_at).toBeNull();
  });

  test('BK-14: POST /api/v1/modules/{id}/user-stories rejects title < 3 → 422', async ({ api }) => {
    api.setAuthToken(pat);

    const [res] = await api.apiPOST<{ error: { code: string } }, { title: string }>(
      `/modules/${moduleId}/user-stories`,
      { title: 'AB' },
    );

    expect(res.status()).toBe(422);
  });

  test('BK-14: POST /api/v1/modules/{id}/user-stories rejects empty body → 422', async ({ api }) => {
    api.setAuthToken(pat);

    const [res] = await api.apiPOST<{ error: { code: string } }, Record<string, never>>(
      `/modules/${moduleId}/user-stories`,
      {},
    );

    expect(res.status()).toBe(422);
  });

  test('BK-14: POST /api/v1/modules/{id}/user-stories returns 401 without auth', async ({ api }) => {
    const saved = api.authToken;
    api.clearAuthToken();

    const [res] = await api.apiPOST<{ error: { code: string } }, { title: string }>(
      `/modules/${moduleId}/user-stories`,
      { title: 'Unauthorized test' },
    );

    expect(res.status()).toBe(401);
    if (saved) { api.setAuthToken(saved); }
  });

  test('BK-14: POST /api/v1/modules/{id}/user-stories returns 404 for non-existent module', async ({ api }) => {
    api.setAuthToken(pat);

    const [res] = await api.apiPOST<{ error: { code: string } }, { title: string }>(
      '/modules/00000000-0000-0000-0000-000000000000/user-stories',
      { title: `No module test ${uid()}` },
    );

    expect(res.status()).toBe(404);
  });
});
