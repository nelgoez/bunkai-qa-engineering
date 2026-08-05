export interface ProjectCreatePayload {
  name: string
  description?: string
}

export interface ProjectResponse {
  id: string
  slug: string
  name: string
  description: string | null
  workspace_id: string
  created_at: string
}

export interface ProjectCreateResponse {
  project: ProjectResponse
}
