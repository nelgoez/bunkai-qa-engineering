# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integration/defects/defect-sync.test.ts >> BK-43: TMS-Defect Sync >> BK-247: External link — synced defect carries link back to Bunkai
- Location: tests/integration/defects/defect-sync.test.ts:50:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 404
```

# Test source

```ts
  40  |       return body.sync_status;
  41  |     }
  42  |     return null;
  43  |   }
  44  | 
  45  |   @step
  46  |   async triggerRetrySync(id: string): Promise<[APIResponse, DefectSyncResponse | APIError, Record<string, never>]> {
  47  |     return this.apiPOST<DefectSyncResponse | APIError, Record<string, never>>(
  48  |       this.defectRetrySyncEndpoint(id),
  49  |       {},
  50  |     );
  51  |   }
  52  | 
  53  |   @atc('BK-234')
  54  |   async createDefectSyncs(
  55  |     payload: DefectCreatePayload,
  56  |   ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
  57  |     const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
  58  |       this.defectsEndpoint,
  59  |       payload,
  60  |     );
  61  | 
  62  |     expect(response.status()).toBe(201);
  63  |     const defect = body.defect ?? body as unknown as DefectResponse;
  64  |     expect(defect.sync_status).toBe('synced');
  65  |     expect(defect.external_id).toBeDefined();
  66  |     expect(typeof defect.external_id).toBe('string');
  67  | 
  68  |     return [response, defect, sent];
  69  |   }
  70  | 
  71  |   @atc('BK-240')
  72  |   async reSyncDoesNotDuplicate(
  73  |     payload: DefectCreatePayload,
  74  |   ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
  75  |     const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
  76  |       this.defectsEndpoint,
  77  |       payload,
  78  |     );
  79  | 
  80  |     expect(response.status()).toBe(201);
  81  |     const defect = body.defect ?? body as unknown as DefectResponse;
  82  |     expect(defect.external_id).toBeDefined();
  83  | 
  84  |     const firstExternalId = defect.external_id;
  85  | 
  86  |     const [retryResponse] = await this.triggerRetrySync(defect.id);
  87  |     expect(retryResponse.ok()).toBeTruthy();
  88  | 
  89  |     const [, getBody] = await this.apiGET<DefectResponse | APIError>(
  90  |       this.defectByIdEndpoint(defect.id),
  91  |     );
  92  |     if ('external_id' in getBody && getBody.external_id) {
  93  |       expect(getBody.external_id).toBe(firstExternalId);
  94  |     }
  95  | 
  96  |     return [response, defect, sent];
  97  |   }
  98  | 
  99  |   @atc('BK-241')
  100 |   async syncFailsOnPermanentAuth(
  101 |     payload: DefectCreatePayload,
  102 |   ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
  103 |     const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
  104 |       this.defectsEndpoint,
  105 |       payload,
  106 |     );
  107 | 
  108 |     expect(response.status()).toBe(201);
  109 |     const defect = body.defect ?? body as unknown as DefectResponse;
  110 |     expect(defect.sync_status).toBe('failed');
  111 | 
  112 |     return [response, defect, sent];
  113 |   }
  114 | 
  115 |   @atc('BK-246')
  116 |   async workspaceIsolation(
  117 |     payload: DefectCreatePayload,
  118 |   ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
  119 |     const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
  120 |       this.defectsEndpoint,
  121 |       payload,
  122 |     );
  123 | 
  124 |     expect(response.status()).toBe(201);
  125 |     const defect = body.defect ?? body as unknown as DefectResponse;
  126 |     expect(defect.workspace_id).toBeDefined();
  127 | 
  128 |     return [response, defect, sent];
  129 |   }
  130 | 
  131 |   @atc('BK-247')
  132 |   async createDefectCarriesExternalLink(
  133 |     payload: DefectCreatePayload,
  134 |   ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
  135 |     const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
  136 |       this.defectsEndpoint,
  137 |       payload,
  138 |     );
  139 | 
> 140 |     expect(response.status()).toBe(201);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  141 |     const defect = body.defect ?? body as unknown as DefectResponse;
  142 |     expect(defect.sync_status).toBe('synced');
  143 |     expect(defect.external_url).toBeDefined();
  144 |     expect(defect.external_url).toContain('http');
  145 | 
  146 |     return [response, defect, sent];
  147 |   }
  148 | }
  149 | 
```