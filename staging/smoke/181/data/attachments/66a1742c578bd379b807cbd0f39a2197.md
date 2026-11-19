# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integration/workspace/workspace-project-crud.test.ts >> BK-4/BK-8: Workspace & Project CRUD API >> BK-8: POST /workspaces/{id}/projects creates project → 201
- Location: tests/integration/workspace/workspace-project-crud.test.ts:80:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 400
```

# Test source

```ts
  1  | import type { APIResponse } from '@playwright/test';
  2  | import type { APIError } from '@schemas/atc.types';
  3  | import type { WorkspaceCreatePayload, WorkspaceCreateResponse, WorkspaceResponse } from '@schemas/workspace.types';
  4  | import type { TestContextOptions } from '@TestContext';
  5  | 
  6  | import { ApiBase } from '@api/ApiBase';
  7  | import { expect } from '@playwright/test';
  8  | import { atc } from '@utils/decorators';
  9  | 
  10 | export class WorkspacesApi extends ApiBase {
  11 |   constructor(options: TestContextOptions) {
  12 |     super(options);
  13 |   }
  14 | 
  15 |   private workspacesEndpoint = '/workspaces';
  16 | 
  17 |   @atc('BK-291')
  18 |   async createWorkspaceSuccessfully(
  19 |     payload: WorkspaceCreatePayload,
  20 |   ): Promise<[APIResponse, WorkspaceResponse, WorkspaceCreatePayload]> {
  21 |     const [response, body, sent] = await this.apiPOST<WorkspaceCreateResponse, WorkspaceCreatePayload>(
  22 |       this.workspacesEndpoint,
  23 |       payload,
  24 |     );
  25 | 
> 26 |     expect(response.status()).toBe(201);
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  27 |     expect(body.workspace).toBeDefined();
  28 |     expect(body.workspace.slug).toBe(payload.slug);
  29 |     expect(body.workspace.name).toBe(payload.name);
  30 |     expect(body.workspace.owner_user_id).toBeDefined();
  31 |     expect(body.workspace.plan).toBe('community');
  32 | 
  33 |     return [response, body.workspace, sent];
  34 |   }
  35 | 
  36 |   @atc('BK-292')
  37 |   async createWorkspaceNameTooShort(
  38 |     payload: WorkspaceCreatePayload,
  39 |   ): Promise<[APIResponse, APIError, WorkspaceCreatePayload]> {
  40 |     const [response, body, sent] = await this.apiPOST<APIError, WorkspaceCreatePayload>(
  41 |       this.workspacesEndpoint,
  42 |       payload,
  43 |     );
  44 | 
  45 |     expect(response.status()).toBe(422);
  46 |     expect(body.error.code).toBe('validation_failed');
  47 | 
  48 |     return [response, body, sent];
  49 |   }
  50 | 
  51 |   @atc('BK-293')
  52 |   async createWorkspaceReservedSlug(
  53 |     payload: WorkspaceCreatePayload,
  54 |   ): Promise<[APIResponse, APIError, WorkspaceCreatePayload]> {
  55 |     const [response, body, sent] = await this.apiPOST<APIError, WorkspaceCreatePayload>(
  56 |       this.workspacesEndpoint,
  57 |       payload,
  58 |     );
  59 | 
  60 |     expect(response.status()).toBe(422);
  61 | 
  62 |     return [response, body, sent];
  63 |   }
  64 | 
  65 |   @atc('BK-294')
  66 |   async createWorkspaceDuplicateSlug(
  67 |     payload: WorkspaceCreatePayload,
  68 |   ): Promise<[APIResponse, APIError, WorkspaceCreatePayload]> {
  69 |     const [response, body, sent] = await this.apiPOST<APIError, WorkspaceCreatePayload>(
  70 |       this.workspacesEndpoint,
  71 |       payload,
  72 |     );
  73 | 
  74 |     expect(response.status()).toBe(409);
  75 |     expect(body.error.code).toBe('conflict');
  76 | 
  77 |     return [response, body, sent];
  78 |   }
  79 | 
  80 |   @atc('BK-295')
  81 |   async createWorkspaceUnauthenticated(
  82 |     payload: WorkspaceCreatePayload,
  83 |   ): Promise<[APIResponse, APIError]> {
  84 |     const savedToken = this.authToken;
  85 |     this.clearAuthToken();
  86 | 
  87 |     const [response, body] = await this.apiPOST<APIError, WorkspaceCreatePayload>(
  88 |       this.workspacesEndpoint,
  89 |       payload,
  90 |     );
  91 | 
  92 |     if (savedToken) {
  93 |       this.setAuthToken(savedToken);
  94 |     }
  95 | 
  96 |     return [response, body];
  97 |   }
  98 | }
  99 | 
```