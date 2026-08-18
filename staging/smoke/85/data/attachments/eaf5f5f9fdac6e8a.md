# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integration/auth/user-session.test.ts >> BK-166: User Session API >> BK-166: Reject login with invalid credentials
- Location: tests/integration/auth/user-session.test.ts:47:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 200
```

# Test source

```ts
  38  |   // Helpers - Read-only operations (no @atc)
  39  |   // ============================================
  40  | 
  41  |   /**
  42  |    * Helper: Get current authenticated user info.
  43  |    *
  44  |    * Read-only GET — used as a verification step inside ATCs
  45  |    * or for test-level assertions. Not an ATC because it's
  46  |    * just a data retrieval, not a complete action flow.
  47  |    *
  48  |    * @returns Tuple with response and user info
  49  |    */
  50  |   @step
  51  |   async getCurrentUser(): Promise<[APIResponse, UserInfoResponse]> {
  52  |     const [response, body] = await this.apiGET<UserInfoResponse>(this.config.auth.meEndpoint);
  53  |     return [response, body];
  54  |   }
  55  | 
  56  |   // ============================================
  57  |   // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  58  |   // ============================================
  59  | 
  60  |   /**
  61  |    * ATC: Authenticate with valid credentials - expects success (200)
  62  |    *
  63  |    * Complete flow:
  64  |    * 1. POST credentials to /auth/signin (ACTION)
  65  |    * 2. GET /api/v1/me to confirm session is valid (VERIFICATION)
  66  |    * 3. Validate token response and user info
  67  |    *
  68  |    * The token is automatically set for subsequent API requests.
  69  |    *
  70  |    * @param credentials - Email and password
  71  |    * @returns Tuple with response, token data, and sent payload
  72  |    */
  73  |   @atc('BK-311', { vcr: { value: 5, cost: 2, risk: 4 } })
  74  |   async authenticateSuccessfully(
  75  |     credentials: LoginPayload,
  76  |   ): Promise<[APIResponse, TokenResponse, LoginPayload]> {
  77  |     // ACTION: POST login credentials to the sign-in endpoint
  78  |     const [response, body, sentPayload] = await this.apiPOST<SigninResponse, LoginPayload>(
  79  |       this.config.auth.loginEndpoint,
  80  |       credentials,
  81  |     );
  82  | 
  83  |     // Fixed assertions - validates successful authentication
  84  |     expect(response.status()).toBe(200);
  85  |     expect(body.session.access_token).toBeDefined();
  86  |     expect(body.session.token_type).toBe('bearer');
  87  |     expect(body.pat).toBeDefined();
  88  | 
  89  |     // Use PAT for API auth (session token does not auth /api/v1/* — BK-166 coexistence pattern)
  90  |     const tokenResponse: TokenResponse = {
  91  |       access_token: body.pat.token,
  92  |       token_type: 'bearer',
  93  |       expires_in: 86400,
  94  |     };
  95  | 
  96  |     // Store PAT for subsequent API requests
  97  |     this.setAuthToken(tokenResponse.access_token);
  98  | 
  99  |     // VERIFICATION: Confirm the session is valid via GET /api/v1/me
  100 |     const [meResponse, meBody] = await this.getCurrentUser();
  101 |     expect(meResponse.status()).toBe(200);
  102 |     expect(meBody.user).toBeDefined();
  103 |     expect(meBody.user.email).toBe(credentials.email);
  104 | 
  105 |     return [response, tokenResponse, sentPayload];
  106 |   }
  107 | 
  108 |   /**
  109 |    * ATC: Login with invalid credentials - expects error (401)
  110 |    *
  111 |    * Complete flow:
  112 |    * 1. POST invalid credentials to /auth/login (ACTION)
  113 |    * 2. GET /auth/me to confirm NO session was created (VERIFICATION)
  114 |    * 3. Validate error response and unauthorized access
  115 |    *
  116 |    * @param credentials - Invalid email or password
  117 |    * @returns Tuple with error response and sent payload
  118 |    */
  119 |   @atc('BK-312', { vcr: { value: 4, cost: 2, risk: 4 } })
  120 |   async loginWithInvalidCredentials(
  121 |     credentials: LoginPayload,
  122 |   ): Promise<[APIResponse, AuthErrorResponse, LoginPayload]> {
  123 |     // ACTION: POST invalid credentials
  124 |     const [response, body, sentPayload] = await this.apiPOST<AuthErrorResponse, LoginPayload>(
  125 |       this.config.auth.loginEndpoint,
  126 |       credentials,
  127 |     );
  128 | 
  129 |     // Fixed assertions - validates error response
  130 |     expect(response.status()).toBe(401);
  131 |     expect(response.ok()).toBe(false);
  132 |     expect(body.error.code).toBe('unauthorized');
  133 | 
  134 |     // VERIFICATION: Confirm no session was created via GET /api/v1/me → 401
  135 |     const savedToken = this.authToken;
  136 |     this.clearAuthToken();
  137 |     const [meResponse] = await this.getCurrentUser();
> 138 |     expect(meResponse.status()).toBe(401);
      |                                 ^ Error: expect(received).toBe(expected) // Object.is equality
  139 |     // Restore token if one existed before this ATC
  140 |     if (savedToken) {
  141 |       this.setAuthToken(savedToken);
  142 |     }
  143 | 
  144 |     return [response, body, sentPayload];
  145 |   }
  146 | }
  147 | 
```