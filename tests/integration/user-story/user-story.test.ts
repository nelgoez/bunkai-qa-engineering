import { config, expect, test } from '@TestFixture';

const moduleId = '37aa2ba9-47eb-4e45-ad2d-085c1ee36ef4';

const uid = () => Date.now().toString(36);

test.describe('BK-14: User Stories API', { tag: ['@api', '@story'] }, () => {
  test('BK-14: POST /modules/{id}/user-stories creates story → 201', async ({ api }) => {
    api.setAuthToken(config.testUser.pat!);

    const [response, userStory] = await api.userStories.createUserStory(
      moduleId,
      { title: `BK-14 test ${uid()}` },
    );

    expect(response.status()).toBe(201);
    expect(userStory.id).toBeDefined();
    expect(userStory.title).toMatch(/^BK-14 test /);
    expect(userStory.module_id).toBe(moduleId);
    expect(userStory.archived_at).toBeNull();
  });

  test('BK-14: POST /modules/{id}/user-stories rejects title < 3 → 422', async ({ api }) => {
    api.setAuthToken(config.testUser.pat!);

    const [response] = await api.userStories.createUserStoryInvalidTitle(
      moduleId,
      { title: 'AB' },
    );

    expect(response.status()).toBe(422);
  });

  test('BK-14: POST /modules/{id}/user-stories rejects empty body → 422', async ({ api }) => {
    api.setAuthToken(config.testUser.pat!);

    const [response] = await api.userStories.createUserStoryEmptyBody(moduleId);

    expect(response.status()).toBe(422);
  });

  test('BK-14: POST /modules/{id}/user-stories returns 401 without auth', async ({ api }) => {
    const [response] = await api.userStories.createUserStoryUnauthenticated(
      moduleId,
      { title: 'Unauthorized test' },
    );

    expect(response.status()).toBe(401);
  });

  test('BK-14: POST /modules/{id}/user-stories returns 404 for non-existent module', async ({ api }) => {
    api.setAuthToken(config.testUser.pat!);

    const [response] = await api.userStories.createUserStoryNonExistentModule(
      '00000000-0000-0000-0000-000000000000',
      { title: `No module test ${uid()}` },
    );

    expect(response.status()).toBe(404);
  });
});
