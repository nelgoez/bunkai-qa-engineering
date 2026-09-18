/**
 * KATA Architecture - Layer 3: Workspaces Page Component
 *
 * UI component for the Settings > Workspaces surface (BK-89: "View the
 * workspaces I belong to"). Renders every workspace the caller actively
 * belongs to with its name, slug, role, and the active-workspace marker.
 *
 * @atc IDs map to Jira Test issues BK-1030..BK-1037
 *
 * Page: /settings/workspaces (Bunkai TMS — staging)
 *
 * Locators (data-testid):
 *   - workspaces-list          (list container + "N workspaces" header)
 *   - workspaces-rows          (rows container)
 *   - workspace-row-<slug>     (one row per workspace)
 *   - workspace-active-<slug>  (active marker span, text "active" when active)
 *   - workspace-delete-<slug>  (delete button)
 */

import type { TestContextOptions } from '@TestContext';

import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { atc, step } from '@utils/decorators';

// ============================================
// Workspaces Page Component
// ============================================

export class WorkspacesPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Navigation (Public)
  // ============================================

  /**
   * Navigate to the Settings > Workspaces page.
   * Call this BEFORE using the workspace-list ATCs.
   */
  @step
  async goto(): Promise<void> {
    await this.page.goto(this.buildUrl('/settings/workspaces'));
  }

  // ============================================
  // Helpers (Private)
  // ============================================

  /**
   * The workspaces list region. Scoped to the first match because the settings
   * shell can briefly render a duplicate region during hydration; every ATC
   * asserts within this single region to avoid strict-mode violations.
   */
  private workspacesRegion() {
    return this.page.locator('[data-testid="workspaces-list"]').first();
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: list every workspace the caller actively belongs to with its name and
   * slug. The list container, the rows wrapper, and at least one workspace row
   * must all render.
   */
  @atc('BK-1030')
  async listWorkspacesWithNameAndSlug(): Promise<void> {
    const region = this.workspacesRegion();
    await expect(region).toBeVisible();
    await expect(region.locator('[data-testid="workspaces-rows"]')).toBeVisible();
    await expect(region.locator('[data-testid^="workspace-row-"]').first()).toBeVisible();
  }

  /**
   * ATC: render the capitalised role label per membership (e.g. "Owner").
   */
  @atc('BK-1031')
  async renderCapitalisedRoleLabel(): Promise<void> {
    await expect(this.workspacesRegion()).toContainText('Owner');
  }

  /**
   * ATC: mark exactly one workspace as active. The active marker span renders
   * the text "active"; non-active rows leave it empty.
   */
  @atc('BK-1032')
  async markExactlyOneActiveWorkspace(): Promise<void> {
    const activeMarkers = this.workspacesRegion()
      .locator('[data-testid^="workspace-active-"]')
      .filter({ hasText: 'active' });
    await expect(activeMarkers).toHaveCount(1);
  }

  /**
   * ATC: render no leave, add or switch control in the Workspaces section —
   * the surface is read-only (workspace management lives in other flows).
   */
  @atc('BK-1037')
  async showNoLeaveAddOrSwitchControl(): Promise<void> {
    const list = this.workspacesRegion();
    await expect(list.getByRole('button', { name: /leave/i })).toHaveCount(0);
    await expect(list.getByRole('button', { name: /add workspace/i })).toHaveCount(0);
    await expect(list.getByRole('button', { name: /switch/i })).toHaveCount(0);
  }
}
