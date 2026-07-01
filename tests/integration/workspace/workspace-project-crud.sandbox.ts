import { config, expect, test } from '@TestFixture';

interface WorkspaceResponse {
  workspace: {
    id: string
    slug: string
    name: string
    owner_user_id: string
    plan: string
    created_at: string
  }
}

interface ProjectResponse {
  project: {
    id: string
    slug: string
    name: string
    description: string | null
    workspace_id: string
    created_at: string
  }
}

interface ErrorResponse {
  error: { code: string, message: string }
}

const uid = () => Date.now().toString(36);
const pat = config.testUser.pat!;

test.describe('BK-4/BK-8: Workspace & Project CRUD API', { tag: ['@api', '@critical'] }, () => {
  let wsSlug: string;
  let wsId: string;

  // ===================== BK-4: Workspace =====================
  test('BK-4: POST /api/v1/workspaces creates workspace with name+slug → 201', async ({ api }) => {
    api.setAuthToken(pat);
    wsSlug = `ws-auto-${uid()}`;

    const [res, body] = await api.apiPOST<WorkspaceResponse, { name: string, slug: string }>(
      '/workspaces',
      { name: `Workspace ${uid()}`, slug: wsSlug },
    );

    expect(res.status()).toBe(201);
    expect(body.workspace).toBeDefined();
    expect(body.workspace.slug).toBe(wsSlug);
    expect(body.workspace.name).toMatch(/^Workspace /);
    expect(body.workspace.owner_user_id).toBeDefined();
    expect(body.workspace.plan).toBe('community');
    wsId = body.workspace.id;
  });

  test('BK-4: POST /api/v1/workspaces rejects name < 3 chars → 422', async ({ api }) => {
    api.setAuthToken(pat);

    const [res, body] = await api.apiPOST<ErrorResponse, { name: string, slug: string }>(
      '/workspaces',
      { name: 'AB', slug: 'ab' },
    );

    expect(res.status()).toBe(422);
    expect(body.error.code).toBe('validation_failed');
  });

  test('BK-4: POST /api/v1/workspaces rejects reserved slug → 422', async ({ api }) => {
    api.setAuthToken(pat);

    const [res] = await api.apiPOST<ErrorResponse, { name: string, slug: string }>(
      '/workspaces',
      { name: 'API Workspace', slug: 'api' },
    );

    expect(res.status()).toBe(422);
  });

  test('BK-4: POST /api/v1/workspaces rejects duplicate slug → 409', async ({ api }) => {
    api.setAuthToken(pat);

    // Create first
    const s = `ws-dup-${uid()}`;
    await api.apiPOST<WorkspaceResponse, { name: string, slug: string }>(
      '/workspaces',
      { name: `Dup Test ${uid()}`, slug: s },
    );

    // Same slug → 409
    const [res, body] = await api.apiPOST<ErrorResponse, { name: string, slug: string }>(
      '/workspaces',
      { name: `Dup Test ${uid()}`, slug: s },
    );

    expect(res.status()).toBe(409);
    expect(body.error.code).toBe('conflict');
  });

  // ===================== BK-8: Project =====================
  test('BK-8: POST /api/v1/workspaces/{id}/projects creates project → 201', async ({ api }) => {
    api.setAuthToken(pat);

    // Reuse the workspace created in the first test, or create one
    if (!wsId) {
      const slug = `ws-proj-${uid()}`;
      const [r, b] = await api.apiPOST<WorkspaceResponse, { name: string, slug: string }>(
        '/workspaces',
        { name: `Proj test ${uid()}`, slug },
      );
      expect(r.status()).toBe(201);
      wsId = b.workspace.id;
    }

    const [res, body] = await api.apiPOST<ProjectResponse, { name: string }>(
      `/workspaces/${wsId}/projects`,
      { name: `Project ${uid()}` },
    );

    expect(res.status()).toBe(201);
    expect(body.project).toBeDefined();
    expect(body.project.slug).toMatch(/^project-/);
    expect(body.project.workspace_id).toBe(wsId);
  });

  test('BK-8: POST /api/v1/workspaces/{id}/projects rejects name < 3 → 422', async ({ api }) => {
    api.setAuthToken(pat);

    const [res] = await api.apiPOST<ErrorResponse, { name: string }>(
      `/workspaces/${wsId}/projects`,
      { name: 'AB' },
    );

    expect(res.status()).toBe(422);
  });

  test('BK-8: POST /api/v1/workspaces/{id}/projects rejects duplicate slug → 409', async ({ api }) => {
    api.setAuthToken(pat);

    const projName = `DupProj ${uid()}`;
    await api.apiPOST<ProjectResponse, { name: string }>(
      `/workspaces/${wsId}/projects`,
      { name: projName },
    );

    const [res] = await api.apiPOST<ErrorResponse, { name: string }>(
      `/workspaces/${wsId}/projects`,
      { name: projName },
    );

    expect(res.status()).toBe(409);
  });

  test('BK-8: POST /api/v1/workspaces/{id}/projects rejects non-member → 403', async ({ api }) => {
    api.setAuthToken(pat);

    const [res] = await api.apiPOST<ErrorResponse, { name: string }>(
      '/workspaces/00000000-0000-0000-0000-000000000000/projects',
      { name: `NoAccess ${uid()}` },
    );

    expect(res.status()).toBe(403);
  });
});
