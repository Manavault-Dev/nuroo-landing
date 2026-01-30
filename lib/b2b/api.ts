const API_BASE_URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'
    : process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'

// Types
export interface SpecialistProfile {
  uid: string
  email: string
  name: string
  organizations: Array<{ orgId: string; orgName: string; role: 'admin' | 'specialist' }>
}

export interface ChildSummary {
  id: string
  name: string
  age?: number
  speechStepId?: string
  speechStepNumber?: number
  lastActiveDate?: string
  completedTasksCount: number
}

export interface ParentInfo {
  uid: string
  displayName?: string
  email?: string
  linkedAt?: string
}

export interface ChildDetail extends ChildSummary {
  organizationId: string
  parentInfo?: ParentInfo
  recentTasks: Array<{
    id: string
    title: string
    status: 'completed' | 'pending' | 'in-progress'
    completedAt?: string
  }>
}

export interface SpecialistNote {
  id: string
  childId: string
  orgId: string
  specialistId: string
  specialistName: string
  text: string
  tags?: string[]
  visibleToParent?: boolean
  createdAt: string
  updatedAt: string
}

export interface ActivityDay {
  date: string
  tasksAttempted: number
  tasksCompleted: number
  feedback?: { mood: 'good' | 'ok' | 'hard'; comment?: string; timestamp: string }
}

export type TimelineResponse = { days: ActivityDay[] }

// API Client
export class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('b2b_token')
    }
  }

  setToken(token: string | null) {
    this.token = token
    if (typeof window !== 'undefined') {
      token ? localStorage.setItem('b2b_token', token) : localStorage.removeItem('b2b_token')
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers)
    headers.set('Content-Type', 'application/json')
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`)

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
    const response = await fetch(url, { ...options, headers })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(error.error || 'API request failed')
    }

    return response.json()
  }

  // Auth & Profile
  async health() {
    return this.request<{ status: string; timestamp: string }>('/health')
  }

  async getMe() {
    return this.request<SpecialistProfile>('/me')
  }

  async createProfile(name?: string) {
    return this.request<{ ok: boolean; specialist: SpecialistProfile }>('/me', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  }

  async getSession() {
    return this.request<{ ok: boolean; hasOrg: boolean; orgId?: string }>('/session')
  }

  async joinOrganization(inviteCode: string) {
    return this.request<{ ok: boolean; orgId: string }>('/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    })
  }

  async acceptInvite(code: string) {
    return this.request<{ ok: boolean; orgId: string; role: string; orgName: string }>(
      '/invites/accept',
      { method: 'POST', body: JSON.stringify({ code }) }
    )
  }

  // Children
  async getChildren(orgId: string) {
    return this.request<ChildSummary[]>(`/orgs/${orgId}/children`)
  }

  async getChildDetail(orgId: string, childId: string) {
    return this.request<ChildDetail>(`/orgs/${orgId}/children/${childId}`)
  }

  async getTimeline(orgId: string, childId: string, days = 30) {
    return this.request<{ days: ActivityDay[] }>(
      `/orgs/${orgId}/children/${childId}/timeline?days=${days}`
    )
  }

  // Notes
  async getNotes(orgId: string, childId: string) {
    return this.request<SpecialistNote[]>(`/orgs/${orgId}/children/${childId}/notes`)
  }

  async createNote(
    orgId: string,
    childId: string,
    text: string,
    tags?: string[],
    visibleToParent = true
  ) {
    return this.request<SpecialistNote>(`/orgs/${orgId}/children/${childId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text, tags, visibleToParent }),
    })
  }

  // Invites
  async createInvite(
    orgId: string,
    options?: { role?: string; maxUses?: number; expiresInDays?: number }
  ) {
    return this.request<{ ok: boolean; inviteCode: string; expiresAt: string }>(
      `/orgs/${orgId}/invites`,
      {
        method: 'POST',
        body: JSON.stringify({
          role: options?.role || 'specialist',
          maxUses: options?.maxUses,
          expiresInDays: options?.expiresInDays || 30,
        }),
      }
    )
  }

  async createParentInvite(orgId: string) {
    return this.request<{ ok: boolean; inviteCode: string; expiresAt: string }>(
      `/orgs/${orgId}/parent-invites`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    )
  }

  // Parents & Connections
  async getParents(orgId: string) {
    return this.request<{ ok: boolean; parents: any[] }>(`/orgs/${orgId}/parents`)
  }

  async getConnections(orgId: string) {
    return this.request<{ ok: boolean; connections: any[]; count: number }>(
      `/orgs/${orgId}/connections`
    )
  }

  // Groups
  async getGroups(orgId: string) {
    return this.request<{ ok: boolean; groups: any[]; count: number }>(`/orgs/${orgId}/groups`)
  }

  async createGroup(orgId: string, name: string, description?: string, color?: string) {
    return this.request<{ ok: boolean; group: any }>(`/orgs/${orgId}/groups`, {
      method: 'POST',
      body: JSON.stringify({ name, description, color }),
    })
  }

  async getGroup(orgId: string, groupId: string) {
    return this.request<{ ok: boolean; group: any }>(`/orgs/${orgId}/groups/${groupId}`)
  }

  async updateGroup(
    orgId: string,
    groupId: string,
    updates: { name?: string; description?: string; color?: string }
  ) {
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  async deleteGroup(orgId: string, groupId: string) {
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/groups/${groupId}`, { method: 'DELETE' })
  }

  async addParentToGroup(
    orgId: string,
    groupId: string,
    parentUserId: string,
    childIds?: string[]
  ) {
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/groups/${groupId}/parents`, {
      method: 'POST',
      body: JSON.stringify({ parentUserId, childIds }),
    })
  }

  async removeParentFromGroup(orgId: string, groupId: string, parentUserId: string) {
    return this.request<{ ok: boolean }>(
      `/orgs/${orgId}/groups/${groupId}/parents/${parentUserId}`,
      { method: 'DELETE' }
    )
  }

  // Admin: Organizations
  async listOrganizations() {
    return this.request<{ ok: boolean; organizations: any[]; count: number }>(
      '/admin/organizations'
    )
  }

  async createOrganization(name: string, country?: string) {
    return this.request<{ ok: boolean; orgId: string; name: string }>('/admin/organizations', {
      method: 'POST',
      body: JSON.stringify({ name, country }),
    })
  }

  async getOrgSpecialists(orgId: string) {
    return this.request<{ ok: boolean; specialists: any[]; count: number }>(
      `/admin/orgs/${orgId}/specialists`
    )
  }

  async getOrgParents(orgId: string) {
    return this.request<{ ok: boolean; parents: any[]; count: number }>(
      `/admin/orgs/${orgId}/parents`
    )
  }

  async getOrgChildren(orgId: string) {
    return this.request<{ ok: boolean; children: any[]; count: number }>(
      `/admin/orgs/${orgId}/children`
    )
  }

  // Admin: Invites
  async listInvites() {
    return this.request<{ ok: boolean; invites: any[]; count: number }>('/admin/invites')
  }

  async generateInviteCode(data: {
    orgId: string
    role: string
    expiresAt?: string
    maxUses?: number
  }) {
    return this.request<{ ok: boolean; code: string; inviteLink: string }>('/admin/invites', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Admin: Super Admin
  async checkSuperAdmin() {
    return this.request<{ uid: string; email?: string; isSuperAdmin: boolean }>(
      '/dev/check-super-admin'
    )
  }

  async listSuperAdmins() {
    return this.request<{ ok: boolean; superAdmins: any[]; count: number }>('/admin/super-admin')
  }

  async grantSuperAdmin(email: string) {
    return this.request<{ ok: boolean; uid: string; email: string }>('/admin/super-admin', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  async removeSuperAdmin(uid: string) {
    return this.request<{ ok: boolean }>(`/admin/super-admin/${uid}`, { method: 'DELETE' })
  }

  // Admin: Content
  async getTasks() {
    return this.request<{ ok: boolean; tasks: any[]; count: number }>('/admin/content/tasks')
  }

  async createTask(task: any) {
    return this.request<{ ok: boolean; task: any }>('/admin/content/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    })
  }

  async updateTask(taskId: string, updates: any) {
    return this.request<{ ok: boolean; task: any }>(`/admin/content/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  async deleteTask(taskId: string) {
    return this.request<{ ok: boolean }>(`/admin/content/tasks/${taskId}`, { method: 'DELETE' })
  }

  async getRoadmaps() {
    return this.request<{ ok: boolean; roadmaps: any[]; count: number }>('/admin/content/roadmaps')
  }

  async createRoadmap(roadmap: any) {
    return this.request<{ ok: boolean; roadmap: any }>('/admin/content/roadmaps', {
      method: 'POST',
      body: JSON.stringify(roadmap),
    })
  }

  async updateRoadmap(roadmapId: string, updates: any) {
    return this.request<{ ok: boolean; roadmap: any }>(`/admin/content/roadmaps/${roadmapId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  async deleteRoadmap(roadmapId: string) {
    return this.request<{ ok: boolean }>(`/admin/content/roadmaps/${roadmapId}`, {
      method: 'DELETE',
    })
  }

  async uploadTaskMedia(
    file: File,
    title: string,
    options?: {
      description?: string
      category?: string
      difficulty?: 'easy' | 'medium' | 'hard'
      estimatedDuration?: number
      ageRange?: { min: number; max: number }
      instructions?: string[]
      taskId?: string
    }
  ) {
    const formData = new FormData()

    // Fields first, then file
    formData.append('title', title)
    if (options?.description) formData.append('description', options.description)
    if (options?.category) formData.append('category', options.category)
    if (options?.difficulty) formData.append('difficulty', options.difficulty)
    if (options?.estimatedDuration)
      formData.append('estimatedDuration', options.estimatedDuration.toString())
    if (options?.ageRange) {
      formData.append('ageRangeMin', options.ageRange.min.toString())
      formData.append('ageRangeMax', options.ageRange.max.toString())
    }
    if (options?.instructions?.length)
      formData.append('instructions', JSON.stringify(options.instructions))
    formData.append('media', file)

    const headers = new Headers()
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`)

    const url = `${this.baseUrl}/admin/content/tasks/upload${options?.taskId ? `?taskId=${options.taskId}` : ''}`
    const response = await fetch(url, { method: 'POST', body: formData, headers })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(error.error || error.details || 'Upload failed')
    }

    return response.json()
  }
}

export const apiClient = new ApiClient()
