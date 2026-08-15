# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integration/auth/user-session.test.ts >> BK-166: User Session API >> BK-166: Unauthenticated request returns 401
- Location: tests/integration/auth/user-session.test.ts:24:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 200
```

# Test source

```ts
  1  | /**
  2  |  * KATA Architecture — User Session Integration Tests
  3  |  *
  4  |  * Validates authenticated user session via API.
  5  |  * Token is auto-loaded from api-state.json by ApiFixture.
  6  |  *
  7  |  * Project: integration (depends on api-setup)
  8  |  */
  9  | 
  10 | import { config, expect, test } from '@TestFixture';
  11 | 
  12 | test.describe('BK-166: User Session API', { tag: ['@api', '@critical'] }, () => {
  13 |   test('BK-166: Get current user with valid token from api-state.json', async ({ api }) => {
  14 |     const [response, userData] = await api.auth.getCurrentUser();
  15 | 
  16 |     expect(response.status()).toBe(200);
  17 |     expect(userData.user).toBeDefined();
  18 |     expect(userData.user.id).toBeDefined();
  19 |     expect(userData.user.email).toBeDefined();
  20 |     expect(userData.workspaces).toBeDefined();
  21 |     expect(userData.active_workspace_id).toBeDefined();
  22 |   });
  23 | 
  24 |   test('BK-166: Unauthenticated request returns 401', async ({ api }) => {
  25 |     api.clearAuthToken();
  26 | 
  27 |     const [response] = await api.auth.getCurrentUser();
  28 | 
> 29 |     expect(response.status()).toBe(401);
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  30 |     expect(response.ok()).toBe(false);
  31 |   });
  32 | 
  33 |   test('BK-166: Re-authenticate and obtain new token', async ({ api }) => {
  34 |     api.clearAuthToken();
  35 | 
  36 |     const credentials = {
  37 |       email: config.testUser.email,
  38 |       password: config.testUser.password,
  39 |     };
  40 | 
  41 |     const [response, tokenData] = await api.auth.authenticateSuccessfully(credentials);
  42 | 
  43 |     expect(response.status()).toBe(200);
  44 |     expect(tokenData.access_token).toBeDefined();
  45 |   });
  46 | 
  47 |   test('BK-166: Reject login with invalid credentials', async ({ api }) => {
  48 |     const credentials = {
  49 |       email: config.testUser.email,
  50 |       password: 'definitely-wrong-password',
  51 |     };
  52 | 
  53 |     const [response, errorBody] = await api.auth.loginWithInvalidCredentials(credentials);
  54 | 
  55 |     expect(response.status()).toBe(401);
  56 |     expect(errorBody.error.code).toBe('unauthorized');
  57 |   });
  58 | });
  59 | 
```