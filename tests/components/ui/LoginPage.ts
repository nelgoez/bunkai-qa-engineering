/**
 * KATA Architecture - Layer 3: Login Page Component
 *
 * UI component for authentication via the Bunkai TMS login page.
 *
 * @atc IDs map to Jira Test issues BK-313, BK-314
 *
 * Page: /login (Bunkai TMS — staging)
 * Two-step password sign-in:
 *   1. Enter email → "Continue" (login-continue)
 *   2. Enter password → "Sign in" (login-signin)
 *
 * Locators (data-testid):
 *   - login-email              (email input)
 *   - login-continue           (advance to password step)
 *   - login-password           (password input)
 *   - login-signin             (submit sign-in)
 *   - login-error              (inline error alert)
 *   - login-magic-link-toggle  (switch to magic-link mode)
 *   - oauth-github / oauth-google (OAuth provider buttons)
 */

import type { TestContextOptions } from '@TestContext';

import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { atc, step } from '@utils/decorators';

// ============================================
// Types - Login data structures
// ============================================

/**
 * Login credentials for UI authentication (email + password).
 */
export interface LoginCredentials {
  email: string
  password: string
}

// ============================================
// Login Page Component
// ============================================

export class LoginPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers (Private)
  // ============================================

  /**
   * Fill the two-step sign-in form and submit.
   * Helper that combines email → continue → password → sign-in actions.
   */
  private async fillAndSubmitLoginForm(credentials: LoginCredentials): Promise<void> {
    await this.page.locator('[data-testid="login-email"]').fill(credentials.email);
    await this.page.locator('[data-testid="login-continue"]').click();
    await this.page.locator('[data-testid="login-password"]').fill(credentials.password);
    await this.page.locator('[data-testid="login-signin"]').click();
  }

  // ============================================
  // Navigation (Public)
  // ============================================

  /**
   * Navigate to the login page.
   * Call this BEFORE using login ATCs.
   */
  @step
  async goto(): Promise<void> {
    await this.page.goto(this.buildUrl('/login'));
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: Login with valid credentials - expects success
   *
   * IMPORTANT: Call goto() before this ATC.
   * Fills email + password, submits, and verifies redirect away from /login.
   *
   * @param credentials - Email and password
   */
  @atc('BK-313')
  async loginSuccessfully(credentials: LoginCredentials): Promise<void> {
    await this.fillAndSubmitLoginForm(credentials);

    // Wait for authentication to complete and redirect
    await this.page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    await expect(this.page).not.toHaveURL(/.*\/login.*/);
  }

  /**
   * ATC: Login with invalid credentials - expects error
   *
   * IMPORTANT: Call goto() before this ATC.
   * Fills a registered email + wrong password, submits, and verifies the
   * inline error is visible and the user stays on /login.
   *
   * @param credentials - Registered email with an invalid password
   */
  @atc('BK-314')
  async loginWithInvalidCredentials(credentials: LoginCredentials): Promise<void> {
    await this.fillAndSubmitLoginForm(credentials);

    // Fixed assertion - error should be visible
    const errorIndicator = this.page.locator('[data-testid="login-error"]');
    await expect(errorIndicator).toBeVisible({ timeout: 5000 });
    await expect(this.page).toHaveURL(/.*\/login.*/);
  }
}
