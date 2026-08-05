export interface WorkspaceCreatePayload {
  name: string
  slug: string
}

export interface WorkspaceResponse {
  id: string
  slug: string
  name: string
  owner_user_id: string
  plan: string
  created_at: string
}

export interface WorkspaceCreateResponse {
  workspace: WorkspaceResponse
}
