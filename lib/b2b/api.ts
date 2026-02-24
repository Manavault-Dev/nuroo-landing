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

// Cache entry type
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

// In-flight request tracking to prevent duplicate requests
const inFlightRequests = new Map<string, Promise<unknown>>()

// Simple in-memory cache for API responses
class ApiCache {
  private cache = new Map<string, CacheEntry<unknown>>()

  // Cache TTLs in milliseconds
  private static TTL = {
    profile: 5 * 60 * 1000, // 5 minutes for user profile
    superAdmin: 5 * 60 * 1000, // 5 minutes for super admin check
    children: 60 * 1000, // 1 minute for children list
    childDetail: 30 * 1000, // 30 seconds for child details
    organizations: 2 * 60 * 1000, // 2 minutes for org list
    default: 30 * 1000, // 30 seconds default
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  set<T>(key: string, data: T, ttlKey?: keyof typeof ApiCache.TTL): void {
    const ttl = ttlKey ? ApiCache.TTL[ttlKey] : ApiCache.TTL.default
    this.cache.set(key, { data, timestamp: Date.now(), ttl })
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      return
    }
    const keys = Array.from(this.cache.keys())
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    })
  }

  // Invalidate on mutations
  invalidateOnMutation(endpoint: string): void {
    if (endpoint.includes('/notes')) {
      this.invalidate('/notes')
    } else if (endpoint.includes('/children')) {
      this.invalidate('/children')
    } else if (endpoint.includes('/invites')) {
      this.invalidate('/invites')
    } else if (endpoint.includes('/organizations')) {
      this.invalidate('/organizations')
    } else if (endpoint.includes('/groups')) {
      this.invalidate('/groups')
    }
  }
}

const cache = new ApiCache()

// API Client with caching and request deduplication
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
    // Clear cache when token changes (user switch)
    if (!token) {
      cache.invalidate()
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

  // Cached GET request with deduplication
  private async cachedRequest<T>(
    endpoint: string,
    cacheKey: string,
    ttlKey?: 'profile' | 'superAdmin' | 'children' | 'childDetail' | 'organizations' | 'default'
  ): Promise<T> {
    // Check cache first
    const cached = cache.get<T>(cacheKey)
    if (cached) return cached

    // Check for in-flight request to prevent duplicates
    const inFlight = inFlightRequests.get(cacheKey)
    if (inFlight) {
      return inFlight as Promise<T>
    }

    // Make the request
    const requestPromise = this.request<T>(endpoint)
      .then((data) => {
        cache.set(cacheKey, data, ttlKey)
        inFlightRequests.delete(cacheKey)
        return data
      })
      .catch((error) => {
        inFlightRequests.delete(cacheKey)
        throw error
      })

    inFlightRequests.set(cacheKey, requestPromise)
    return requestPromise
  }

  // Auth & Profile
  async health() {
    return this.request<{ status: string; timestamp: string }>('/health')
  }

  async getMe() {
    return this.cachedRequest<SpecialistProfile>('/me', 'profile:me', 'profile')
  }

  async createProfile(name?: string) {
    cache.invalidate('profile')
    return this.request<{ ok: boolean; specialist: SpecialistProfile }>('/me', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  }

  async getSession() {
    return this.request<{ ok: boolean; hasOrg: boolean; orgId?: string }>('/session')
  }

  async joinOrganization(inviteCode: string) {
    cache.invalidate()
    return this.request<{ ok: boolean; orgId: string }>('/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    })
  }

  async getPlans() {
    return this.cachedRequest<{
      ok: boolean
      plans: Array<{
        id: string
        name: string
        price: number
        currency: string
        limits?: { children: number; specialists: number | null } | null
      }>
    }>('/plans', 'billing:plans', 'default')
  }

  async createPayment(orgId: string, planId: 'starter' | 'growth') {
    cache.invalidate()
    return this.request<{ paymentUrl?: string; error?: string }>(`/orgs/${orgId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ orgId, planId }),
    })
  }

  async getBillingStatus(orgId: string) {
    return this.request<{
      ok: boolean
      active: boolean
      planId: string | null
      error: string | null
      expiresAt: string | null
      limits: { children: number; specialists: number | null } | null
    }>(`/orgs/${orgId}/billing/status`)
  }

  async verifyPayment(paymentId: string) {
    return this.request<{
      ok: boolean
      payment: { id: string; status: string; planId: string; amount: number; currency: string }
      error?: string
    }>(`/payments/${paymentId}/verify`)
  }

  async acceptInvite(code: string) {
    cache.invalidate()
    return this.request<{ ok: boolean; orgId: string; role: string; orgName: string }>(
      '/invites/accept',
      { method: 'POST', body: JSON.stringify({ code }) }
    )
  }

  // Children
  async getChildren(orgId: string) {
    return this.cachedRequest<ChildSummary[]>(
      `/orgs/${orgId}/children`,
      `children:${orgId}`,
      'children'
    )
  }

  async getChildDetail(orgId: string, childId: string) {
    return this.cachedRequest<ChildDetail>(
      `/orgs/${orgId}/children/${childId}`,
      `child:${orgId}:${childId}`,
      'childDetail'
    )
  }

  async getTimeline(orgId: string, childId: string, days = 30) {
    return this.cachedRequest<{ days: ActivityDay[] }>(
      `/orgs/${orgId}/children/${childId}/timeline?days=${days}`,
      `timeline:${orgId}:${childId}:${days}`,
      'default'
    )
  }

  // Notes
  async getNotes(orgId: string, childId: string) {
    return this.cachedRequest<SpecialistNote[]>(
      `/orgs/${orgId}/children/${childId}/notes`,
      `notes:${orgId}:${childId}`,
      'default'
    )
  }

  async createNote(
    orgId: string,
    childId: string,
    text: string,
    tags?: string[],
    visibleToParent = true
  ) {
    cache.invalidate(`notes:${orgId}:${childId}`)
    return this.request<SpecialistNote>(`/orgs/${orgId}/children/${childId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text, tags, visibleToParent }),
    })
  }

  // Team
  async getTeam(orgId: string) {
    return this.cachedRequest<
      Array<{
        uid: string
        email: string
        name: string
        role: 'admin' | 'specialist'
        joinedAt: string
      }>
    >(`/orgs/${orgId}/team`, `team:${orgId}`, 'default')
  }

  async removeMember(orgId: string, uid: string) {
    cache.invalidate(`team:${orgId}`)
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/members/${uid}`, { method: 'DELETE' })
  }

  async updateMemberRole(orgId: string, uid: string, role: 'org_admin' | 'specialist') {
    cache.invalidate(`team:${orgId}`)
    return this.request<{ ok: boolean; role: string }>(`/orgs/${orgId}/members/${uid}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
  }

  // Invites
  async createInvite(
    orgId: string,
    options?: { role?: string; maxUses?: number; expiresInDays?: number }
  ) {
    cache.invalidate('invites')
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

  // Self-serve: create org and become org admin
  async createMyOrganization(name: string, country?: string) {
    cache.invalidate('profile')
    cache.invalidate('organizations')
    return this.request<{ ok: boolean; orgId: string; name: string; country: string | null }>(
      '/orgs',
      {
        method: 'POST',
        body: JSON.stringify({ name, country }),
      }
    )
  }

  async createParentInvite(orgId: string) {
    cache.invalidate('invites')
    return this.request<{ ok: boolean; inviteCode: string; expiresAt: string }>(
      `/orgs/${orgId}/parent-invites`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    )
  }

  // Parents & Connections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getParents(orgId: string) {
    return this.cachedRequest<{ ok: boolean; parents: any[] }>(
      `/orgs/${orgId}/parents`,
      `parents:${orgId}`,
      'default'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getConnections(orgId: string) {
    return this.cachedRequest<{ ok: boolean; connections: any[]; count: number }>(
      `/orgs/${orgId}/connections`,
      `connections:${orgId}`,
      'default'
    )
  }

  // Groups
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getGroups(orgId: string) {
    return this.cachedRequest<{ ok: boolean; groups: any[]; count: number }>(
      `/orgs/${orgId}/groups`,
      `groups:${orgId}`,
      'default'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createGroup(orgId: string, name: string, description?: string, color?: string) {
    cache.invalidate(`groups:${orgId}`)
    return this.request<{ ok: boolean; group: any }>(`/orgs/${orgId}/groups`, {
      method: 'POST',
      body: JSON.stringify({ name, description, color }),
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getGroup(orgId: string, groupId: string) {
    return this.cachedRequest<{ ok: boolean; group: any }>(
      `/orgs/${orgId}/groups/${groupId}`,
      `group:${orgId}:${groupId}`,
      'default'
    )
  }

  async updateGroup(
    orgId: string,
    groupId: string,
    updates: { name?: string; description?: string; color?: string }
  ) {
    cache.invalidate(`groups:${orgId}`)
    cache.invalidate(`group:${orgId}:${groupId}`)
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  async deleteGroup(orgId: string, groupId: string) {
    cache.invalidate(`groups:${orgId}`)
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/groups/${groupId}`, { method: 'DELETE' })
  }

  async addParentToGroup(
    orgId: string,
    groupId: string,
    parentUserId: string,
    childIds?: string[]
  ) {
    cache.invalidate(`group:${orgId}:${groupId}`)
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/groups/${groupId}/parents`, {
      method: 'POST',
      body: JSON.stringify({ parentUserId, childIds }),
    })
  }

  async removeParentFromGroup(orgId: string, groupId: string, parentUserId: string) {
    cache.invalidate(`group:${orgId}:${groupId}`)
    return this.request<{ ok: boolean }>(
      `/orgs/${orgId}/groups/${groupId}/parents/${parentUserId}`,
      { method: 'DELETE' }
    )
  }

  // Admin: Organizations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async listOrganizations() {
    return this.cachedRequest<{ ok: boolean; organizations: any[]; count: number }>(
      '/admin/organizations',
      'admin:organizations',
      'organizations'
    )
  }

  async createOrganization(name: string, country?: string) {
    cache.invalidate('admin:organizations')
    return this.request<{ ok: boolean; orgId: string; name: string }>('/admin/organizations', {
      method: 'POST',
      body: JSON.stringify({ name, country }),
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getOrgSpecialists(orgId: string) {
    return this.cachedRequest<{ ok: boolean; specialists: any[]; count: number }>(
      `/admin/orgs/${orgId}/specialists`,
      `admin:specialists:${orgId}`,
      'default'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getOrgParents(orgId: string) {
    return this.cachedRequest<{ ok: boolean; parents: any[]; count: number }>(
      `/admin/orgs/${orgId}/parents`,
      `admin:parents:${orgId}`,
      'default'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getOrgChildren(orgId: string) {
    return this.cachedRequest<{ ok: boolean; children: any[]; count: number }>(
      `/admin/orgs/${orgId}/children`,
      `admin:children:${orgId}`,
      'default'
    )
  }

  // Admin: Invites
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async listInvites() {
    return this.cachedRequest<{ ok: boolean; invites: any[]; count: number }>(
      '/admin/invites',
      'admin:invites',
      'default'
    )
  }

  async generateInviteCode(data: {
    orgId: string
    role: string
    expiresAt?: string
    maxUses?: number
  }) {
    cache.invalidate('admin:invites')
    return this.request<{ ok: boolean; code: string; inviteLink: string }>('/admin/invites', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Admin: Super Admin
  async checkSuperAdmin() {
    return this.cachedRequest<{ uid: string; email?: string; isSuperAdmin: boolean }>(
      '/dev/check-super-admin',
      'superAdmin:check',
      'superAdmin'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async listSuperAdmins() {
    return this.cachedRequest<{ ok: boolean; superAdmins: any[]; count: number }>(
      '/admin/super-admin',
      'admin:superAdmins',
      'default'
    )
  }

  async grantSuperAdmin(email: string) {
    cache.invalidate('admin:superAdmins')
    return this.request<{ ok: boolean; uid: string; email: string }>('/admin/super-admin', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  async removeSuperAdmin(uid: string) {
    cache.invalidate('admin:superAdmins')
    return this.request<{ ok: boolean }>(`/admin/super-admin/${uid}`, { method: 'DELETE' })
  }

  // Admin: Content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getTasks() {
    return this.cachedRequest<{ ok: boolean; tasks: any[]; count: number }>(
      '/admin/content/tasks',
      'admin:tasks',
      'default'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createTask(task: any) {
    cache.invalidate('admin:tasks')
    return this.request<{ ok: boolean; task: any }>('/admin/content/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateTask(taskId: string, updates: any) {
    cache.invalidate('admin:tasks')
    return this.request<{ ok: boolean; task: any }>(`/admin/content/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  async deleteTask(taskId: string) {
    cache.invalidate('admin:tasks')
    return this.request<{ ok: boolean }>(`/admin/content/tasks/${taskId}`, { method: 'DELETE' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getRoadmaps() {
    return this.cachedRequest<{ ok: boolean; roadmaps: any[]; count: number }>(
      '/admin/content/roadmaps',
      'admin:roadmaps',
      'default'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createRoadmap(roadmap: any) {
    cache.invalidate('admin:roadmaps')
    return this.request<{ ok: boolean; roadmap: any }>('/admin/content/roadmaps', {
      method: 'POST',
      body: JSON.stringify(roadmap),
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateRoadmap(roadmapId: string, updates: any) {
    cache.invalidate('admin:roadmaps')
    return this.request<{ ok: boolean; roadmap: any }>(`/admin/content/roadmaps/${roadmapId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  async deleteRoadmap(roadmapId: string) {
    cache.invalidate('admin:roadmaps')
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

    cache.invalidate('admin:tasks')
    return response.json()
  }

  // Alphakids access codes for parents (7d / 30d / forever)
  async createAlphakidsCode(duration: '7d' | '30d' | 'forever') {
    return this.request<{ ok: boolean; code: string; duration: string; expiresAt: string | null }>(
      '/admin/content/alphakids-codes',
      { method: 'POST', body: JSON.stringify({ duration }) }
    )
  }

  async getAlphakidsCodes() {
    return this.request<{
      ok: boolean
      codes: Array<{
        code: string
        duration: string
        expiresAt: string | null
        createdAt: string | null
      }>
      count: number
    }>('/admin/content/alphakids-codes')
  }

  // Clear all cache (useful for logout)
  clearCache() {
    cache.invalidate()
  }
}

export const apiClient = new ApiClient()
