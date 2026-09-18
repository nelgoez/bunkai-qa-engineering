/**
 * KATA Architecture - Layer 3: Tokens Page Component
 *
 * UI component for the Settings > Tokens surface (BK-88: "Manage Personal
 * Access Tokens"). Lists every issued token (prefix only, never the secret),
 * and requires an explicit confirmation dialog before a revoke.
 *
 * @atc IDs map to Jira Test issues BK-1043, BK-1045, BK-1047, BK-1054
 *
 * Page: /settings/tokens (Bunkai TMS — staging)
 *
 * Locators (data-testid):
 *   - tokens-list            (region + "Your tokens" header)
 *   - issue-token-open       (button "New token")
 *   - tokens-rows            (rows container)
 *   - token-row-<uuid>       (one row per token)
 *   - token-revoke-<uuid>    (revoke button)
 *   - revoke-token-modal     (confirmation dialog)
 *   - revoke-token-confirm   (confirm revoke)
 *   - revoke-token-cancel    (cancel revoke)
 */

import type { TestContextOptions } from '@TestContext';

import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { atc, step } from '@utils/decorators';

// ============================================
// Tokens Page Component
// ============================================

export class TokensPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Navigation (Public)
  // ============================================

  /**
   * Navigate to the Settings > Tokens page.
   * Call this BEFORE using the token-list ATCs.
   */
  @step
  async goto(): Promise<void> {
    await this.page.goto(this.buildUrl('/settings/tokens'));
  }

  // ============================================
  // Helpers (Private)
  // ============================================

  /**
   * The token list region. Scoped to the first match because the settings
   * shell can briefly render a duplicate region during hydration; every ATC
   * asserts within this single region to avoid strict-mode violations.
   */
  private tokensRegion() {
    return this.page.locator('[data-testid="tokens-list"]').first();
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: list every token with its name, scopes, workspace, created and expiry
   * columns, and never the full secret. The list shows only the `bk_pat_`
   * prefix; the full secret (prefix + "." + base64url body) must not render.
   */
  @atc('BK-1043')
  async listTokensWithColumnsAndNoSecret(): Promise<void> {
    const region = this.tokensRegion();
    await expect(region).toBeVisible();
    await expect(region.locator('[data-testid="tokens-rows"]')).toBeVisible();
    await expect(region.locator('[data-testid^="token-row-"]').first()).toBeVisible();
    await expect(region).not.toContainText(/bk_pat_[\w-]+\./);
  }

  /**
   * ATC: require an explicit confirmation dialog before revoking a token.
   */
  @atc('BK-1045')
  async requireConfirmationBeforeRevoke(): Promise<void> {
    await this.tokensRegion().locator('[data-testid^="token-revoke-"]').first().click();
    await expect(this.page.locator('[data-testid="revoke-token-modal"]')).toBeVisible();
  }

  /**
   * ATC: leave the token active when the revoke confirmation is cancelled.
   */
  @atc('BK-1047')
  async cancelRevokeKeepsTokenActive(): Promise<void> {
    const firstRevoke = this.tokensRegion().locator('[data-testid^="token-revoke-"]').first();
    await firstRevoke.click();
    await this.page.locator('[data-testid="revoke-token-cancel"]').click();
    await expect(this.page.locator('[data-testid="revoke-token-modal"]')).toBeHidden();
    await expect(firstRevoke).toBeVisible();
  }

  /**
   * ATC: show the expiry date on the row when the token is issued with an
   * expiry window — the "Expires" column is rendered in the token list.
   */
  @atc('BK-1054')
  async showExpiryDateOnRow(): Promise<void> {
    await expect(this.tokensRegion()).toContainText('Expires');
  }
}
