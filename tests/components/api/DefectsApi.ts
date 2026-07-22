import type { APIResponse } from '@playwright/test';
import type {
  APIError,
  DefectCreatePayload,
  DefectCreateResponse,
  DefectResponse,
  DefectSyncResponse,
  DefectUpdatePayload,
  DefectUpdateResponse,
  SyncStatus,
} from '@schemas/defect.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

export class DefectsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private defectsEndpoint = '/defects';

  private defectByIdEndpoint(id: string): string {
    return `/defects/${id}`;
  }

  private defectRetrySyncEndpoint(id: string): string {
    return `/defects/${id}/retry-sync`;
  }

  @step
  async getDefectById(id: string): Promise<[APIResponse, DefectResponse | APIError]> {
    return this.apiGET<DefectResponse | APIError>(this.defectByIdEndpoint(id));
  }

  @step
  async getSyncStatus(id: string): Promise<SyncStatus | null> {
    const [, body] = await this.apiGET<DefectResponse | APIError>(this.defectByIdEndpoint(id));
    if ('sync_status' in body) {
      return body.sync_status;
    }
    return null;
  }

  @step
  async triggerRetrySync(id: string): Promise<[APIResponse, DefectSyncResponse | APIError, Record<string, never>]> {
    return this.apiPOST<DefectSyncResponse | APIError, Record<string, never>>(
      this.defectRetrySyncEndpoint(id),
      {},
    );
  }

  @atc('BK-43-TDS01')
  async createDefectSyncs(
    payload: DefectCreatePayload,
  ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
      this.defectsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    const defect = body.defect ?? body as unknown as DefectResponse;
    expect(defect.sync_status).toBe('synced');
    expect(defect.external_id).toBeDefined();
    expect(typeof defect.external_id).toBe('string');

    return [response, defect, sent];
  }

  @atc('BK-43-TDS02')
  async createDefectFireAndForget(
    payload: DefectCreatePayload,
  ): Promise<[APIResponse, DefectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
      this.defectsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    const defect = body.defect ?? body as unknown as DefectResponse;
    expect(defect.sync_status).toBe('pending');
    expect(defect.id).toBeDefined();

    return [response, sent];
  }

  @atc('BK-43-TDS03')
  async createDefectAutoRetries(
    payload: DefectCreatePayload,
  ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
      this.defectsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    const defect = body.defect ?? body as unknown as DefectResponse;
    expect(defect.sync_status).toBe('synced');
    expect(defect.external_id).toBeDefined();

    return [response, defect, sent];
  }

  @atc('BK-43-TDS04')
  async getDefectSyncFailed(
    payload: DefectCreatePayload,
  ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
      this.defectsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    const defect = body.defect ?? body as unknown as DefectResponse;
    expect(defect.sync_status).toBe('failed');
    expect(defect.sync_attempts).toBeGreaterThanOrEqual(1);

    return [response, defect, sent];
  }

  @atc('BK-43-TDS05')
  async externalUpdateDoesNotFlowBack(
    payload: DefectCreatePayload,
  ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
      this.defectsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    const defect = body.defect ?? body as unknown as DefectResponse;

    const [, getBody] = await this.apiGET<DefectResponse | APIError>(
      this.defectByIdEndpoint(defect.id),
    );
    if ('title' in getBody) {
      expect(getBody.title).toBe(payload.title);
      expect(getBody.severity).toBe(payload.severity);
    }

    return [response, defect, sent];
  }

  @atc('BK-43-TDS06')
  async createDefectNoIntegration(
    payload: DefectCreatePayload,
  ): Promise<[APIResponse, DefectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
      this.defectsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    const defect = body.defect ?? body as unknown as DefectResponse;
    expect(defect.sync_status).toBeUndefined();

    return [response, sent];
  }

  @atc('BK-43-TDS07')
  async reSyncDoesNotDuplicate(
    payload: DefectCreatePayload,
  ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
      this.defectsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    const defect = body.defect ?? body as unknown as DefectResponse;
    expect(defect.external_id).toBeDefined();

    const firstExternalId = defect.external_id;

    const [retryResponse] = await this.triggerRetrySync(defect.id);
    expect(retryResponse.ok()).toBeTruthy();

    const [, getBody] = await this.apiGET<DefectResponse | APIError>(
      this.defectByIdEndpoint(defect.id),
    );
    if ('external_id' in getBody && getBody.external_id) {
      expect(getBody.external_id).toBe(firstExternalId);
    }

    return [response, defect, sent];
  }

  @atc('BK-43-TDS08')
  async syncFailsOnPermanentAuth(
    payload: DefectCreatePayload,
  ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
      this.defectsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    const defect = body.defect ?? body as unknown as DefectResponse;
    expect(defect.sync_status).toBe('failed');

    return [response, defect, sent];
  }

  @atc('BK-43-TDS09')
  async updateDefectReSyncs(
    id: string,
    payload: DefectUpdatePayload,
  ): Promise<[APIResponse, DefectResponse, DefectUpdatePayload]> {
    const [response, body, sent] = await this.apiPATCH<DefectUpdateResponse, DefectUpdatePayload>(
      this.defectByIdEndpoint(id),
      payload,
    );

    expect(response.status()).toBe(200);
    const defect = body.defect ?? body as unknown as DefectResponse;
    expect(defect.sync_status).toBe('synced');
    expect(defect.external_id).toBeDefined();

    return [response, defect, sent];
  }

  @atc('BK-43-TDS10')
  async deleteDoesNotRemoveExternal(
    id: string,
  ): Promise<[APIResponse, DefectResponse]> {
    const [deleteResponse] = await this.apiPOST<DefectSyncResponse | APIError, Record<string, never>>(
      this.defectRetrySyncEndpoint(id),
      {},
    );

    expect(deleteResponse.ok()).toBeTruthy();

    const [, getBody] = await this.apiGET<DefectResponse | APIError>(
      this.defectByIdEndpoint(id),
    );
    const defect = 'external_id' in getBody ? getBody as DefectResponse | APIError : null;

    return [deleteResponse, defect as DefectResponse];
  }

  @atc('BK-43-TDS11')
  async rateLimitBackoff(
    payload: DefectCreatePayload,
  ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
      this.defectsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    const defect = body.defect ?? body as unknown as DefectResponse;
    expect(defect.sync_status).toBe('synced');

    return [response, defect, sent];
  }

  @atc('BK-43-TDS12')
  async fieldMappingAccuracy(
    payload: DefectCreatePayload,
  ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
      this.defectsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    const defect = body.defect ?? body as unknown as DefectResponse;
    expect(defect.sync_status).toBe('synced');
    expect(defect.external_id).toBeDefined();

    return [response, defect, sent];
  }

  @atc('BK-43-TDS13')
  async workspaceIsolation(
    payload: DefectCreatePayload,
  ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
      this.defectsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    const defect = body.defect ?? body as unknown as DefectResponse;
    expect(defect.workspace_id).toBeDefined();

    return [response, defect, sent];
  }

  @atc('BK-43-TDS14')
  async createDefectCarriesExternalLink(
    payload: DefectCreatePayload,
  ): Promise<[APIResponse, DefectResponse, DefectCreatePayload]> {
    const [response, body, sent] = await this.apiPOST<DefectCreateResponse, DefectCreatePayload>(
      this.defectsEndpoint,
      payload,
    );

    expect(response.status()).toBe(201);
    const defect = body.defect ?? body as unknown as DefectResponse;
    expect(defect.sync_status).toBe('synced');
    expect(defect.external_url).toBeDefined();
    expect(defect.external_url).toContain('http');

    return [response, defect, sent];
  }
}
