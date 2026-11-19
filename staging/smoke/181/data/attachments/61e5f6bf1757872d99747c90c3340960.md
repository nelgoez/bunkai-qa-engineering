# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integration/atc/atc-create-edit.test.ts >> BK-18: ATC Create/Edit REST API >> BK-157: PATCH /atcs/{id} rejects stale X-If-Match → 409
- Location: tests/integration/atc/atc-create-edit.test.ts:322:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 400
```

# Test source

```ts
  1   | import type { APIResponse } from '@playwright/test';
  2   | import type {
  3   |   APIError,
  4   |   ATCCreatePayload,
  5   |   ATCCreateResponse,
  6   |   ATCResponse,
  7   |   ATCUpdateResponse,
  8   | } from '@schemas/atc.types';
  9   | import type { TestContextOptions } from '@TestContext';
  10  | 
  11  | import { ApiBase } from '@api/ApiBase';
  12  | import { expect } from '@playwright/test';
  13  | import { atc, step } from '@utils/decorators';
  14  | 
  15  | export class AtcsApi extends ApiBase {
  16  |   constructor(options: TestContextOptions) {
  17  |     super(options);
  18  |   }
  19  | 
  20  |   private atcsEndpoint = '/atcs';
  21  | 
  22  |   private atcByIdEndpoint(id: string): string {
  23  |     return `/atcs/${id}`;
  24  |   }
  25  | 
  26  |   @step
  27  |   async getAtcById(id: string): Promise<[APIResponse, ATCResponse | APIError]> {
  28  |     return this.apiGET<ATCResponse | APIError>(this.atcByIdEndpoint(id));
  29  |   }
  30  | 
  31  |   @atc('BK-149')
  32  |   async createAtcSuccessfully(
  33  |     payload: ATCCreatePayload,
  34  |   ): Promise<[APIResponse, ATCResponse, ATCCreatePayload]> {
  35  |     const [response, body, sent] = await this.apiPOST<ATCCreateResponse, ATCCreatePayload>(
  36  |       this.atcsEndpoint,
  37  |       payload,
  38  |     );
  39  | 
> 40  |     expect(response.status()).toBe(201);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  41  |     expect(body.atc).toBeDefined();
  42  | 
  43  |     const atc = body.atc;
  44  |     expect(atc.id).toBeDefined();
  45  |     expect(atc.slug).toMatch(/^[a-z0-9-]+\/atc-[a-z0-9]{8}$/);
  46  |     expect(atc.version).toBe(1);
  47  |     expect(atc.steps.length).toBe(payload.steps.length);
  48  |     expect(atc.assertions.length).toBe(payload.assertions?.length ?? 0);
  49  | 
  50  |     return [response, atc, sent];
  51  |   }
  52  | 
  53  |   @atc('BK-156')
  54  |   async patchAtcSuccessfully(
  55  |     id: string,
  56  |     payload: Partial<ATCCreatePayload>,
  57  |     ifMatch?: string,
  58  |   ): Promise<[APIResponse, ATCResponse, Partial<ATCCreatePayload>]> {
  59  |     const headers: Record<string, string> = {};
  60  |     if (ifMatch !== undefined) {
  61  |       headers['X-If-Match'] = ifMatch;
  62  |     }
  63  | 
  64  |     const [response, body, sent] = await this.apiPATCH<ATCUpdateResponse, Partial<ATCCreatePayload>>(
  65  |       this.atcByIdEndpoint(id),
  66  |       payload,
  67  |       { headers },
  68  |     );
  69  | 
  70  |     expect(response.status()).toBe(200);
  71  |     expect(body.atc).toBeDefined();
  72  | 
  73  |     return [response, body.atc, sent];
  74  |   }
  75  | 
  76  |   @atc('BK-150')
  77  |   async createAtcWithInvalidAuth(
  78  |     payload: ATCCreatePayload,
  79  |     authHeader?: string,
  80  |   ): Promise<[APIResponse, APIError]> {
  81  |     const reqHeaders: Record<string, string> = {};
  82  |     if (authHeader !== undefined) {
  83  |       reqHeaders.Authorization = authHeader;
  84  |     }
  85  | 
  86  |     const savedToken = this.authToken;
  87  |     this.clearAuthToken();
  88  | 
  89  |     const [response, body] = await this.apiPOST<APIError, ATCCreatePayload>(
  90  |       this.atcsEndpoint,
  91  |       payload,
  92  |       { headers: reqHeaders },
  93  |     );
  94  | 
  95  |     if (savedToken) {
  96  |       this.setAuthToken(savedToken);
  97  |     }
  98  | 
  99  |     return [response, body];
  100 |   }
  101 | 
  102 |   @atc('BK-151')
  103 |   async createAtcWithAcOutsideUserStory(
  104 |     payload: ATCCreatePayload,
  105 |   ): Promise<[APIResponse, APIError, ATCCreatePayload]> {
  106 |     const [response, body, sent] = await this.apiPOST<APIError, ATCCreatePayload>(
  107 |       this.atcsEndpoint,
  108 |       payload,
  109 |     );
  110 |     expect(response.status()).toBe(422);
  111 |     expect(body.error?.code).toBe('ac_outside_user_story');
  112 |     return [response, body, sent];
  113 |   }
  114 | 
  115 |   @atc('BK-152')
  116 |   async createAtcWithModuleOutsideSubtree(
  117 |     payload: ATCCreatePayload,
  118 |   ): Promise<[APIResponse, APIError, ATCCreatePayload]> {
  119 |     const [response, body, sent] = await this.apiPOST<APIError, ATCCreatePayload>(
  120 |       this.atcsEndpoint,
  121 |       payload,
  122 |     );
  123 |     expect(response.status()).toBe(404);
  124 |     expect(body.error?.code).toBe('not_found');
  125 |     return [response, body, sent];
  126 |   }
  127 | 
  128 |   @atc('BK-153')
  129 |   async createAtcWithInvalidStepPosition(
  130 |     payload: ATCCreatePayload,
  131 |   ): Promise<[APIResponse, APIError, ATCCreatePayload]> {
  132 |     const [response, body, sent] = await this.apiPOST<APIError, ATCCreatePayload>(
  133 |       this.atcsEndpoint,
  134 |       payload,
  135 |     );
  136 |     expect(response.status()).toBe(422);
  137 |     expect(body.error?.code).toBeDefined();
  138 |     return [response, body, sent];
  139 |   }
  140 | 
```