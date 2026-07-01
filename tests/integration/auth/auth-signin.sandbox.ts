import { config, expect, test } from '@TestFixture';

interface SignInResponse {
  user: { id: string, email: string }
  session: {
    access_token: string
    refresh_token: string
    expires_at: number
    token_type: string
  }
  pat: {
    token: string
    id: string
    name: string
    scopes: string[]
    expires_at: string | null
  }
  warning?: string
}

interface CheckEmailResponse {
  exists: boolean
  confirmed: boolean
}

interface UserInfoResponse {
  user: { id: string, email: string }
  workspaces: Array<{ id: string, slug: string, name: string }>
  active_workspace_id: string
  active_workspace_role: string
  auth: { source: string, scopes: string[] }
}

test.describe('BK-166: Auth email+password sign-in API', { tag: ['@api', '@auth', '@critical'] }, () => {
  test('BK-166: POST /api/v1/auth/signin with valid credentials returns user+session+PAT', async ({ api }) => {
    const [response, body] = await api.apiPOST<SignInResponse, { email: string, password: string }>(
      '/auth/signin',
      { email: config.testUser.email, password: config.testUser.password },
    );

    expect(response.status()).toBe(200);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(config.testUser.email);
    expect(body.session.access_token).toBeDefined();
    expect(body.session.token_type).toBe('bearer');
    expect(body.pat).toBeDefined();
    expect(body.pat.token).toMatch(/^bk_pat_/);
    expect(body.pat.scopes).toContain('atc:read');
  });

  test('BK-166: POST /api/v1/auth/signin with wrong password returns 401', async ({ api }) => {
    const [response] = await api.apiPOST<{ error: string }, { email: string, password: string }>(
      '/auth/signin',
      { email: config.testUser.email, password: 'wrong-password-999' },
    );

    expect(response.status()).toBe(401);
  });

  test('BK-166: POST /api/v1/auth/signin with non-existent email returns 401', async ({ api }) => {
    const [response] = await api.apiPOST<{ error: string }, { email: string, password: string }>(
      '/auth/signin',
      { email: 'nonexistent@bunkai-testing.io', password: 'some-password' },
    );

    expect(response.status()).toBe(401);
  });

  test('BK-166: POST /api/v1/auth/check-email returns exists+confirmed for existing user', async ({ api }) => {
    const [response, body] = await api.apiPOST<CheckEmailResponse, { email: string }>(
      '/auth/check-email',
      { email: config.testUser.email },
    );

    expect(response.status()).toBe(200);
    expect(body.exists).toBe(true);
    expect(body.confirmed).toBe(true);
  });

  test('BK-166: POST /api/v1/auth/check-email returns exists=false for unknown email', async ({ api }) => {
    const [response, body] = await api.apiPOST<CheckEmailResponse, { email: string }>(
      '/auth/check-email',
      { email: 'unknown@bunkai-testing.io' },
    );

    expect(response.status()).toBe(200);
    expect(body.exists).toBe(false);
    expect(body.confirmed).toBe(false);
  });

  test('BK-166: GET /api/v1/me returns user info with valid PAT token', async ({ api }) => {
    api.setAuthToken(config.testUser.pat!);

    const [response, body] = await api.apiGET<UserInfoResponse>('/me');

    expect(response.status()).toBe(200);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(config.testUser.email);
    expect(body.workspaces).toBeDefined();
    expect(body.active_workspace_id).toBeDefined();
  });

  test('BK-166: GET /api/v1/me returns 401 without auth', async ({ api }) => {
    const saved = api.authToken;
    api.clearAuthToken();

    const [response] = await api.apiGET<{ error: string }>('/me');

    expect(response.status()).toBe(401);
    if (saved) { api.setAuthToken(saved); }
  });

  test('BK-166: signin PAT can be used to authenticate subsequent API calls', async ({ api }) => {
    // Sign in to get a fresh PAT
    const [signinResponse, signinBody] = await api.apiPOST<SignInResponse, { email: string, password: string }>(
      '/auth/signin',
      { email: config.testUser.email, password: config.testUser.password },
    );
    expect(signinResponse.status()).toBe(200);

    // Use the returned PAT for subsequent calls
    api.setAuthToken(signinBody.pat.token);

    const [meResponse, meBody] = await api.apiGET<UserInfoResponse>('/me');
    expect(meResponse.status()).toBe(200);
    expect(meBody.user.email).toBe(config.testUser.email);
  });
});
