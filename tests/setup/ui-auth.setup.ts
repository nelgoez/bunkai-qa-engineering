/**
 * KATA Architecture - UI Auth Setup
 *
 * Authenticates via the Bunkai TMS login page UI and intercepts the
 * sign-in response to obtain the PAT token (which authenticates /api/v1/*).
 *
 * This provides BOTH:
 * - Browser session (storageState) for UI tests
 * - PAT token (intercepted) for API calls within E2E tests
 *
 * Dependencies: global-setup
 * Dependents: e2e
 */

import type { ApiState } from '@data/types';
import type { SigninResponse } from '@schemas/auth.types';

import { writeFileSync } from 'node:fs';
import { test as setup } from '@TestFixture';
import { attachRequestResponseToAllure } from '@utils/allure';
import { config } from '@variables';

const storageStateFile = config.auth.storageStatePath;
const apiStateFile = config.auth.apiStatePath;

/**
 * UI Authentication Setup
 *
 * 1. Navigates to login page (via LoginPage.goto())
 * 2. Sets up response interception BEFORE triggering login
 * 3. Uses LoginPage.loginSuccessfully() ATC (two-step email + password)
 * 4. Captures the PAT token from the intercepted sign-in response
 * 5. Saves storageState (cookies) for UI tests
 * 6. Saves api-state (PAT) for API integration
 */
setup('UI Setup: authenticate via UI', async ({ ui, page }) => {
  console.log('[UI Setup] Starting UI authentication...');
  console.log('[UI Setup] Target: /login');

  // Navigate to login page (outside of ATC)
  await ui.login.goto();

  // Credentials for login
  const credentials = {
    email: config.testUser.email,
    password: config.testUser.password,
  };

  // Set up response interception BEFORE triggering login
  // The login UI calls /api/v1/auth/signin after email + password submission
  const tokenPromise = page.waitForResponse(
    resp => resp.url().includes(config.auth.tokenEndpoint)
      && resp.request().method() === 'POST'
      && resp.status() === 200,
    { timeout: 30000 },
  );

  // Use LoginPage ATC - triggers two-step sign-in (email → password)
  await ui.login.loginSuccessfully(credentials);
  console.log('[UI Setup] UI login successful');

  // Capture the sign-in response
  console.log('[UI Setup] Intercepting sign-in response...');
  const response = await tokenPromise;
  const tokenData = (await response.json()) as SigninResponse;

  // Attach to Allure for debugging
  await attachRequestResponseToAllure({
    url: response.url(),
    method: 'POST',
    responseBody: tokenData,
    requestBody: { email: credentials.email, password: '***' },
  });

  // Verify the PAT token was obtained
  if (!tokenData?.pat?.token) {
    throw new Error('Sign-in response missing PAT token');
  }

  console.log('[UI Setup] PAT token intercepted successfully');

  // Save storage state (cookies + localStorage) for UI tests
  await page.context().storageState({ path: storageStateFile });
  console.log(`[UI Setup] Storage state saved to ${storageStateFile}`);

  // Save the PAT for API calls within E2E tests
  const sessionExpiry = tokenData.session?.expires_at ?? 0;
  const apiState: ApiState = {
    token: tokenData.pat.token,
    tokenType: tokenData.session.token_type,
    expiresIn: sessionExpiry > 0 ? Math.max(0, Math.floor(sessionExpiry - Date.now() / 1000)) : 86400,
    refreshToken: null,
    source: 'ui-login',
    createdAt: new Date().toISOString(),
  };

  writeFileSync(apiStateFile, JSON.stringify(apiState, null, 2));
  console.log(`[UI Setup] PAT token saved to ${apiStateFile}`);

  console.log('[UI Setup] Authentication successful');
  console.log(`[UI Setup] Current URL: ${page.url()}`);
});
