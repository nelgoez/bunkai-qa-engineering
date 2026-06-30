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
}
