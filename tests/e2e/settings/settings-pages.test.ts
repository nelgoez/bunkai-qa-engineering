/**
 * KATA Architecture — Settings E2E Tests (Workspaces + Tokens)
 *
 * Validates the authenticated Settings surfaces against staging:
 * - BK-89: the workspaces I belong to (name, slug, role, active marker)
 * - BK-88: Personal Access Token list + revoke confirmation dialog
 *
 * Runs in the `e2e` project (authenticated storageState), like the session
 * smoke suite. The revoke-confirmation ATCs never confirm a revoke, so no
 * live token is destroyed by this suite.
 */

import { test } from '@TestFixture';

test.describe('BK-89: Settings > Workspaces', { tag: ['@e2e'] }, () => {
  test('lists my workspaces with role and a single active marker', async ({ ui }) => {
    await ui.workspaces.goto();
    await ui.workspaces.listWorkspacesWithNameAndSlug();
    await ui.workspaces.renderCapitalisedRoleLabel();
    await ui.workspaces.markExactlyOneActiveWorkspace();
    await ui.workspaces.showNoLeaveAddOrSwitchControl();
  });
});

test.describe('BK-88: Settings > Tokens', { tag: ['@e2e'] }, () => {
  test('lists tokens with columns and no full secret', async ({ ui }) => {
    await ui.tokens.goto();
    await ui.tokens.listTokensWithColumnsAndNoSecret();
    await ui.tokens.showExpiryDateOnRow();
  });

  test('requires a confirmation dialog before revoking', async ({ ui }) => {
    await ui.tokens.goto();
    await ui.tokens.requireConfirmationBeforeRevoke();
  });

  test('cancelling a revoke keeps the token active', async ({ ui }) => {
    await ui.tokens.goto();
    await ui.tokens.cancelRevokeKeepsTokenActive();
  });

  // BK-1046 (confirming a revoke flips the row to revoked) is intentionally not
  // automated here: revoking a live token on staging destroys a shared CI
  // credential. Covered manually; the confirm handler is exercised by BK-1045/1047.
});
