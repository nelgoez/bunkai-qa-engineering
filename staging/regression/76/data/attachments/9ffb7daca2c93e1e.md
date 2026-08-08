# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integration/jira-import/jira-import.sandbox.ts >> BK-17: Jira Import API >> BK-169: POST /api/v1/imports with valid project_id + jql returns 202 + job_id
- Location: tests/integration/jira-import/jira-import.sandbox.ts:28:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 202
Received: 409
```

# Test source

```ts
  1   | import { config, expect, test } from '@TestFixture';
  2   | 
  3   | interface ImportCreateResponse {
  4   |   import_job_id: string
  5   |   status: string
  6   | }
  7   | 
  8   | interface ImportJobResponse {
  9   |   import_job: {
  10  |     id: string
  11  |     workspace_id: string
  12  |     project_id: string
  13  |     jql: string
  14  |     status: string
  15  |     imported_count: number
  16  |     created_count: number
  17  |     updated_count: number
  18  |     errors: Array<{ code: string, message: string }>
  19  |   }
  20  | }
  21  | 
  22  | let jobId: string;
  23  | 
  24  | const pat = config.testUser.pat!;
  25  | const projectId = '1a6fdae6-8b0c-47bb-b444-0e2563deab4b';
  26  | 
  27  | test.describe.serial('BK-17: Jira Import API', { tag: ['@api', '@import'] }, () => {
  28  |   test('BK-169: POST /api/v1/imports with valid project_id + jql returns 202 + job_id', async ({ api }) => {
  29  |     api.setAuthToken(pat);
  30  | 
  31  |     const [res, body] = await api.apiPOST<ImportCreateResponse, { project_id: string, jql: string }>(
  32  |       '/imports',
  33  |       { project_id: projectId, jql: `project = DEMO AND description ~ ${Date.now()}` },
  34  |     );
  35  | 
> 36  |     expect(res.status()).toBe(202);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  37  |     expect(body.import_job_id).toBeDefined();
  38  |     expect(body.import_job_id).toMatch(/^[0-9a-f-]{36}$/);
  39  |     expect(body.status).toBe('queued');
  40  |     jobId = body.import_job_id;
  41  |   });
  42  | 
  43  |   test('BK-169: GET /api/v1/imports/{id} returns job status', async ({ api }) => {
  44  |     api.setAuthToken(pat);
  45  | 
  46  |     const [res, body] = await api.apiGET<ImportJobResponse>(`/imports/${jobId}`);
  47  | 
  48  |     expect(res.status()).toBe(200);
  49  |     expect(body.import_job.id).toBe(jobId);
  50  |     expect(['queued', 'processing', 'running', 'completed', 'failed']).toContain(body.import_job.status);
  51  |   });
  52  | 
  53  |   test('BK-173: POST /api/v1/imports rejects empty body → 422', async ({ api }) => {
  54  |     api.setAuthToken(pat);
  55  | 
  56  |     const [res, body] = await api.apiPOST<{ error: { code: string } }, Record<string, never>>(
  57  |       '/imports',
  58  |       {},
  59  |     );
  60  | 
  61  |     expect(res.status()).toBe(422);
  62  |     expect(body.error.code).toBe('validation_failed');
  63  |   });
  64  | 
  65  |   test('BK-173: POST /api/v1/imports rejects missing jql → 422', async ({ api }) => {
  66  |     api.setAuthToken(pat);
  67  | 
  68  |     const [res] = await api.apiPOST<{ error: { code: string } }, { project_id: string }>(
  69  |       '/imports',
  70  |       { project_id: projectId },
  71  |     );
  72  | 
  73  |     expect(res.status()).toBe(422);
  74  |   });
  75  | 
  76  |   test('BK-173: POST /api/v1/imports rejects missing project_id → 422', async ({ api }) => {
  77  |     api.setAuthToken(pat);
  78  | 
  79  |     const [res] = await api.apiPOST<{ error: { code: string } }, { jql: string }>(
  80  |       '/imports',
  81  |       { jql: 'project = DEMO' },
  82  |     );
  83  | 
  84  |     expect(res.status()).toBe(422);
  85  |   });
  86  | 
  87  |   test('BK-171: POST /api/v1/imports returns 401 without auth', async ({ api }) => {
  88  |     const saved = api.authToken;
  89  |     api.clearAuthToken();
  90  | 
  91  |     const [res] = await api.apiPOST<{ error: { code: string } }, { project_id: string, jql: string }>(
  92  |       '/imports',
  93  |       { project_id: projectId, jql: 'project = DEMO' },
  94  |     );
  95  | 
  96  |     expect(res.status()).toBe(401);
  97  |     if (saved) { api.setAuthToken(saved); }
  98  |   });
  99  | });
  100 | 
```