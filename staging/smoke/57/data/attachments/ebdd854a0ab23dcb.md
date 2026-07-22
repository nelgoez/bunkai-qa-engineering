# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: setup/ui-auth.setup.ts >> UI Setup: authenticate via UI
- Location: tests/setup/ui-auth.setup.ts:36:1

# Error details

```
TimeoutError: locator.fill: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-testid="login-email-input"]')

```

```
Error: page.waitForResponse: Test ended.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]: BUNKAI · TMS
        - generic [ref=e6]: v0.1.0 · self-hosted-ready
      - generic [ref=e7]:
        - generic [ref=e8]:
          - generic [ref=e9]:
            - generic [ref=e10]: 分
            - generic [ref=e12]: 解
          - generic [ref=e13]:
            - generic [ref=e14]: BUN · KAI
            - generic [ref=e15]: The martial-arts practice of decomposing a kata into its real combat applications.
            - generic [ref=e16]: Bunkai is the real Japanese martial-arts term — not the anime word.
        - heading "A test management system that decomposes user stories into executable Acceptance Test Cases." [level=1] [ref=e17]:
          - text: A test management system that
          - text: decomposes user stories into
          - text: executable Acceptance Test Cases.
        - paragraph [ref=e18]:
          - text: Built around the
          - strong [ref=e19]: IQL
          - text: methodology and the
          - strong [ref=e20]: KATA
          - text: architecture — for QA engineers who think in reusable test cases, not freeform steps. Manual, agentic, and CI execution converge on the same source of truth.
        - list [ref=e21]:
          - listitem [ref=e22]:
            - generic [ref=e23]: IQL
            - generic [ref=e24]: Integrated Quality Lifecycle — methodology that spans story → case → run → bug.
          - listitem [ref=e25]:
            - generic [ref=e26]: ATC
            - generic [ref=e27]: Acceptance Test Case — one observable behaviour, executable by humans or agents.
          - listitem [ref=e28]:
            - generic [ref=e29]: KATA
            - generic [ref=e30]: Komponent Action Test Architecture — how ATCs assemble into a real automated test.
          - listitem [ref=e31]:
            - generic [ref=e32]: ×3
            - generic [ref=e33]: Manual · Agentic · CI execution. Same schema, same reports.
          - listitem [ref=e34]:
            - generic [ref=e35]: OSS
            - generic [ref=e36]: Apache-2.0. Self-host with one docker compose, or use Cloud.
      - generic [ref=e37]:
        - generic [ref=e38]:
          - generic [ref=e39]: $ docker compose up
          - generic [ref=e40]: ·
          - generic [ref=e41]: github.com/bunkai-tms
          - generic [ref=e42]: ·
          - generic [ref=e43]: docs
        - generic [ref=e44]: Apache-2.0 · © Bunkai contributors
    - generic [ref=e46]:
      - generic [ref=e47]:
        - generic [ref=e48]: Sign in
        - heading "Continue to your workspace" [level=2] [ref=e49]
        - paragraph [ref=e50]: Sign in with your email and password, continue with GitHub or Google, or create an account.
      - generic [ref=e51]:
        - generic [ref=e52]:
          - generic [ref=e53]: Email
          - textbox "Email" [ref=e54]:
            - /placeholder: qa@your-org.dev
        - button "Continue" [disabled]:
          - text: Continue
          - img
      - generic [ref=e55]: OR
      - button "Email me a link instead" [ref=e59] [cursor=pointer]:
        - text: Email me a link instead
        - img [ref=e60]
      - generic [ref=e62]:
        - button "Continue with GitHub" [ref=e63] [cursor=pointer]:
          - img [ref=e64]
          - text: Continue with GitHub
        - button "Continue with Google" [ref=e66] [cursor=pointer]:
          - img [ref=e67]
          - text: Continue with Google
      - generic [ref=e73]:
        - generic [ref=e74]:
          - img [ref=e75]
          - generic [ref=e77]:
            - generic [ref=e78]: Self-hosted instance
            - generic [ref=e79]: Connect to your own Bunkai server (Community edition)
        - img [ref=e80]
      - generic [ref=e82]: Open-source, self-hostable, Apache-2.0. Your test specifications stay on your servers — Bunkai never reaches for the cloud unless you tell it to.
  - region "Notifications alt+T"
  - alert [ref=e83]
```

# Test source

```ts
  1   | /**
  2   |  * KATA Architecture - UI Auth Setup
  3   |  *
  4   |  * Authenticates via the login page UI and intercepts the JWT token
  5   |  * using page.waitForResponse() - single authentication, no separate API call.
  6   |  *
  7   |  * This provides BOTH:
  8   |  * - Browser session (storageState) for UI tests
  9   |  * - API token (intercepted) for API calls within E2E tests
  10  |  *
  11  |  * Dependencies: global-setup
  12  |  * Dependents: e2e
  13  |  */
  14  | 
  15  | import type { ApiState } from '@data/types';
  16  | import type { TokenResponse } from '@schemas/auth.types';
  17  | 
  18  | import { writeFileSync } from 'node:fs';
  19  | import { test as setup } from '@TestFixture';
  20  | import { attachRequestResponseToAllure } from '@utils/allure';
  21  | import { config } from '@variables';
  22  | 
  23  | const storageStateFile = config.auth.storageStatePath;
  24  | const apiStateFile = config.auth.apiStatePath;
  25  | 
  26  | /**
  27  |  * UI Authentication Setup
  28  |  *
  29  |  * 1. Navigates to login page (via LoginPage.goto())
  30  |  * 2. Sets up response interception BEFORE triggering login
  31  |  * 3. Uses LoginPage.loginSuccessfully() ATC (triggers login + token fetch)
  32  |  * 4. Captures JWT token from intercepted response
  33  |  * 5. Saves storageState (cookies) for UI tests
  34  |  * 6. Saves api-state (token) for API integration
  35  |  */
  36  | setup('UI Setup: authenticate via UI', async ({ ui, page }) => {
  37  |   console.log('[UI Setup] Starting UI authentication...');
  38  |   console.log('[UI Setup] Target: /login');
  39  | 
  40  |   // Navigate to login page (outside of ATC)
  41  |   await ui.login.goto();
  42  | 
  43  |   // Credentials for login
  44  |   const credentials = {
  45  |     email: config.testUser.email,
  46  |     password: config.testUser.password,
  47  |   };
  48  | 
  49  |   // Set up response interception BEFORE triggering login
  50  |   // The login UI calls /api/auth/login after successful NextAuth sign-in
> 51  |   const tokenPromise = page.waitForResponse(
      |                             ^ Error: page.waitForResponse: Test ended.
  52  |     resp => resp.url().includes(config.auth.tokenEndpoint)
  53  |       && resp.request().method() === 'POST'
  54  |       && resp.status() === 200,
  55  |     { timeout: 30000 },
  56  |   );
  57  | 
  58  |   // Use LoginPage ATC - triggers NextAuth sign-in + token fetch
  59  |   await ui.login.loginSuccessfully(credentials);
  60  |   console.log('[UI Setup] UI login successful');
  61  | 
  62  |   // Capture JWT token from intercepted response
  63  |   console.log('[UI Setup] Intercepting token from login response...');
  64  |   const response = await tokenPromise;
  65  |   const tokenData = (await response.json()) as TokenResponse;
  66  | 
  67  |   // Attach to Allure for debugging
  68  |   await attachRequestResponseToAllure({
  69  |     url: response.url(),
  70  |     method: 'POST',
  71  |     responseBody: tokenData,
  72  |     requestBody: { email: credentials.email, password: '***' },
  73  |   });
  74  | 
  75  |   // Verify token was obtained
  76  |   if (!tokenData?.access_token) {
  77  |     throw new Error('Token response missing access_token');
  78  |   }
  79  | 
  80  |   console.log('[UI Setup] Token intercepted successfully');
  81  | 
  82  |   // Save storage state (cookies + localStorage) for UI tests
  83  |   await page.context().storageState({ path: storageStateFile });
  84  |   console.log(`[UI Setup] Storage state saved to ${storageStateFile}`);
  85  | 
  86  |   // Save the token for API calls within E2E tests
  87  |   const apiState: ApiState = {
  88  |     token: tokenData.access_token,
  89  |     tokenType: tokenData.token_type,
  90  |     expiresIn: tokenData.expires_in,
  91  |     refreshToken: tokenData.refresh_token ?? null,
  92  |     source: 'ui-login',
  93  |     createdAt: new Date().toISOString(),
  94  |   };
  95  | 
  96  |   writeFileSync(apiStateFile, JSON.stringify(apiState, null, 2));
  97  |   console.log(`[UI Setup] API token saved to ${apiStateFile}`);
  98  | 
  99  |   console.log('[UI Setup] Authentication successful');
  100 |   console.log(`[UI Setup] Current URL: ${page.url()}`);
  101 | });
  102 | 
```