# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integration/user-story/user-story.test.ts >> BK-14: User Stories API >> BK-14: POST /modules/{id}/user-stories returns 404 for non-existent module
- Location: tests/integration/user-story/user-story.test.ts:50:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 404
Received: 400
```

# Test source

```ts
  6   |   UserStoryResponse,
  7   | } from '@schemas/user-story.types';
  8   | import type { TestContextOptions } from '@TestContext';
  9   | 
  10  | import { ApiBase } from '@api/ApiBase';
  11  | import { expect } from '@playwright/test';
  12  | import { atc } from '@utils/decorators';
  13  | 
  14  | export class UserStoriesApi extends ApiBase {
  15  |   constructor(options: TestContextOptions) {
  16  |     super(options);
  17  |   }
  18  | 
  19  |   private moduleUserStoriesEndpoint(moduleId: string): string {
  20  |     return `/modules/${moduleId}/user-stories`;
  21  |   }
  22  | 
  23  |   @atc('BK-300')
  24  |   async createUserStory(
  25  |     moduleId: string,
  26  |     payload: UserStoryCreatePayload,
  27  |   ): Promise<[APIResponse, UserStoryResponse, UserStoryCreatePayload]> {
  28  |     const [response, body, sent] = await this.apiPOST<UserStoryCreateResponse, UserStoryCreatePayload>(
  29  |       this.moduleUserStoriesEndpoint(moduleId),
  30  |       payload,
  31  |     );
  32  | 
  33  |     expect(response.status()).toBe(201);
  34  |     expect(body.user_story).toBeDefined();
  35  | 
  36  |     const userStory = body.user_story;
  37  |     expect(userStory.id).toBeDefined();
  38  |     expect(userStory.title).toBe(payload.title);
  39  |     expect(userStory.module_id).toBe(moduleId);
  40  |     expect(userStory.archived_at).toBeNull();
  41  | 
  42  |     return [response, userStory, sent];
  43  |   }
  44  | 
  45  |   @atc('BK-301')
  46  |   async createUserStoryInvalidTitle(
  47  |     moduleId: string,
  48  |     payload: UserStoryCreatePayload,
  49  |   ): Promise<[APIResponse, APIError]> {
  50  |     const [response, body] = await this.apiPOST<APIError, UserStoryCreatePayload>(
  51  |       this.moduleUserStoriesEndpoint(moduleId),
  52  |       payload,
  53  |     );
  54  | 
  55  |     expect(response.status()).toBe(422);
  56  | 
  57  |     return [response, body];
  58  |   }
  59  | 
  60  |   @atc('BK-302')
  61  |   async createUserStoryEmptyBody(
  62  |     moduleId: string,
  63  |   ): Promise<[APIResponse, APIError]> {
  64  |     const [response, body] = await this.apiPOST<APIError, Record<string, never>>(
  65  |       this.moduleUserStoriesEndpoint(moduleId),
  66  |       {},
  67  |     );
  68  | 
  69  |     expect(response.status()).toBe(422);
  70  | 
  71  |     return [response, body];
  72  |   }
  73  | 
  74  |   @atc('BK-303')
  75  |   async createUserStoryUnauthenticated(
  76  |     moduleId: string,
  77  |     payload: UserStoryCreatePayload,
  78  |   ): Promise<[APIResponse, APIError]> {
  79  |     const savedToken = this.authToken;
  80  |     this.clearAuthToken();
  81  | 
  82  |     const [response, body] = await this.apiPOST<APIError, UserStoryCreatePayload>(
  83  |       this.moduleUserStoriesEndpoint(moduleId),
  84  |       payload,
  85  |     );
  86  | 
  87  |     if (savedToken) {
  88  |       this.setAuthToken(savedToken);
  89  |     }
  90  | 
  91  |     expect(response.status()).toBe(401);
  92  | 
  93  |     return [response, body];
  94  |   }
  95  | 
  96  |   @atc('BK-304')
  97  |   async createUserStoryNonExistentModule(
  98  |     moduleId: string,
  99  |     payload: UserStoryCreatePayload,
  100 |   ): Promise<[APIResponse, APIError]> {
  101 |     const [response, body] = await this.apiPOST<APIError, UserStoryCreatePayload>(
  102 |       this.moduleUserStoriesEndpoint(moduleId),
  103 |       payload,
  104 |     );
  105 | 
> 106 |     expect(response.status()).toBe(404);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  107 | 
  108 |     return [response, body];
  109 |   }
  110 | }
  111 | 
```