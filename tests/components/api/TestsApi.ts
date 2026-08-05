import type { APIResponse } from '@playwright/test';
import type { APIError } from '@schemas/atc.types';
import type { TestCreatePayload, TestCreateResponse, TestResponse } from '@schemas/tests.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

export class TestsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private testsEndpoint = '/tests';

  private idempotencyHeaders(): Record<string, string> {
    return { 'Idempotency-Key': `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  }

  @step
  async getTestById(id: string): Promise<[APIResponse, TestResponse | APIError]> {
    return this.apiGET<TestResponse | APIError>(`${this.testsEndpoint}/${id}`);
  }

  @atc('BK-270')
  async createTestSuccessfully(
    payload: TestCreatePayload,
  ): Promise<[APIResponse, TestResponse, TestCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<TestCreateResponse, TestCreatePayload>(
      this.testsEndpoint,
      payload,
      { headers: this.idempotencyHeaders() },
    );

    expect(response.status()).toBe(201);
    expect(body.test).toBeDefined();

    const testEntity = body.test;
    expect(testEntity.id).toBeDefined();
    expect(testEntity.title).toBe(payload.title);
    expect(testEntity.atc_ids).toBeDefined();
    expect(testEntity.atc_ids).toHaveLength(payload.atc_ids.length);

    for (const [index, ref] of testEntity.atc_ids.entries()) {
      expect(ref.id).toBe(payload.atc_ids[index]);
      expect(ref.position).toBe(index + 1);
    }

    expect(testEntity.workspace_id).toBe(payload.workspace_id);
    expect(testEntity.created_by).toBeDefined();
    expect(testEntity.created_at).toBeDefined();

    return [response, testEntity, sent];
  }

  @atc('BK-271')
  async createTestEmptyChain(
    payload: TestCreatePayload,
  ): Promise<[APIResponse, APIError, TestCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, TestCreatePayload>(
      this.testsEndpoint,
      payload,
    );

    expect(response.status()).toBe(422);
    expect(body.error?.code).toBeDefined();

    return [response, body, sent];
  }

  @atc('BK-272')
  async createTestWithInvalidTitle(
    payload: TestCreatePayload,
  ): Promise<[APIResponse, APIError, TestCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, TestCreatePayload>(
      this.testsEndpoint,
      payload,
    );

    expect(response.status()).toBe(422);
    expect(body.error?.code).toBeDefined();

    return [response, body, sent];
  }

  @atc('BK-273')
  async createTestForeignAtc(
    payload: TestCreatePayload,
  ): Promise<[APIResponse, APIError, TestCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<APIError, TestCreatePayload>(
      this.testsEndpoint,
      payload,
      { headers: this.idempotencyHeaders() },
    );

    expect(response.status()).toBe(404);
    expect(body.error?.code).toBe('not_found');

    return [response, body, sent];
  }

  @atc('BK-274')
  async createTestIdempotentRetry(
    payload: TestCreatePayload,
    idempotencyKey: string,
  ): Promise<[APIResponse, TestResponse, TestCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<TestCreateResponse, TestCreatePayload>(
      this.testsEndpoint,
      payload,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );

    expect(response.status()).toBe(201);
    expect(body.test).toBeDefined();

    return [response, body.test, sent];
  }

  @atc('BK-275')
  async createTestUnauthenticated(
    payload: TestCreatePayload,
  ): Promise<[APIResponse, APIError]> {
    const savedToken = this.authToken;
    this.clearAuthToken();

    const [response, body] = await this.apiPOST<APIError, TestCreatePayload>(
      this.testsEndpoint,
      payload,
    );

    if (savedToken) {
      this.setAuthToken(savedToken);
    }

    expect(response.status()).toBe(401);

    return [response, body];
  }
}
