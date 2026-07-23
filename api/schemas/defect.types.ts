export type Severity = 'critical' | 'major' | 'minor' | 'trivial';
export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface DefectCreatePayload {
  title: string
  description: string
  severity: Severity
  module_id: string
  user_story_id?: string
  evidence?: string[]
}

export interface DefectUpdatePayload {
  title?: string
  description?: string
  severity?: Severity
}

export interface DefectResponse {
  id: string
  title: string
  description: string
  severity: Severity
  sync_status: SyncStatus
  external_id?: string
  external_url?: string
  sync_attempts?: number
  project_id?: string
  workspace_id?: string
  created_at: string
  updated_at: string
}

export interface DefectCreateResponse {
  defect: DefectResponse
}

export interface DefectUpdateResponse {
  defect: DefectResponse
}

export interface DefectSyncResponse {
  sync_id: string
  sync_status: SyncStatus
  external_id?: string
  external_url?: string
}

export interface APIError {
  error: {
    code: string
    message: string
    details?: Array<{ code: string, path: string[], message: string }>
    request_id: string
  }
}

export const SEVERITY_LEVELS: Severity[] = ['critical', 'major', 'minor', 'trivial'];
export const DEFECT_TITLE_MAX = 200;
export const DEFECT_DESC_MAX = 5000;
