import { DataFactory } from '@DataFactory';
import { config, expect, test } from '@TestFixture';

const uid = () => Date.now().toString(36);

test.describe('BK-14: User Stories API', { tag: ['@api', '@story'] }, () => {
  test('BK-14: POST /modules/{id}/user-stories creates story → 201', async ({ api }) => {
    api.setAuthToken(config.testUser.pat!);

    const [response, userStory] = await api.userStories.createUserStory(
      config.seed.module.id,
      { title: `BK-14 test ${uid()}` },
    );

    expect(response.status()).toBe(201);
    expect(userStory.id).toBeDefined();
    expect(userStory.title).toMatch(/^BK-14 test /);
    expect(userStory.module_id).toBe(config.seed.module.id);
    expect(userStory.archived_at).toBeNull();
  });

  test('BK-14: POST /modules/{id}/user-stories rejects title < 3 → 422', async ({ api }) => {
    api.setAuthToken(config.testUser.pat!);

    const [response] = await api.userStories.createUserStoryInvalidTitle(
      config.seed.module.id,
      { title: 'AB' },
    );

    expect(response.status()).toBe(422);
  });

  test('BK-14: POST /modules/{id}/user-stories rejects empty body → 422', async ({ api }) => {
    api.setAuthToken(config.testUser.pat!);

    const [response] = await api.userStories.createUserStoryEmptyBody(config.seed.module.id);

    expect(response.status()).toBe(422);
  });

  test('BK-14: POST /modules/{id}/user-stories returns 401 without auth', async ({ api }) => {
    const [response] = await api.userStories.createUserStoryUnauthenticated(
      config.seed.module.id,
      { title: 'Unauthorized test' },
    );

    expect(response.status()).toBe(401);
  });

  test('BK-14: POST /modules/{id}/user-stories returns 404 for non-existent module', async ({ api }) => {
    api.setAuthToken(config.testUser.pat!);

    const [response] = await api.userStories.createUserStoryNonExistentModule(
      DataFactory.SENTINEL.nonExistent,
      { title: `No module test ${uid()}` },
    );

    expect(response.status()).toBe(404);
  });
});
