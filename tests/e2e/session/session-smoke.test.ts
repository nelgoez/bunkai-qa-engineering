/**
 * KATA Architecture — Authenticated Session Smoke Tests
 *
 * Verifies the logged-in session end-to-end against the Bunkai staging app:
 * the landing page renders without a login bounce, the session token resolves
 * the current user, and the workspace list is reachable. Auth is handled by
 * the ui-auth setup (storage state), not by LoginPage ATCs (exercised in
 * tests/e2e/auth/).
 *
 * NOTE: these are infrastructure smoke checks, not feature coverage — no
 * @atc mapping and no Jira Test issue. Real Home Dashboard (BK-254) ACs are
 * a separate future automation target.
 */

import { expect, test } from '@TestFixture';

test.describe('Session smoke: authenticated landing + API', { tag: ['@e2e', '@critical'] }, () => {
  test('Landing page loads with an authenticated session', async ({ page }) => {
    await page.goto('/');

    await expect(page).not.toHaveURL(/.*\/login.*/);
    await expect(page).toHaveTitle(/.+/);
  });

  test('Session token resolves the current user', async ({ test: fixture }) => {
    const [response, userInfo] = await fixture.api.auth.getCurrentUser();

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);
    expect(userInfo.user.email).toBeDefined();
    expect(userInfo.user.id).toBeDefined();
  });

  test('Session token lists workspaces', async ({ test: fixture }) => {
    const [response] = await fixture.api.apiGET<{ workspaces: unknown[] }>('/workspaces');

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);
  });
});
