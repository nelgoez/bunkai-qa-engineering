# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integration/atc/atc-create-edit.test.ts >> BK-18: ATC Create/Edit REST API >> BK-150: POST /atcs rejects unauthenticated request with 401
- Location: tests/integration/atc/atc-create-edit.test.ts:82:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 201
```

# Test source

```ts
  1   | import type { APIError, ATCCreatePayload } from '@schemas/atc.types';
  2   | 
  3   | import { DataFactory } from '@DataFactory';
  4   | import { config, expect, test } from '@TestFixture';
  5   | 
  6   | const getPat = () => config.testUser.pat ?? '';
  7   | 
  8   | function buildValidPayload(overrides?: Partial<ATCCreatePayload>): ATCCreatePayload {
  9   |   return {
  10  |     title: 'Login with valid email',
  11  |     module_id: config.seed.module.id,
  12  |     user_story_id: config.seed.userStory.id,
  13  |     acceptance_criterion_ids: [config.seed.acceptanceCriterion.id],
  14  |     layer: 'UI',
  15  |     steps: [
  16  |       { position: 1, content: 'Navigate to login page' },
  17  |       { position: 2, content: 'Enter email test@example.com' },
  18  |       { position: 3, content: 'Click submit' },
  19  |     ],
  20  |     assertions: [
  21  |       { content: 'Response time < 2s' },
  22  |     ],
  23  |     tags: ['smoke', 'login'],
  24  |     ...overrides,
  25  |   };
  26  | }
  27  | 
  28  | function buildPatchPayload(created: { module_id: string, user_story_id: string, acceptance_criterion_ids: string[], layer: 'UI' | 'API' | 'Unit' }, ts: number) {
  29  |   return {
  30  |     title: `Patched ATC ${ts}`,
  31  |     module_id: created.module_id,
  32  |     user_story_id: created.user_story_id,
  33  |     acceptance_criterion_ids: created.acceptance_criterion_ids,
  34  |     layer: created.layer,
  35  |     steps: [
  36  |       { position: 1, content: 'Updated step 1' },
  37  |       { position: 2, content: 'Updated step 2' },
  38  |     ],
  39  |     assertions: [],
  40  |     tags: ['patched'],
  41  |   };
  42  | }
  43  | 
  44  | test.describe('BK-18: ATC Create/Edit REST API', { tag: ['@api', '@atc', '@critical'] }, () => {
  45  |   // ============================================
  46  |   // TC01 — BK-149: POST /atcs creates ATC
  47  |   // ============================================
  48  |   test('BK-149: POST /atcs creates an ATC with steps, assertions, slug and version 1', async ({ api }) => {
  49  |     api.setAuthToken(getPat());
  50  | 
  51  |     const payload = buildValidPayload();
  52  |     const [response, body] = await api.atcs.createAtcSuccessfully(payload);
  53  | 
  54  |     expect(response.status()).toBe(201);
  55  |     expect(body.id).toBeDefined();
  56  |     expect(body.slug).toMatch(/^[a-z0-9-]+\/atc-[a-z0-9]{8}$/);
  57  |     expect(body.version).toBe(1);
  58  |     expect(body.title).toBe(payload.title);
  59  |     expect(body.layer).toBe('UI');
  60  |     expect(body.steps).toHaveLength(3);
  61  |     expect(body.steps[0].position).toBe(1);
  62  |     expect(body.steps[1].position).toBe(2);
  63  |     expect(body.steps[2].position).toBe(3);
  64  |     expect(body.assertions).toHaveLength(1);
  65  |     expect(body.tags).toContain('smoke');
  66  |   });
  67  | 
  68  |   test('BK-149: POST /atcs works for all layer values (UI, API, Unit)', async ({ api }) => {
  69  |     api.setAuthToken(getPat());
  70  | 
  71  |     for (const layer of ['UI', 'API', 'Unit'] as const) {
  72  |       const payload = buildValidPayload({ layer, title: `ATC layer ${layer} ${Date.now()}` });
  73  |       const [response, body] = await api.atcs.createAtcSuccessfully(payload);
  74  |       expect(response.status()).toBe(201);
  75  |       expect(body.layer).toBe(layer);
  76  |     }
  77  |   });
  78  | 
  79  |   // ============================================
  80  |   // TC02 — BK-150: Auth rejection (401 + 403)
  81  |   // ============================================
  82  |   test('BK-150: POST /atcs rejects unauthenticated request with 401', async ({ api }) => {
  83  |     const payload = buildValidPayload();
  84  |     const savedToken = api.authToken;
  85  |     api.clearAuthToken();
  86  | 
  87  |     const [response] = await api.apiPOST<APIError, ATCCreatePayload>('/atcs', payload);
  88  | 
> 89  |     expect(response.status()).toBe(401);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  90  |     if (savedToken) {
  91  |       api.setAuthToken(savedToken);
  92  |     }
  93  |   });
  94  | 
  95  |   test('BK-150: POST /atcs rejects invalid token with 401', async ({ api }) => {
  96  |     api.setAuthToken('invalid-token');
  97  | 
  98  |     const payload = buildValidPayload({ title: `Invalid token test ${Date.now()}` });
  99  |     const [response] = await api.apiPOST<APIError, ATCCreatePayload>('/atcs', payload);
  100 | 
  101 |     expect(response.status()).toBe(401);
  102 | 
  103 |     api.setAuthToken(getPat());
  104 |   });
  105 | 
  106 |   test('BK-150: POST /atcs rejects token lacking atc:write scope with 403', async ({ api }) => {
  107 |     const readonlyPat = config.testUser.readonlyPat;
  108 |     if (!readonlyPat) {
  109 |       test.skip(true, 'STAGING_USER_READONLY_PAT not configured — cannot test 403 scope rejection');
  110 |       return;
  111 |     }
  112 |     api.setAuthToken(readonlyPat);
  113 | 
  114 |     const payload = buildValidPayload({ title: `Readonly token test ${Date.now()}` });
  115 |     const [response, errBody] = await api.apiPOST<APIError, ATCCreatePayload>('/atcs', payload);
  116 | 
  117 |     expect(response.status()).toBe(403);
  118 |     expect(errBody.error?.code).toBe('forbidden');
  119 |   });
  120 | 
  121 |   // ============================================
  122 |   // TC03 — BK-151: AC outside user_story → 422
  123 |   // ============================================
  124 |   test('BK-151: POST /atcs rejects AC that belongs to a different user story with 422', async ({ api }) => {
  125 |     api.setAuthToken(getPat());
  126 | 
  127 |     // This AC belongs to a DIFFERENT user story than the one in the payload
  128 |     const foreignAcId = DataFactory.SENTINEL.foreignAtc;
  129 |     const payload = buildValidPayload({
  130 |       title: `Foreign AC test ${Date.now()}`,
  131 |       acceptance_criterion_ids: [foreignAcId],
  132 |     });
  133 | 
  134 |     const [_response, _errBody] = await api.atcs.createAtcWithAcOutsideUserStory(payload);
  135 |   });
  136 | 
  137 |   // ============================================
  138 |   // TC04 — BK-152: Module outside subtree → 422
  139 |   // ============================================
  140 |   test('BK-152: POST /atcs rejects module outside user story subtree with 422', async ({ api }) => {
  141 |     api.setAuthToken(getPat());
  142 | 
  143 |     // Non-existent module_id returns 404 (not found), not 422.
  144 |     // For a real 422 we'd need a module that exists but is outside the
  145 |     // user_story's project subtree — that requires dynamic discovery.
  146 |     const fakeModuleId = DataFactory.SENTINEL.nonExistent;
  147 |     const payload = buildValidPayload({
  148 |       title: `Fake module test ${Date.now()}`,
  149 |       module_id: fakeModuleId,
  150 |     });
  151 | 
  152 |     const [_response, _errBody] = await api.atcs.createAtcWithModuleOutsideSubtree(payload);
  153 |   });
  154 | 
  155 |   // ============================================
  156 |   // TC05 — BK-153: Step position validation (422)
  157 |   // ============================================
  158 |   test('BK-153: POST /atcs rejects steps with non-increasing positions', async ({ api }) => {
  159 |     api.setAuthToken(getPat());
  160 | 
  161 |     const invalidPositionSets = [
  162 |       { positions: [1, 3, 2], desc: 'not increasing' },
  163 |       { positions: [2, 3, 4], desc: 'does not start at 1' },
  164 |       { positions: [1, 1, 2], desc: 'not strictly increasing' },
  165 |       { positions: [0, 1, 2], desc: 'starts at 0' },
  166 |     ];
  167 | 
  168 |     for (const { positions, desc } of invalidPositionSets) {
  169 |       const payload = buildValidPayload({
  170 |         title: `Invalid ${desc} ${Date.now()}`,
  171 |         steps: positions.map((p, i) => ({ position: p, content: `Step ${i + 1}` })),
  172 |       });
  173 | 
  174 |       const [_response, _errBody] = await api.atcs.createAtcWithInvalidStepPosition(payload);
  175 |     }
  176 | 
  177 |     const goodPayload = buildValidPayload({
  178 |       title: `Valid steps ${Date.now()}`,
  179 |       steps: [{ position: 1, content: 'Step 1' }, { position: 2, content: 'Step 2' }],
  180 |     });
  181 |     const [response] = await api.atcs.createAtcSuccessfully(goodPayload);
  182 |     expect(response.status()).toBe(201);
  183 |   });
  184 | 
  185 |   // ============================================
  186 |   // TC06 — BK-154: Body boundary validation (422)
  187 |   // ============================================
  188 |   test('BK-154: POST /atcs validates request body boundaries', async ({ api }) => {
  189 |     api.setAuthToken(getPat());
```