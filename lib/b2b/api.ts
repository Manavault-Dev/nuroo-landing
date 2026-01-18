const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'

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

export interface ChildDetail extends ChildSummary {
  organizationId: string
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

    const response = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(error.error || 'API request failed')
    }

    return response.json()
  }

  async health() {
    return this.request<{ status: string; timestamp: string; service: string }>('/health')
  }

  async getMe() {
    return this.request<SpecialistProfile>('/me')
  }

  async createProfile(name?: string) {
    return this.request<{ ok: boolean; specialist: SpecialistProfile; orgId?: string | null }>('/me', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
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

  async getChildDetail(orgId: string, childId: string) {
    return this.request<ChildDetail>(`/orgs/${orgId}/children/${childId}`)
  }

  async getTimeline(orgId: string, childId: string, days: number = 30) {
    return this.request<TimelineResponse>(`/orgs/${orgId}/children/${childId}/timeline?days=${days}`)
  }

  async getNotes(orgId: string, childId: string) {
    return this.request<SpecialistNote[]>(`/orgs/${orgId}/children/${childId}/notes`)
  }

  async createNote(orgId: string, childId: string, text: string, tags?: string[]) {
    return this.request<SpecialistNote>(`/orgs/${orgId}/children/${childId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text, tags }),
    })
  }

  async createInvite(orgId: string, options?: { role?: 'specialist' | 'admin'; maxUses?: number; expiresInDays?: number }) {
    return this.request<{ ok: boolean; inviteCode: string; expiresAt: string; role: 'specialist' | 'admin'; maxUses: number | null }>(`/orgs/${orgId}/invites`, {
      method: 'POST',
      body: JSON.stringify({
        role: options?.role || 'specialist',
        maxUses: options?.maxUses,
        expiresInDays: options?.expiresInDays || 30,
      }),
    })
  }

  async createParentInvite() {
    return this.request<{ ok: boolean; inviteCode: string; expiresAt: string; orgId: string }>('/specialists/invites', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }
}

export const apiClient = new ApiClient()
