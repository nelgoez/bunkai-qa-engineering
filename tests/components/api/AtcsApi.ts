import type { APIResponse } from '@playwright/test';
import type {
  APIError,
  ATCCreatePayload,
  ATCCreateResponse,
  ATCResponse,
  ATCUpdateResponse,
} from '@schemas/atc.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

export class AtcsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private atcsEndpoint = '/atcs';

  private atcByIdEndpoint(id: string): string {
    return `/atcs/${id}`;
  }

  @step
  async getAtcById(id: string): Promise<[APIResponse, ATCResponse | APIError]> {
    return this.apiGET<ATCResponse | APIError>(this.atcByIdEndpoint(id));
  }

  @atc('BK-149')
  async createAtcSuccessfully(
    payload: ATCCreatePayload,
  ): Promise<[APIResponse, ATCResponse, ATCCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<ATCCreateResponse, ATCCreatePayload>(
      this.atcsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    expect(body.atc).toBeDefined();

    const atc = body.atc;
    expect(atc.id).toBeDefined();
    expect(atc.slug).toMatch(/^[a-z0-9-]+\/atc-[a-z0-9]{8}$/);
    expect(atc.version).toBe(1);
    expect(atc.steps.length).toBe(payload.steps.length);
    expect(atc.assertions.length).toBe(payload.assertions?.length ?? 0);

    return [response, atc, sent];
  }

  @atc('BK-156')
  async patchAtcSuccessfully(
    id: string,
    payload: Partial<ATCCreatePayload>,
    ifMatch?: string,
  ): Promise<[APIResponse, ATCResponse, Partial<ATCCreatePayload>]> {
    const headers: Record<string, string> = {};
    if (ifMatch !== undefined) {
      headers['X-If-Match'] = ifMatch;
    }

    const [response, body, sent] = await this.apiPATCH<ATCUpdateResponse, Partial<ATCCreatePayload>>(
      this.atcByIdEndpoint(id),
      payload,
      { headers },
    );

    expect(response.status()).toBe(200);
    expect(body.atc).toBeDefined();

    return [response, body.atc, sent];
  }

  @atc('BK-150')
  async createAtcWithInvalidAuth(
    payload: ATCCreatePayload,
    authHeader?: string,
  ): Promise<[APIResponse, APIError]> {
    const reqHeaders: Record<string, string> = {};
    if (authHeader !== undefined) {
      reqHeaders.Authorization = authHeader;
    }

    const savedToken = this.authToken;
    this.clearAuthToken();

    const [response, body] = await this.apiPOST<APIError, ATCCreatePayload>(
      this.atcsEndpoint,
      payload,
      { headers: reqHeaders },
    );

    if (savedToken) {
      this.setAuthToken(savedToken);
    }

    return [response, body];
  }

  @atc('BK-151')
  async createAtcWithAcOutsideUserStory(
    payload: ATCCreatePayload,
  ): Promise<[APIResponse, APIError, ATCCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, ATCCreatePayload>(
      this.atcsEndpoint,
      payload,
    );
    expect(response.status()).toBe(422);
    expect(body.error?.code).toBe('ac_outside_user_story');
    return [response, body, sent];
  }

  @atc('BK-152')
  async createAtcWithModuleOutsideSubtree(
    payload: ATCCreatePayload,
  ): Promise<[APIResponse, APIError, ATCCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, ATCCreatePayload>(
      this.atcsEndpoint,
      payload,
    );
    expect(response.status()).toBe(404);
    expect(body.error?.code).toBe('not_found');
    return [response, body, sent];
  }

  @atc('BK-153')
  async createAtcWithInvalidStepPosition(
    payload: ATCCreatePayload,
  ): Promise<[APIResponse, APIError, ATCCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, ATCCreatePayload>(
      this.atcsEndpoint,
      payload,
    );
    expect(response.status()).toBe(422);
    expect(body.error?.code).toBeDefined();
    return [response, body, sent];
  }

  @atc('BK-154')
  async createAtcWithBodyBoundaryValidation(
    payload: ATCCreatePayload,
  ): Promise<[APIResponse, APIError, ATCCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, ATCCreatePayload>(
      this.atcsEndpoint,
      payload,
    );
    expect(body.error?.code).toBe('validation_failed');
    return [response, body, sent];
  }

  @atc('BK-155')
  async createAtcRollbackOnForeignUserStory(
    payload: ATCCreatePayload,
  ): Promise<[APIResponse, APIError, ATCCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, ATCCreatePayload>(
      this.atcsEndpoint,
      payload,
    );
    expect(response.status()).toBe(404);
    expect(body.error?.code).toBe('not_found');
    return [response, body, sent];
  }

  @atc('BK-157')
  async patchAtcWithStaleLock(
    id: string,
    payload: Partial<ATCCreatePayload>,
    ifMatch: string,
  ): Promise<[APIResponse, APIError, Partial<ATCCreatePayload>]> {
    const [response, body, sent] = await this.apiPATCH<APIError, Partial<ATCCreatePayload>>(
      this.atcByIdEndpoint(id),
      payload,
      { headers: { 'X-If-Match': ifMatch } },
    );
    expect(response.status()).toBe(409);
    expect(body.error?.code).toBe('conflict');
    return [response, body, sent];
  }

  @atc('BK-158')
  async patchAtcNonExistent(
    id: string,
    payload: Partial<ATCCreatePayload>,
  ): Promise<[APIResponse, APIError, Partial<ATCCreatePayload>]> {
    const [response, body, sent] = await this.apiPATCH<APIError, Partial<ATCCreatePayload>>(
      this.atcByIdEndpoint(id),
      payload,
    );
    expect(response.status()).toBe(404);
    expect(body.error?.code).toBe('not_found');
    return [response, body, sent];
  }

  @atc('BK-159')
  async patchAtcIdenticalPayload(
    id: string,
    payload: Partial<ATCCreatePayload>,
  ): Promise<[APIResponse, ATCResponse, Partial<ATCCreatePayload>]> {
    const [response, body, sent] = await this.apiPATCH<ATCUpdateResponse, Partial<ATCCreatePayload>>(
      this.atcByIdEndpoint(id),
      payload,
    );
    expect(response.status()).toBe(200);
    expect(body.atc.version).toBe(2);
    return [response, body.atc, sent];
  }

  @atc('BK-160')
  async patchAtcImmutableFields(
    id: string,
    payload: Partial<ATCCreatePayload>,
  ): Promise<[APIResponse, ATCResponse, Partial<ATCCreatePayload>]> {
    const [response, body, sent] = await this.apiPATCH<ATCUpdateResponse, Partial<ATCCreatePayload>>(
      this.atcByIdEndpoint(id),
      payload,
    );
    expect(response.status()).toBe(200);
    return [response, body.atc, sent];
  }
}
