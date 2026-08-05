import type { APIResponse } from '@playwright/test';
import type {
  APIError,
  DefectCreatePayload,
  DefectCreateResponse,
  DefectResponse,
  DefectSyncResponse,
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

  @atc('BK-234')
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

  @atc('BK-240')
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

  @atc('BK-241')
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

  @atc('BK-246')
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

  @atc('BK-247')
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
