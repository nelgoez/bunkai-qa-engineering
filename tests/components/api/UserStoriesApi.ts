import type { APIResponse } from '@playwright/test';
import type { APIError } from '@schemas/atc.types';
import type {
  UserStoryCreatePayload,
  UserStoryCreateResponse,
  UserStoryResponse,
} from '@schemas/user-story.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc } from '@utils/decorators';

export class UserStoriesApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private moduleUserStoriesEndpoint(moduleId: string): string {
    return `/modules/${moduleId}/user-stories`;
  }

  @atc('TBD')
  async createUserStory(
    moduleId: string,
    payload: UserStoryCreatePayload,
  ): Promise<[APIResponse, UserStoryResponse, UserStoryCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<UserStoryCreateResponse, UserStoryCreatePayload>(
      this.moduleUserStoriesEndpoint(moduleId),
      payload,
    );

    expect(response.status()).toBe(201);
    expect(body.user_story).toBeDefined();

    const userStory = body.user_story;
    expect(userStory.id).toBeDefined();
    expect(userStory.title).toBe(payload.title);
    expect(userStory.module_id).toBe(moduleId);
    expect(userStory.archived_at).toBeNull();

    return [response, userStory, sent];
  }

  @atc('TBD')
  async createUserStoryInvalidTitle(
    moduleId: string,
    payload: UserStoryCreatePayload,
  ): Promise<[APIResponse, APIError]> {
    const [response, body] = await this.apiPOST<APIError, UserStoryCreatePayload>(
      this.moduleUserStoriesEndpoint(moduleId),
      payload,
    );

    expect(response.status()).toBe(422);

    return [response, body];
  }

  @atc('TBD')
  async createUserStoryEmptyBody(
    moduleId: string,
  ): Promise<[APIResponse, APIError]> {
    const [response, body] = await this.apiPOST<APIError, Record<string, never>>(
      this.moduleUserStoriesEndpoint(moduleId),
      {},
    );

    expect(response.status()).toBe(422);

    return [response, body];
  }

  @atc('TBD')
  async createUserStoryUnauthenticated(
    moduleId: string,
    payload: UserStoryCreatePayload,
  ): Promise<[APIResponse, APIError]> {
    const savedToken = this.authToken;
    this.clearAuthToken();

    const [response, body] = await this.apiPOST<APIError, UserStoryCreatePayload>(
      this.moduleUserStoriesEndpoint(moduleId),
      payload,
    );

    if (savedToken) {
      this.setAuthToken(savedToken);
    }

    expect(response.status()).toBe(401);

    return [response, body];
  }

  @atc('TBD')
  async createUserStoryNonExistentModule(
    moduleId: string,
    payload: UserStoryCreatePayload,
  ): Promise<[APIResponse, APIError]> {
    const [response, body] = await this.apiPOST<APIError, UserStoryCreatePayload>(
      this.moduleUserStoriesEndpoint(moduleId),
      payload,
    );

    expect(response.status()).toBe(404);

    return [response, body];
  }
}
