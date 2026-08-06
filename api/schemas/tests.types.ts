export interface TestCreatePayload {
  title: string
  atc_ids: string[]
  workspace_id?: string
}

export interface TestAtcRef {
  atc_id: string
  position: number
}

export interface TestResponse {
  id: string
  title: string
  steps: TestAtcRef[]
  workspace_id: string
  created_by: string
  created_at: string
}

export interface TestCreateResponse {
  test: TestResponse
}
