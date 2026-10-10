import type { WorkspaceResponse } from '@schemas/workspace.types';

import { DataFactory } from '@DataFactory';
import { config, expect, test } from '@TestFixture';

const uid = () => Date.now().toString(36);
const pat = config.testUser.pat!;

test.describe('BK-4/BK-8: Workspace & Project CRUD API', { tag: ['@api', '@critical'] }, () => {
  let wsSlug: string;
  let wsId: string;

  test('BK-4: POST /workspaces creates workspace with name+slug → 201', async ({ api }) => {
    api.setAuthToken(pat);
    wsSlug = `ws-auto-${uid()}`;

    const [response, workspace] = await api.workspaces.createWorkspaceSuccessfully({
      name: `Workspace ${uid()}`,
      slug: wsSlug,
    });

    expect(response.status()).toBe(201);
    expect(workspace.slug).toBe(wsSlug);
    expect(workspace.name).toMatch(/^Workspace /);
    expect(workspace.owner_user_id).toBeDefined();
    expect(workspace.plan).toBe('community');

    wsId = workspace.id;
  });

  test('BK-4: POST /workspaces rejects name < 3 chars → 422', async ({ api }) => {
    api.setAuthToken(pat);

    const [response] = await api.workspaces.createWorkspaceNameTooShort({
      name: 'AB',
      slug: 'ab',
    });

    expect(response.status()).toBe(422);
  });

  test('BK-4: POST /workspaces rejects reserved slug → 422', async ({ api }) => {
    api.setAuthToken(pat);

    const [response] = await api.workspaces.createWorkspaceReservedSlug({
      name: 'API Workspace',
      slug: 'api',
    });

    expect(response.status()).toBe(422);
  });

  test('BK-4: POST /workspaces rejects duplicate slug → 409', async ({ api }) => {
    api.setAuthToken(pat);

    const s = `ws-dup-${uid()}`;
    await api.workspaces.createWorkspaceSuccessfully({
      name: `Dup Test ${uid()}`,
      slug: s,
    });

    const [response, errBody] = await api.workspaces.createWorkspaceDuplicateSlug({
      name: `Dup Test ${uid()}`,
      slug: s,
    });

    expect(response.status()).toBe(409);
    expect(errBody.error.code).toBe('conflict');
  });

  test('BK-4: POST /workspaces rejects unauthenticated → 401', async ({ api }) => {
    const [response] = await api.workspaces.createWorkspaceUnauthenticated({
      name: 'No Auth',
      slug: `ws-noauth-${uid()}`,
    });

    expect(response.status()).toBe(401);
  });

  test('BK-8: POST /workspaces/{id}/projects creates project → 201', async ({ api }) => {
    api.setAuthToken(pat);

    if (!wsId) {
      const slug = `ws-proj-${uid()}`;
      const [, workspace] = await api.workspaces.createWorkspaceSuccessfully({
        name: `Proj test ${uid()}`,
        slug,
      });
      wsId = workspace.id;
    }

    const [response, project] = await api.projects.createProjectSuccessfully(wsId, {
      name: `Project ${uid()}`,
    });

    expect(response.status()).toBe(201);
    expect(project.slug).toMatch(/^project-/);
    expect(project.workspace_id).toBe(wsId);
  });

  test('BK-8: POST /workspaces/{id}/projects rejects name < 3 → 422', async ({ api }) => {
    api.setAuthToken(pat);

    const [response] = await api.projects.createProjectNameTooShort(wsId, {
      name: 'AB',
    });

    expect(response.status()).toBe(422);
  });

  test('BK-8: POST /workspaces/{id}/projects rejects duplicate name → 409', async ({ api }) => {
    api.setAuthToken(pat);

    const projName = `DupProj ${uid()}`;
    await api.projects.createProjectSuccessfully(wsId, { name: projName });

    const [response] = await api.projects.createProjectDuplicateName(wsId, { name: projName });

    expect(response.status()).toBe(409);
  });

  test('BK-8: POST /workspaces/{id}/projects rejects non-member → 403', async ({ api }) => {
    api.setAuthToken(pat);

    const [response] = await api.projects.createProjectNonMember(
      DataFactory.SENTINEL.nonExistent,
      { name: `NoAccess ${uid()}` },
    );

    expect(response.status()).toBe(403);
  });

  test('BK-4: DB persistence — created workspace appears in GET /workspaces list', async ({ api }) => {
    api.setAuthToken(pat);

    const [, workspace] = await api.workspaces.createWorkspaceSuccessfully({
      name: `DB-Persist ${uid()}`,
      slug: `ws-db-${uid()}`,
    });

    const [listResponse, body] = await api.apiGET<{ workspaces: WorkspaceResponse[] }>('/workspaces');

    expect(listResponse.status()).toBe(200);
    expect(body.workspaces).toBeDefined();
    expect(body.workspaces.some((ws: WorkspaceResponse) => ws.id === workspace.id)).toBe(true);
    expect(body.workspaces.some((ws: WorkspaceResponse) => ws.slug === workspace.slug)).toBe(true);
  });
});
