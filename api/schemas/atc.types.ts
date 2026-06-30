export interface StepInput {
  position: number
  content: string
  input_data?: string
  expected?: string
}

export interface AssertionInput {
  content: string
}

export interface ATCCreatePayload {
  title: string
  module_id: string
  user_story_id: string
  acceptance_criterion_ids: string[]
  layer: 'UI' | 'API' | 'Unit'
  steps: StepInput[]
  assertions?: AssertionInput[]
  tags?: string[]
}

export interface ATCStep {
  id: string
  position: number
  content: string
  input_data: string | null
  expected: string | null
}

export interface ATCAssertion {
  id: string
  position: number
  content: string
}

export interface ATCResponse {
  id: string
  slug: string
  title: string
  module_id: string
  user_story_id: string
  layer: 'UI' | 'API' | 'Unit'
  version: number
  tags: string[]
  steps: ATCStep[]
  assertions: ATCAssertion[]
  acceptance_criterion_ids: string[]
  affected_test_ids: string[] | null
  created_at: string
  updated_at: string
  project_id?: string
  status?: string
  archived_at?: string | null
}

export interface ATCCreateResponse {
  atc: ATCResponse
}

export interface ATCUpdateResponse {
  atc: ATCResponse
}

export interface APIError {
  error: {
    code: string
    message: string
    details?: Array<{
      expected?: string
      code: string
      path: string[]
      message: string
      minimum?: number
      inclusive?: boolean
      origin?: string
    }>
    request_id: string
  }
}
