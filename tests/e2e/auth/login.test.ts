/**
 * KATA Architecture — Login E2E Tests
 *
 * Validates the Bunkai TMS two-step password sign-in flow
 * (email → password) against staging. Runs in a fresh, unauthenticated
 * context (see the `e2e-auth` project in playwright.config.ts).
 *
 * @atc IDs map to Jira Test issues BK-313, BK-314
 */

import { test } from '@TestFixture';
import { config } from '@variables';

test.describe('BK-3: Login E2E', { tag: ['@e2e'] }, () => {
  test('BK-313: should sign in successfully with valid credentials', async ({ ui }) => {
    await ui.login.goto();
    await ui.login.loginSuccessfully({
      email: config.testUser.email,
      password: config.testUser.password,
    });
  });

  test('BK-314: should reject sign in with invalid credentials', async ({ ui }) => {
    await ui.login.goto();
    await ui.login.loginWithInvalidCredentials({
      email: config.testUser.email,
      password: 'wrong-password',
    });
  });
});
