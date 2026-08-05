import type { APIResponse } from '@playwright/test';
import type { APIError } from '@schemas/atc.types';
import type { WorkspaceCreatePayload, WorkspaceCreateResponse, WorkspaceResponse } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc } from '@utils/decorators';

export class WorkspacesApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private workspacesEndpoint = '/workspaces';

  @atc('TBD')
  async createWorkspaceSuccessfully(
    payload: WorkspaceCreatePayload,
  ): Promise<[APIResponse, WorkspaceResponse, WorkspaceCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<WorkspaceCreateResponse, WorkspaceCreatePayload>(
      this.workspacesEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    expect(body.workspace).toBeDefined();
    expect(body.workspace.slug).toBe(payload.slug);
    expect(body.workspace.name).toBe(payload.name);
    expect(body.workspace.owner_user_id).toBeDefined();
    expect(body.workspace.plan).toBe('community');

    return [response, body.workspace, sent];
  }

  @atc('TBD')
  async createWorkspaceNameTooShort(
    payload: WorkspaceCreatePayload,
  ): Promise<[APIResponse, APIError, WorkspaceCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, WorkspaceCreatePayload>(
      this.workspacesEndpoint,
      payload,
    );

    expect(response.status()).toBe(422);
    expect(body.error.code).toBe('validation_failed');

    return [response, body, sent];
  }

  @atc('TBD')
  async createWorkspaceReservedSlug(
    payload: WorkspaceCreatePayload,
  ): Promise<[APIResponse, APIError, WorkspaceCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, WorkspaceCreatePayload>(
      this.workspacesEndpoint,
      payload,
    );

    expect(response.status()).toBe(422);

    return [response, body, sent];
  }

  @atc('TBD')
  async createWorkspaceDuplicateSlug(
    payload: WorkspaceCreatePayload,
  ): Promise<[APIResponse, APIError, WorkspaceCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, WorkspaceCreatePayload>(
      this.workspacesEndpoint,
      payload,
    );

    expect(response.status()).toBe(409);
    expect(body.error.code).toBe('conflict');

    return [response, body, sent];
  }

  @atc('TBD')
  async createWorkspaceUnauthenticated(
    payload: WorkspaceCreatePayload,
  ): Promise<[APIResponse, APIError]> {
    const savedToken = this.authToken;
    this.clearAuthToken();

    const [response, body] = await this.apiPOST<APIError, WorkspaceCreatePayload>(
      this.workspacesEndpoint,
      payload,
    );

    if (savedToken) {
      this.setAuthToken(savedToken);
    }

    return [response, body];
  }
}
