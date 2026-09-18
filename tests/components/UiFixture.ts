/**
 * KATA Architecture - Layer 4: UI Fixture
 *
 * Dependency Injection container for all UI components.
 * Provides unified access to UI testing capabilities.
 *
 * All UI components share the same page context from TestContext,
 * ensuring consistent browser state across components.
 *
 * HOW TO ADD NEW UI COMPONENTS:
 * 1. Create your component in tests/components/ui/YourPage.ts
 * 2. Import it here
 * 3. Add as readonly property
 * 4. Initialize in constructor passing the options
 */

import type { TestContextOptions } from '@TestContext';

import { LoginPage } from '@ui/LoginPage';
import { TokensPage } from '@ui/TokensPage';
import { UiBase } from '@ui/UiBase';
import { WorkspacesPage } from '@ui/WorkspacesPage';

// ============================================
// UI Fixture Class
// ============================================

export class UiFixture extends UiBase {
  /** Login page component - handles authentication flows */
  readonly login: LoginPage;

  /** Tokens page component - Settings > Tokens (Personal Access Tokens) */
  readonly tokens: TokensPage;

  /** Workspaces page component - Settings > Workspaces (workspaces I belong to) */
  readonly workspaces: WorkspacesPage;

  constructor(options: TestContextOptions) {
    super(options);

    this.login = new LoginPage(options);
    this.tokens = new TokensPage(options);
    this.workspaces = new WorkspacesPage(options);
  }
}
