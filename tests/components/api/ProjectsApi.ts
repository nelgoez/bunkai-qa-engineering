import type { APIResponse } from '@playwright/test';
import type { APIError } from '@schemas/atc.types';
import type { ProjectCreatePayload, ProjectCreateResponse, ProjectResponse } from '@schemas/project.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc } from '@utils/decorators';

export class ProjectsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private projectsEndpoint(workspaceId: string): string {
    return `/workspaces/${workspaceId}/projects`;
  }

  @atc('BK-296', { vcr: { value: 5, cost: 2, risk: 3 } })
  async createProjectSuccessfully(
    workspaceId: string,
    payload: ProjectCreatePayload,
  ): Promise<[APIResponse, ProjectResponse, ProjectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<ProjectCreateResponse, ProjectCreatePayload>(
      this.projectsEndpoint(workspaceId),
      payload,
    );

    expect(response.status()).toBe(201);
    expect(body.project).toBeDefined();
    expect(body.project.slug).toBeDefined();
    expect(body.project.workspace_id).toBe(workspaceId);
    expect(body.project.name).toBe(payload.name);

    return [response, body.project, sent];
  }

  @atc('BK-297', { vcr: { value: 3, cost: 1, risk: 2 } })
  async createProjectNameTooShort(
    workspaceId: string,
    payload: ProjectCreatePayload,
  ): Promise<[APIResponse, APIError, ProjectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, ProjectCreatePayload>(
      this.projectsEndpoint(workspaceId),
      payload,
    );

    expect(response.status()).toBe(422);

    return [response, body, sent];
  }

  @atc('BK-298', { vcr: { value: 4, cost: 2, risk: 2 } })
  async createProjectDuplicateName(
    workspaceId: string,
    payload: ProjectCreatePayload,
  ): Promise<[APIResponse, APIError, ProjectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, ProjectCreatePayload>(
      this.projectsEndpoint(workspaceId),
      payload,
    );

    expect(response.status()).toBe(409);

    return [response, body, sent];
  }

  @atc('BK-299', { vcr: { value: 4, cost: 2, risk: 3 } })
  async createProjectNonMember(
    workspaceId: string,
    payload: ProjectCreatePayload,
  ): Promise<[APIResponse, APIError, ProjectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, ProjectCreatePayload>(
      this.projectsEndpoint(workspaceId),
      payload,
    );

    expect(response.status()).toBe(403);

    return [response, body, sent];
  }
}
