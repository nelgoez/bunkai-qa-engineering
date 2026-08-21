# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integration/tests/test-builder.test.ts >> BK-27: Test Builder API >> BK-310: POST /tests rejects unauthenticated request with 401
- Location: tests/integration/tests/test-builder.test.ts:181:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 400
```

# Test source

```ts
  38  | 
  39  |     const testEntity = body.test;
  40  |     expect(testEntity.id).toBeDefined();
  41  |     expect(testEntity.title).toBe(payload.title);
  42  |     expect(testEntity.steps).toBeDefined();
  43  |     expect(testEntity.steps).toHaveLength(payload.atc_ids.length);
  44  | 
  45  |     for (const [index, ref] of testEntity.steps.entries()) {
  46  |       expect(ref.atc_id).toBe(payload.atc_ids[index]);
  47  |       expect(ref.position).toBe(index + 1);
  48  |     }
  49  | 
  50  |     expect(testEntity.workspace_id).toBe(payload.workspace_id);
  51  |     expect(testEntity.created_by).toBeDefined();
  52  |     expect(testEntity.created_at).toBeDefined();
  53  | 
  54  |     return [response, testEntity, sent];
  55  |   }
  56  | 
  57  |   @atc('BK-306', { vcr: { value: 3, cost: 1, risk: 2 } })
  58  |   async createTestEmptyChain(
  59  |     payload: TestCreatePayload,
  60  |   ): Promise<[APIResponse, APIError, TestCreatePayload]> {
  61  |     const [response, body, sent] = await this.apiPOST<APIError, TestCreatePayload>(
  62  |       this.testsEndpoint,
  63  |       payload,
  64  |       { headers: this.idempotencyHeaders() },
  65  |     );
  66  | 
  67  |     expect(response.status()).toBe(422);
  68  |     expect(body.error?.code).toBeDefined();
  69  | 
  70  |     return [response, body, sent];
  71  |   }
  72  | 
  73  |   @atc('BK-307', { vcr: { value: 3, cost: 1, risk: 2 } })
  74  |   async createTestWithInvalidTitle(
  75  |     payload: TestCreatePayload,
  76  |   ): Promise<[APIResponse, APIError, TestCreatePayload]> {
  77  |     const [response, body, sent] = await this.apiPOST<APIError, TestCreatePayload>(
  78  |       this.testsEndpoint,
  79  |       payload,
  80  |       { headers: this.idempotencyHeaders() },
  81  |     );
  82  | 
  83  |     expect(response.status()).toBe(422);
  84  |     expect(body.error?.code).toBeDefined();
  85  | 
  86  |     return [response, body, sent];
  87  |   }
  88  | 
  89  |   @atc('BK-308', { vcr: { value: 3, cost: 1, risk: 2 } })
  90  |   async createTestForeignAtc(
  91  |     payload: TestCreatePayload,
  92  |   ): Promise<[APIResponse, APIError, TestCreatePayload]> {
  93  |     const [response, body, sent] = await this.apiPOST<APIError, TestCreatePayload>(
  94  |       this.testsEndpoint,
  95  |       payload,
  96  |       { headers: this.idempotencyHeaders() },
  97  |     );
  98  | 
  99  |     expect(response.status()).toBe(404);
  100 |     expect(body.error?.code).toBe('not_found');
  101 | 
  102 |     return [response, body, sent];
  103 |   }
  104 | 
  105 |   @atc('BK-309', { vcr: { value: 4, cost: 3, risk: 3 } })
  106 |   async createTestIdempotentRetry(
  107 |     payload: TestCreatePayload,
  108 |     idempotencyKey: string,
  109 |   ): Promise<[APIResponse, TestResponse, TestCreatePayload]> {
  110 |     const [response, body, sent] = await this.apiPOST<TestCreateResponse, TestCreatePayload>(
  111 |       this.testsEndpoint,
  112 |       payload,
  113 |       { headers: { 'Idempotency-Key': idempotencyKey } },
  114 |     );
  115 | 
  116 |     expect(response.status()).toBe(201);
  117 |     expect(body.test).toBeDefined();
  118 | 
  119 |     return [response, body.test, sent];
  120 |   }
  121 | 
  122 |   @atc('BK-310', { vcr: { value: 4, cost: 1, risk: 3 } })
  123 |   async createTestUnauthenticated(
  124 |     payload: TestCreatePayload,
  125 |   ): Promise<[APIResponse, APIError]> {
  126 |     const savedToken = this.authToken;
  127 |     this.clearAuthToken();
  128 | 
  129 |     const [response, body] = await this.apiPOST<APIError, TestCreatePayload>(
  130 |       this.testsEndpoint,
  131 |       payload,
  132 |     );
  133 | 
  134 |     if (savedToken) {
  135 |       this.setAuthToken(savedToken);
  136 |     }
  137 | 
> 138 |     expect(response.status()).toBe(401);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  139 | 
  140 |     return [response, body];
  141 |   }
  142 | }
  143 | 
```