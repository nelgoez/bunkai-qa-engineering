/**
 * KATA Architecture — Dashboard E2E Tests
 *
 * Validates authenticated session, API access, and workspace listing
 * against the Bunkai staging app. Auth is handled by the ui-auth setup
 * (storage state), not by LoginPage ATCs (exercised in tests/e2e/auth/).
 */

import { expect, test } from '@TestFixture';

test.describe('BK-3: Dashboard E2E', { tag: ['@e2e', '@critical'] }, () => {
  test('BK-201: Dashboard loads with authenticated session', async ({ page }) => {
    await page.goto('/');

    await expect(page).not.toHaveURL(/.*\/login.*/);
    await expect(page).toHaveTitle(/.+/);
  });

  test('BK-202: User info accessible via API with session token', async ({ test: fixture }) => {
    const [response, userInfo] = await fixture.api.auth.getCurrentUser();

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);
    expect(userInfo.user.email).toBeDefined();
    expect(userInfo.user.id).toBeDefined();
  });

  test('BK-202: Workspace list accessible via API', async ({ test: fixture }) => {
    const [response] = await fixture.api.apiGET<{ workspaces: unknown[] }>('/workspaces');

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);
  });
});
