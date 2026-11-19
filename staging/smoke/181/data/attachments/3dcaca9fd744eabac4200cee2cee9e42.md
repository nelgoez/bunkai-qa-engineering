# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integration/workspace/workspace-project-crud.test.ts >> BK-4/BK-8: Workspace & Project CRUD API >> BK-8: POST /workspaces/{id}/projects rejects duplicate name → 409
- Location: tests/integration/workspace/workspace-project-crud.test.ts:111:3

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
  3  | import type { ProjectCreatePayload, ProjectCreateResponse, ProjectResponse } from '@schemas/project.types';
  4  | import type { TestContextOptions } from '@TestContext';
  5  | 
  6  | import { ApiBase } from '@api/ApiBase';
  7  | import { expect } from '@playwright/test';
  8  | import { atc } from '@utils/decorators';
  9  | 
  10 | export class ProjectsApi extends ApiBase {
  11 |   constructor(options: TestContextOptions) {
  12 |     super(options);
  13 |   }
  14 | 
  15 |   private projectsEndpoint(workspaceId: string): string {
  16 |     return `/workspaces/${workspaceId}/projects`;
  17 |   }
  18 | 
  19 |   @atc('BK-296')
  20 |   async createProjectSuccessfully(
  21 |     workspaceId: string,
  22 |     payload: ProjectCreatePayload,
  23 |   ): Promise<[APIResponse, ProjectResponse, ProjectCreatePayload]> {
  24 |     const [response, body, sent] = await this.apiPOST<ProjectCreateResponse, ProjectCreatePayload>(
  25 |       this.projectsEndpoint(workspaceId),
  26 |       payload,
  27 |     );
  28 | 
> 29 |     expect(response.status()).toBe(201);
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  30 |     expect(body.project).toBeDefined();
  31 |     expect(body.project.slug).toBeDefined();
  32 |     expect(body.project.workspace_id).toBe(workspaceId);
  33 |     expect(body.project.name).toBe(payload.name);
  34 | 
  35 |     return [response, body.project, sent];
  36 |   }
  37 | 
  38 |   @atc('BK-297')
  39 |   async createProjectNameTooShort(
  40 |     workspaceId: string,
  41 |     payload: ProjectCreatePayload,
  42 |   ): Promise<[APIResponse, APIError, ProjectCreatePayload]> {
  43 |     const [response, body, sent] = await this.apiPOST<APIError, ProjectCreatePayload>(
  44 |       this.projectsEndpoint(workspaceId),
  45 |       payload,
  46 |     );
  47 | 
  48 |     expect(response.status()).toBe(422);
  49 | 
  50 |     return [response, body, sent];
  51 |   }
  52 | 
  53 |   @atc('BK-298')
  54 |   async createProjectDuplicateName(
  55 |     workspaceId: string,
  56 |     payload: ProjectCreatePayload,
  57 |   ): Promise<[APIResponse, APIError, ProjectCreatePayload]> {
  58 |     const [response, body, sent] = await this.apiPOST<APIError, ProjectCreatePayload>(
  59 |       this.projectsEndpoint(workspaceId),
  60 |       payload,
  61 |     );
  62 | 
  63 |     expect(response.status()).toBe(409);
  64 | 
  65 |     return [response, body, sent];
  66 |   }
  67 | 
  68 |   @atc('BK-299')
  69 |   async createProjectNonMember(
  70 |     workspaceId: string,
  71 |     payload: ProjectCreatePayload,
  72 |   ): Promise<[APIResponse, APIError, ProjectCreatePayload]> {
  73 |     const [response, body, sent] = await this.apiPOST<APIError, ProjectCreatePayload>(
  74 |       this.projectsEndpoint(workspaceId),
  75 |       payload,
  76 |     );
  77 | 
  78 |     expect(response.status()).toBe(403);
  79 | 
  80 |     return [response, body, sent];
  81 |   }
  82 | }
  83 | 
```