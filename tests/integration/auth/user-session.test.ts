/**
 * KATA Architecture — User Session Integration Tests
 *
 * Validates authenticated user session via API.
 * Token is auto-loaded from api-state.json by ApiFixture.
 *
 * Project: integration (depends on api-setup)
 */

import { config, expect, test } from '@TestFixture';

test.describe('BK-166: User Session API', { tag: ['@api', '@critical'] }, () => {
  test('BK-166: Get current user with valid token from api-state.json', async ({ api }) => {
    const [response, userData] = await api.auth.getCurrentUser();

    expect(response.status()).toBe(200);
    expect(userData.user).toBeDefined();
    expect(userData.user.id).toBeDefined();
    expect(userData.user.email).toBeDefined();
    expect(userData.workspaces).toBeDefined();
    expect(userData.active_workspace_id).toBeDefined();
  });

  test('BK-166: Unauthenticated request returns 401', async ({ api }) => {
    api.clearAuthToken();

    const [response] = await api.auth.getCurrentUser();

    expect(response.status()).toBe(401);
    expect(response.ok()).toBe(false);
  });

  test('BK-166: Re-authenticate and obtain new token', async ({ api }) => {
    api.clearAuthToken();

    const credentials = {
      email: config.testUser.email,
      password: config.testUser.password,
    };

    const [response, tokenData] = await api.auth.authenticateSuccessfully(credentials);

    expect(response.status()).toBe(200);
    expect(tokenData.access_token).toBeDefined();
  });

  test('BK-166: Reject login with invalid credentials', async ({ api }) => {
    const credentials = {
      email: config.testUser.email,
      password: 'definitely-wrong-password',
    };

    const [response, errorBody] = await api.auth.loginWithInvalidCredentials(credentials);

    expect(response.status()).toBe(401);
    expect(errorBody.error.code).toBe('unauthorized');
  });
});
