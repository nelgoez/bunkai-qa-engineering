/**
 * KATA Architecture - Layer 4: API Fixture
 *
 * Dependency Injection container for all API components.
 * Provides unified access to API testing capabilities.
 *
 * All API components share the same request context from TestContext,
 * ensuring consistent authentication and request configuration.
 *
 * HOW TO ADD NEW API COMPONENTS:
 * 1. Create your component in tests/components/api/YourApi.ts
 * 2. Import it here
 * 3. Add as readonly property
 * 4. Initialize in constructor passing the options
 */

import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { AtcsApi } from '@api/AtcsApi';
import { AuthApi } from '@api/AuthApi';
import { DefectsApi } from '@api/DefectsApi';
import { ExampleApi } from '@api/ExampleApi';
import { ProjectsApi } from '@api/ProjectsApi';
import { TestsApi } from '@api/TestsApi';
import { UserStoriesApi } from '@api/UserStoriesApi';
import { WorkspacesApi } from '@api/WorkspacesApi';

// ============================================
// API Fixture Class
// ============================================

export class ApiFixture extends ApiBase {
  /** ATC component - create and edit ATCs via REST API */
  readonly atcs: AtcsApi;

  /** Auth component - handles login and token management */
  readonly auth: AuthApi;

  /** Defects component - defect CRUD and sync operations */
  readonly defects: DefectsApi;

  /** Example component - reference only */
  readonly example: ExampleApi;

  /** Projects component - Project CRUD operations */
  readonly projects: ProjectsApi;

  /** Tests component - Test Builder CRUD operations */
  readonly tests: TestsApi;

  /** Workspaces component - Workspace CRUD operations */
  readonly workspaces: WorkspacesApi;

  /** User Stories component - User Stories CRUD operations */
  readonly userStories: UserStoriesApi;

  constructor(options: TestContextOptions) {
    super(options);

    // All components receive the same options (same request context)
    this.atcs = new AtcsApi(options);
    this.auth = new AuthApi(options);
    this.defects = new DefectsApi(options);
    this.example = new ExampleApi(options);
    this.projects = new ProjectsApi(options);
    this.tests = new TestsApi(options);
    this.workspaces = new WorkspacesApi(options);
    this.userStories = new UserStoriesApi(options);
  }

  // ============================================
  // Token Propagation to Child Components
  // ============================================

  /**
   * Set authentication token for all API components.
   * This ensures all components use the same token for authenticated requests.
   */
  override setAuthToken(token: string) {
    super.setAuthToken(token);
    this.atcs.setAuthToken(token);
    this.auth.setAuthToken(token);
    this.defects.setAuthToken(token);
    this.example.setAuthToken(token);
    this.projects.setAuthToken(token);
    this.tests.setAuthToken(token);
    this.workspaces.setAuthToken(token);
    this.userStories.setAuthToken(token);
  }

  /**
   * Clear authentication token from all API components.
   */
  override clearAuthToken() {
    super.clearAuthToken();
    this.atcs.clearAuthToken();
    this.auth.clearAuthToken();
    this.defects.clearAuthToken();
    this.example.clearAuthToken();
    this.projects.clearAuthToken();
    this.tests.clearAuthToken();
    this.workspaces.clearAuthToken();
    this.userStories.clearAuthToken();
  }
}
