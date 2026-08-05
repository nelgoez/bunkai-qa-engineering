export interface UserStoryCreatePayload {
  title: string
  description?: string
  external_id?: string
}

export interface UserStoryResponse {
  id: string
  module_id: string
  project_id: string
  title: string
  description: string | null
  external_id: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface UserStoryCreateResponse {
  user_story: UserStoryResponse
}

export interface UserStoryUpdatePayload {
  title?: string
  description?: string | null
  external_id?: string | null
}
