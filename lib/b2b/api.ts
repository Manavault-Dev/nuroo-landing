// Get API base URL from environment or use default
// In browser, use window.location.origin for same-origin, or explicit backend URL
const getApiBaseUrl = (): string => {
  // Check for explicit API URL first
  if (typeof window !== 'undefined') {
    // Client-side: use environment variable or default to backend port
    const envUrl = process.env.NEXT_PUBLIC_API_URL
    if (envUrl) return envUrl
    // Default to backend on different port
    return 'http://127.0.0.1:3001'
  }
  // Server-side: use environment variable or default
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'
}

const API_BASE_URL = getApiBaseUrl()

export interface SpecialistProfile {
  uid: string
  email: string
  name: string
  organizations: Array<{
    orgId: string
    orgName: string
    role: 'admin' | 'specialist'
  }>
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

export interface ParentFeedback {
  mood: 'good' | 'ok' | 'hard'
  comment?: string
  timestamp: string
}

export interface ActivityDay {
  date: string
  tasksAttempted: number
  tasksCompleted: number
  feedback?: ParentFeedback
}

export interface TimelineResponse {
  days: ActivityDay[]
}

export class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('b2b_token')
    }
  }

  setToken(token: string | null) {
    this.token = token
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('b2b_token', token)
      } else {
        localStorage.removeItem('b2b_token')
      }
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers)
    headers.set('Content-Type', 'application/json')
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`)
    }

    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = `${this.baseUrl}${normalizedEndpoint}`

    console.log(`🔗 [API] ${options.method || 'GET'} ${url}`)

    const response = await fetch(url, { ...options, headers })

    console.log(
      `📥 [API] Response status: ${response.status} for ${options.method || 'GET'} ${url}`
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      console.error(`❌ [API] Error response:`, error)
      throw new Error(error.error || 'API request failed')
    }

    const data = await response.json()
    console.log(`✅ [API] Response data for ${options.method || 'GET'} ${url}:`, data)
    return data
  }

  async health() {
    return this.request<{ status: string; timestamp: string; service: string }>('/health')
  }

  async getMe() {
    return this.request<SpecialistProfile>('/me')
  }

  async createProfile(name?: string) {
    return this.request<{ ok: boolean; specialist: SpecialistProfile; orgId?: string | null }>(
      '/me',
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      }
    )
  }

  async joinOrganization(inviteCode: string) {
    return this.request<{ ok: boolean; orgId: string }>('/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    })
  }

  async getSession() {
    return this.request<{ ok: boolean; hasOrg: boolean; orgId?: string }>('/session')
  }

  async getChildren(orgId: string) {
    return this.request<ChildSummary[]>(`/orgs/${orgId}/children`)
  }

  // ==================== Content Management (Super Admin) ====================

  /**
   * Get all tasks
   */
  async getTasks() {
    return this.request<{ ok: boolean; tasks: any[]; count: number }>('/admin/content/tasks')
  }

  /**
   * Create a new task
   */
  async createTask(task: any) {
    return this.request<{ ok: boolean; task: any }>('/admin/content/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    })
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, updates: any) {
    return this.request<{ ok: boolean; task: any }>(`/admin/content/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string) {
    return this.request<{ ok: boolean; message: string }>(`/admin/content/tasks/${taskId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Get all roadmaps
   */
  async getRoadmaps() {
    return this.request<{ ok: boolean; roadmaps: any[]; count: number }>('/admin/content/roadmaps')
  }

  /**
   * Create a new roadmap
   */
  async createRoadmap(roadmap: any) {
    return this.request<{ ok: boolean; roadmap: any }>('/admin/content/roadmaps', {
      method: 'POST',
      body: JSON.stringify(roadmap),
    })
  }

  /**
   * Update a roadmap
   */
  async updateRoadmap(roadmapId: string, updates: any) {
    return this.request<{ ok: boolean; roadmap: any }>(`/admin/content/roadmaps/${roadmapId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  /**
   * Delete a roadmap
   */
  async deleteRoadmap(roadmapId: string) {
    return this.request<{ ok: boolean; message: string }>(`/admin/content/roadmaps/${roadmapId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Get all materials
   */
  async getMaterials() {
    return this.request<{ ok: boolean; materials: any[]; count: number }>(
      '/admin/content/materials'
    )
  }

  /**
   * Create a new material
   */
  async createMaterial(material: any) {
    return this.request<{ ok: boolean; material: any }>('/admin/content/materials', {
      method: 'POST',
      body: JSON.stringify(material),
    })
  }

  /**
   * Update a material
   */
  async updateMaterial(materialId: string, updates: any) {
    return this.request<{ ok: boolean; material: any }>(`/admin/content/materials/${materialId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  /**
   * Delete a material
   */
  async deleteMaterial(materialId: string) {
    return this.request<{ ok: boolean; message: string }>(
      `/admin/content/materials/${materialId}`,
      {
        method: 'DELETE',
      }
    )
  }

  /**
   * Get all videos
   */
  async getVideos() {
    return this.request<{ ok: boolean; videos: any[]; count: number }>('/admin/content/videos')
  }

  /**
   * Create a new video
   */
  async createVideo(video: any) {
    return this.request<{ ok: boolean; video: any }>('/admin/content/videos', {
      method: 'POST',
      body: JSON.stringify(video),
    })
  }

  /**
   * Update a video
   */
  async updateVideo(videoId: string, updates: any) {
    return this.request<{ ok: boolean; video: any }>(`/admin/content/videos/${videoId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  /**
   * Delete a video
   */
  async deleteVideo(videoId: string) {
    return this.request<{ ok: boolean; message: string }>(`/admin/content/videos/${videoId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Get parent connections with children for specialist (mobile app)
   */
  async getConnections(orgId: string) {
    return this.request<{
      ok: boolean
      connections: Array<{
        parentUserId: string
        parentName: string
        parentEmail: string | null
        specialistId: string | null
        joinedAt: string | null
        children: Array<{
          childId: string
          childName: string
          childAge?: number
          assignedAt: string | null
        }>
      }>
      count: number
    }>(`/orgs/${orgId}/connections`)
  }

  async getChildDetail(orgId: string, childId: string) {
    return this.request<ChildDetail>(`/orgs/${orgId}/children/${childId}`)
  }

  async getTimeline(orgId: string, childId: string, days: number = 30) {
    return this.request<TimelineResponse>(
      `/orgs/${orgId}/children/${childId}/timeline?days=${days}`
    )
  }

  async getNotes(orgId: string, childId: string) {
    return this.request<SpecialistNote[]>(`/orgs/${orgId}/children/${childId}/notes`)
  }

  async createNote(
    orgId: string,
    childId: string,
    text: string,
    tags?: string[],
    visibleToParent: boolean = true
  ) {
    return this.request<SpecialistNote>(`/orgs/${orgId}/children/${childId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text, tags, visibleToParent }),
    })
  }

  async createInvite(
    orgId: string,
    options?: { role?: 'specialist' | 'admin'; maxUses?: number; expiresInDays?: number }
  ) {
    return this.request<{
      ok: boolean
      inviteCode: string
      expiresAt: string
      role: 'specialist' | 'admin'
      maxUses: number | null
    }>(`/orgs/${orgId}/invites`, {
      method: 'POST',
      body: JSON.stringify({
        role: options?.role || 'specialist',
        maxUses: options?.maxUses,
        expiresInDays: options?.expiresInDays || 30,
      }),
    })
  }

  /**
   * Create parent invite code for a specific organization (Specialist only)
   */
  async createParentInvite(orgId: string) {
    return this.request<{ ok: boolean; inviteCode: string; expiresAt: string; orgId: string }>(
      `/orgs/${orgId}/parent-invites`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    )
  }

  /**
   * Create parent invite for personal organization (legacy endpoint)
   */
  async createParentInviteLegacy() {
    return this.request<{ ok: boolean; inviteCode: string; expiresAt: string; orgId: string }>(
      '/specialists/invites',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    )
  }

  /**
   * Accept an invite code and join organization
   * This is the NEW invite-based onboarding endpoint
   */
  async acceptInvite(code: string) {
    return this.request<{ ok: boolean; orgId: string; role: string; orgName: string }>(
      '/invites/accept',
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      }
    )
  }

  // ==================== Super Admin Methods ====================

  /**
   * Create a new organization (Super Admin only)
   */
  async createOrganization(name: string, country?: string) {
    return this.request<{ ok: boolean; orgId: string; name: string; country: string | null }>(
      '/admin/organizations',
      {
        method: 'POST',
        body: JSON.stringify({ name, country }),
      }
    )
  }

  /**
   * List all organizations (Super Admin only)
   */
  async listOrganizations() {
    return this.request<{
      ok: boolean
      organizations: Array<{
        orgId: string
        name: string
        country: string | null
        createdAt: string | null
        createdBy: string | null
        isActive: boolean
      }>
      count: number
    }>('/admin/organizations')
  }

  /**
   * Generate an invite code for an organization (Super Admin only)
   */
  async generateInviteCode(data: {
    orgId: string
    role: 'org_admin' | 'specialist' | 'parent'
    expiresAt?: string
    maxUses?: number
  }) {
    return this.request<{
      ok: boolean
      code: string
      inviteLink: string
      orgId: string
      orgName: string
      role: string
      expiresAt: string | null
      maxUses: number | null
    }>('/admin/invites', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * List recent invite codes (Super Admin only)
   */
  async listInvites() {
    return this.request<{
      ok: boolean
      invites: Array<{
        code: string
        inviteLink: string
        orgId: string
        orgName: string
        role: string
        expiresAt: string | null
        maxUses: number | null
        usedCount: number
        isActive: boolean
        createdAt: string | null
      }>
      count: number
    }>('/admin/invites')
  }

  /**
   * Check if current user is Super Admin (dev only)
   */
  async checkSuperAdmin() {
    return this.request<{
      uid: string
      email: string | undefined
      isSuperAdmin: boolean
      claims?: any
    }>('/dev/check-super-admin')
  }

  // ==================== Super Admin Management ====================

  /**
   * Grant Super Admin rights to a user (Super Admin only)
   */
  async grantSuperAdmin(email: string) {
    return this.request<{ ok: boolean; message: string; uid: string; email: string; note: string }>(
      '/admin/super-admin',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    )
  }

  /**
   * Remove Super Admin rights from a user (Super Admin only)
   */
  async removeSuperAdmin(uid: string) {
    return this.request<{ ok: boolean; message: string; uid: string; email: string }>(
      `/admin/super-admin/${uid}`,
      {
        method: 'DELETE',
      }
    )
  }

  /**
   * List all Super Admins (Super Admin only)
   */
  async listSuperAdmins() {
    return this.request<{
      ok: boolean
      superAdmins: Array<{
        uid: string
        email: string
        displayName: string | null
        createdAt: string
        lastSignIn: string | null
      }>
      count: number
    }>('/admin/super-admin')
  }

  /**
   * Get specialists in an organization (Super Admin only)
   */
  async getOrgSpecialists(orgId: string) {
    return this.request<{
      ok: boolean
      specialists: Array<{
        uid: string
        email: string
        name: string
        role: 'org_admin' | 'specialist'
        joinedAt: string | null
        createdAt: string | null
      }>
      count: number
    }>(`/admin/orgs/${orgId}/specialists`)
  }

  /**
   * Get parents in an organization (Super Admin only)
   */
  async getOrgParents(orgId: string) {
    return this.request<{
      ok: boolean
      parents: Array<{
        id: string
        name: string
        email?: string | null
        phone?: string | null
        linkedChildren?: string[]
        createdAt: string | null
        updatedAt: string | null
      }>
      count: number
    }>(`/admin/orgs/${orgId}/parents`)
  }

  /**
   * Get children in an organization (Super Admin only)
   */
  async getOrgChildren(orgId: string) {
    return this.request<{
      ok: boolean
      children: Array<{
        id: string
        name: string
        age?: number
        assignedAt: string | null
      }>
      count: number
    }>(`/admin/orgs/${orgId}/children`)
  }

  /**
   * Get parents in an organization (Org Admin only, via regular endpoint)
   */
  async getParents(orgId: string) {
    return this.request<{
      ok: boolean
      parents: Array<{
        id: string
        name: string
        email?: string | null
        phone?: string | null
        linkedChildren?: string[]
        createdAt: string | null
        updatedAt: string | null
      }>
    }>(`/orgs/${orgId}/parents`)
  }

  // ==================== Groups Methods ====================

  /**
   * Get all groups for the current specialist in an organization
   */
  async getGroups(orgId: string) {
    return this.request<{
      ok: boolean
      groups: Array<{
        id: string
        name: string
        description: string | null
        color: string
        orgId: string
        parentCount: number
        createdAt: string | null
        updatedAt: string | null
      }>
      count: number
    }>(`/orgs/${orgId}/groups`)
  }

  /**
   * Create a new group
   */
  async createGroup(orgId: string, name: string, description?: string, color?: string) {
    return this.request<{
      ok: boolean
      group: {
        id: string
        name: string
        description: string | null
        color: string
        orgId: string
        parentCount: number
        createdAt: string
        updatedAt: string
      }
    }>(`/orgs/${orgId}/groups`, {
      method: 'POST',
      body: JSON.stringify({ name, description, color }),
    })
  }

  /**
   * Get group details with parents
   */
  async getGroup(orgId: string, groupId: string) {
    return this.request<{
      ok: boolean
      group: {
        id: string
        name: string
        description: string | null
        color: string
        orgId: string
        parents: Array<{
          parentUserId: string
          name: string
          email: string | null
          children: Array<{
            id: string
            name: string
            age?: number
          }>
          addedAt: string | null
        }>
        parentCount: number
        createdAt: string | null
        updatedAt: string | null
      }
    }>(`/orgs/${orgId}/groups/${groupId}`)
  }

  /**
   * Update group
   */
  async updateGroup(
    orgId: string,
    groupId: string,
    updates: { name?: string; description?: string; color?: string }
  ) {
    return this.request<{
      ok: boolean
      message: string
    }>(`/orgs/${orgId}/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  /**
   * Delete group
   */
  async deleteGroup(orgId: string, groupId: string) {
    return this.request<{
      ok: boolean
      message: string
    }>(`/orgs/${orgId}/groups/${groupId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Add parent to group
   */
  async addParentToGroup(
    orgId: string,
    groupId: string,
    parentUserId: string,
    childIds?: string[]
  ) {
    return this.request<{
      ok: boolean
      message: string
    }>(`/orgs/${orgId}/groups/${groupId}/parents`, {
      method: 'POST',
      body: JSON.stringify({ parentUserId, childIds }),
    })
  }

  /**
   * Remove parent from group
   */
  async removeParentFromGroup(orgId: string, groupId: string, parentUserId: string) {
    return this.request<{
      ok: boolean
      message: string
    }>(`/orgs/${orgId}/groups/${groupId}/parents/${parentUserId}`, {
      method: 'DELETE',
    })
  }
}

export const apiClient = new ApiClient()
