import { config, expect, test } from '@TestFixture';

interface ImportCreateResponse {
  import_job_id: string
  status: string
}

interface ImportJobResponse {
  import_job: {
    id: string
    workspace_id: string
    project_id: string
    jql: string
    status: string
    imported_count: number
    created_count: number
    updated_count: number
    errors: Array<{ code: string, message: string }>
  }
}

const pat = config.testUser.pat!;
const projectId = '1a6fdae6-8b0c-47bb-b444-0e2563deab4b';

test.describe('BK-17: Jira Import API', { tag: ['@api', '@import'] }, () => {
  test('BK-169: POST /api/v1/imports with valid project_id + jql returns 202 + job_id', async ({ api }) => {
    api.setAuthToken(pat);

    const [res, body] = await api.apiPOST<ImportCreateResponse, { project_id: string, jql: string }>(
      '/imports',
      { project_id: projectId, jql: 'project = DEMO' },
    );

    expect(res.status()).toBe(202);
    expect(body.import_job_id).toBeDefined();
    expect(body.import_job_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.status).toBe('queued');
  });

  test('BK-169: GET /api/v1/imports/{id} returns job status', async ({ api }) => {
    api.setAuthToken(pat);

    // Create an import job first
    const [, created] = await api.apiPOST<ImportCreateResponse, { project_id: string, jql: string }>(
      '/imports',
      { project_id: projectId, jql: 'project = DEMO' },
    );

    const [res, body] = await api.apiGET<ImportJobResponse>(`/imports/${created.import_job_id}`);

    expect(res.status()).toBe(200);
    expect(body.import_job.id).toBe(created.import_job_id);
    expect(['queued', 'processing', 'completed', 'failed']).toContain(body.import_job.status);
  });

  test('BK-173: POST /api/v1/imports rejects empty body → 422', async ({ api }) => {
    api.setAuthToken(pat);

    const [res, body] = await api.apiPOST<{ error: { code: string } }, Record<string, never>>(
      '/imports',
      {},
    );

    expect(res.status()).toBe(422);
    expect(body.error.code).toBe('validation_failed');
  });

  test('BK-173: POST /api/v1/imports rejects missing jql → 422', async ({ api }) => {
    api.setAuthToken(pat);

    const [res] = await api.apiPOST<{ error: { code: string } }, { project_id: string }>(
      '/imports',
      { project_id: projectId },
    );

    expect(res.status()).toBe(422);
  });

  test('BK-173: POST /api/v1/imports rejects missing project_id → 422', async ({ api }) => {
    api.setAuthToken(pat);

    const [res] = await api.apiPOST<{ error: { code: string } }, { jql: string }>(
      '/imports',
      { jql: 'project = DEMO' },
    );

    expect(res.status()).toBe(422);
  });

  test('BK-171: POST /api/v1/imports returns 401 without auth', async ({ api }) => {
    const saved = api.authToken;
    api.clearAuthToken();

    const [res] = await api.apiPOST<{ error: { code: string } }, { project_id: string, jql: string }>(
      '/imports',
      { project_id: projectId, jql: 'project = DEMO' },
    );

    expect(res.status()).toBe(401);
    if (saved) { api.setAuthToken(saved); }
  });
});
