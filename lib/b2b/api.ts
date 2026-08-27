import type { OrgBranding } from './types'
import { captureClientException } from '@/lib/sentryClient'

const API_BASE_URL =
  (typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3101'
    : process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3101'
  ).replace(/\/+$/, '') + '/v1'

// Types
export interface SpecialistProfile {
  uid: string
  email: string
  name: string
  organizations: Array<{
    orgId: string
    orgName: string
    country?: string | null
    city?: string | null
    categories?: string[] | null
    description?: string | null
    address?: string | null
    contactPhone?: string | null
    whatsappNumber?: string | null
    websiteUrl?: string | null
    logoUrl?: string | null
    coverImageUrl?: string | null
    logoPositionX?: number | null
    logoPositionY?: number | null
    logoScale?: number | null
    coverPositionX?: number | null
    coverPositionY?: number | null
    coverScale?: number | null
    isPublicMarketplaceEnabled?: boolean
    role: 'admin' | 'specialist' | 'independent_specialist'
    /** Product tier: 'nuroo' ($15) | 'nuroo_business' ($50). Null = legacy (treat as business) */
    nurooPlan?: 'nuroo' | 'nuroo_business' | null
  }>
}

export interface ChildSummary {
  id: string
  name: string
  parentId?: string | null
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

export interface ChildTask {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'completed'
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
  completedAt: string | null
  submissionText: string | null
  fileUrl: string | null
  submittedAt: string | null
}

export type ChildTaskResponse = ChildTask & {
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

export interface Branch {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  contactPerson?: string | null
  createdAt?: string | null
}

export interface AttendanceRecord {
  childId: string
  childName: string
  status: 'present' | 'absent' | 'late' | null
  note?: string | null
  markedAt?: string | null
}

export interface FeeRecord {
  childId: string
  childName: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'overdue'
  paidAt?: string | null
  note?: string | null
  billingDay?: number
  dueDate?: string
  daysUntilDue?: number
  billingStatus?: 'paid' | 'overdue' | 'due_soon' | 'upcoming'
}

export interface ActivityFeedItem {
  id: string
  type:
    | 'specialist_note'
    | 'parent_comment'
    | 'assignment_created'
    | 'assignment_completed'
    | 'assignment_reviewed'
    | 'progress_update'
    | 'intake_form_completed'
    | 'system_event'
  visibility: 'internal' | 'parent_visible'
  authorId: string
  authorRole: 'parent' | 'specialist' | 'admin' | 'org_admin' | 'system'
  authorName: string
  title?: string
  body: string
  relatedEntityType?: string
  relatedEntityId?: string
  /** Number of comments/replies on this feed item */
  commentCount?: number
  /** True when at least one parent has replied to this item */
  hasParentComment?: boolean
  /** ISO string of the most recent parent comment */
  lastParentCommentAt?: string
  /** Contains current user id when this item is unread for the signed-in user */
  unreadBy?: string[]
  metadata?: {
    conversationId?: string
    messageId?: string
    specialistId?: string
    [key: string]: unknown
  }
  createdAt: string
  updatedAt: string
}

export interface ActivityComment {
  id: string
  feedItemId: string
  authorId: string
  authorRole: 'parent' | 'specialist' | 'admin' | 'org_admin'
  authorName: string
  body: string
  visibility: 'internal' | 'parent_visible'
  createdAt: string
}

export interface NotificationItem {
  id: string
  type: string
  category: string
  title: string
  body: string
  read: boolean
  createdAt: string | Date | null
  metadata?: {
    childId?: string
    taskId?: string
    orgId?: string
    deepLink?: string
    specialistId?: string
    parentId?: string
  }
}

export interface ActivityFeedResponse {
  items: ActivityFeedItem[]
  nextCursor?: string
}

export interface NotificationPreferences {
  allEnabled: boolean
  pushEnabled: boolean
  inAppEnabled: boolean
  categories: {
    assignments: boolean
    messages: boolean
    reminders: boolean
    progressUpdates: boolean
    organizationUpdates: boolean
    billingUpdates: boolean
  }
}

export type BillingMode = 'manual' | 'stripe_test' | 'stripe_live'

export interface BillingStatusResponse {
  ok: boolean
  active: boolean
  planId: string | null
  source: 'subscription' | 'free_trial' | null
  billingStatus:
    | 'trialing'
    | 'active'
    | 'manual_active'
    | 'past_due'
    | 'expired'
    | 'cancelled'
    | 'canceled'
    | null
  badge: string | null
  error: string | null
  expiresAt: string | null
  limits: { children: number; specialists: number | null } | null
  usage: {
    children: number
    specialists: number
    childrenLimit: number | null
    specialistsLimit: number | null
  } | null
  features: Record<string, boolean> | null
  trial: {
    active: boolean
    planId: string | null
    startedAt: string | null
    expiresAt: string | null
  } | null
  // Stripe-specific fields
  provider?: 'stripe' | 'manual' | 'nuroo' | null
  stripeStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | null
  plan?: string | null
  trialEndsAt?: string | null
  currentPeriodEnd?: string | null
  stripeCustomerId?: string
  /** Billing mode returned by backend — drives UI branching */
  billingMode?: BillingMode
  /** Product tier chosen at onboarding: 'nuroo' ($15) | 'nuroo_business' ($50) */
  nurooPlan?: 'nuroo' | 'nuroo_business' | null
  billing?: {
    status?: string | null
    plan?: string | null
    provider?: string | null
    trialEndsAt?: string | null
    currentPeriodEnd?: string | null
  }
}

export interface Invoice {
  id: string
  parentId: string
  childId: string
  childName?: string
  amount: number
  currency: 'KGS'
  status: 'upcoming' | 'pending' | 'paid' | 'overdue' | 'failed' | 'expired' | 'canceled'
  paymentUrl?: string
  dueDate: string
  createdAt: string
  paidAt?: string
  description: string
  billingProfileId?: string
  periodStart?: string
  periodEnd?: string
}

export interface CreateInvoiceInput {
  parentId: string
  childId: string
  amount: number
  currency: 'KGS'
  description: string
  dueDate: string
}

export interface ChildBillingProfile {
  id: string
  childId: string
  childName?: string
  parentId: string
  amount: number
  currency: 'KGS'
  billingCycle: 'monthly'
  dueDayOfMonth: number
  status: 'active' | 'paused' | 'canceled'
  provider: 'finik'
  nextInvoiceDate: string
  note?: string
  createdAt: string
  updatedAt: string
}

export interface CreateBillingProfileInput {
  childId: string
  parentId: string
  amount: number
  currency: 'KGS'
  billingCycle: 'monthly'
  dueDayOfMonth: number
  note?: string
}

// ── Guardians ─────────────────────────────────────────────────────────────────

export interface Guardian {
  id: string
  fullName: string
  relationship: 'mother' | 'father' | 'guardian' | 'other'
  phone?: string
  whatsapp?: string
  email?: string
  address?: string
  preferredContactMethod?: 'phone' | 'whatsapp' | 'email'
  isPrimaryContact?: boolean
  isEmergencyContact?: boolean
  appUserId?: string
  createdAt?: string
  updatedAt?: string
}

export interface GuardianInput {
  fullName: string
  relationship: 'mother' | 'father' | 'guardian' | 'other'
  phone?: string
  whatsapp?: string
  email?: string
  preferredContactMethod?: 'phone' | 'whatsapp' | 'email'
  isPrimaryContact?: boolean
  isEmergencyContact?: boolean
}

// ── Child Intake Form ─────────────────────────────────────────────────────────

export interface ChildIntakeForm {
  // 1. General info
  childFullName?: string
  dateOfBirth?: string
  ageText?: string
  homeAddress?: string
  contactPhone?: string
  filledBy?: 'mother' | 'father' | 'guardian' | 'other'
  filledByOther?: string
  // 2. Complaints
  mainConcerns?: string
  firstNoticedAt?: string
  previousSpecialists?: string[]
  previousSpecialistsOther?: string
  // 3. Pregnancy
  motherAgeAtPregnancy?: number
  pregnancyNumber?: string
  pregnancyComplications?: boolean
  pregnancyFactors?: string[]
  pregnancyFactorsOther?: string
  pregnancyHospitalizations?: string
  gestationWeeks?: number
  // 4. Birth
  birthTypes?: string[]
  birthComplications?: boolean
  birthFactors?: string[]
  birthFactorsOther?: string
  weightAtBirth?: string
  heightAtBirth?: string
  apgarScore?: string
  criedImmediately?: boolean
  neededResuscitation?: boolean
  inIncubator?: boolean
  daysInHospital?: number
  // 5a. Motor
  heldHeadAt?: string
  rolledOverAt?: string
  satAt?: string
  crawledAt?: string
  stoodAt?: string
  walkedAt?: string
  toneIssues?: boolean
  neurologistBefore3?: boolean
  // 5b. Speech
  cooingAt?: string
  babblingAt?: string
  firstWordsAt?: string
  phraseSpeechAt?: string
  speechRegression?: boolean
  understandsSpeech?: 'well' | 'partially' | 'poorly'
  usesGestures?: boolean
  hasEcholalia?: boolean
  speechFeatures?: string[]
  // 5c. Social
  eyeContact?: 'yes' | 'rarely' | 'no'
  respondsToName?: 'yes' | 'sometimes' | 'no'
  likedCommunication?: boolean
  playedRoleGames?: boolean
  behaviorFeatures?: string[]
  behaviorFeaturesOther?: string
  // 6. Health
  healthConditions?: string[]
  healthConditionsOther?: string
  hospitalizations?: string
  longTermMedications?: string
  // 7. Nutrition & sleep
  breastfed?: boolean
  breastfedUntil?: string
  feedingDifficulties?: boolean
  selectiveEating?: boolean
  sleepDisorders?: boolean
  sleepDisordersDescription?: string
  // 8. Family history
  familyConditions?: string[]
  familyConditionsOther?: string
  familyConditionsWho?: string
  // 9. Institutions
  attendedInstitutions?: string[]
  adaptationDescription?: string
  groupDifficulties?: string
  // 10. Self-care
  selfCareSkills?: string[]
  // 11. Additional
  additionalInfo?: string
  // Metadata
  filledAt?: string | null
  updatedAt?: string | null
  filledByParentUid?: string
}

export interface ImprovedInstructionResult {
  title: string
  description: string
  instructions: string[]
  parentTip: string
  expectedResult: string
}

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
    profile: 5 * 60 * 1000,
    superAdmin: 5 * 60 * 1000,
    children: 2 * 60 * 1000,
    childDetail: 90 * 1000,
    organizations: 3 * 60 * 1000,
    reports: 3 * 60 * 1000,
    branches: 3 * 60 * 1000,
    notifications: 60 * 1000,
    unreadCount: 60 * 1000,
    content: 5 * 60 * 1000,
    groups: 2 * 60 * 1000,
    assignment: 90 * 1000,
    default: 90 * 1000,
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
      inFlightRequests.clear()
      return
    }
    const keys = Array.from(this.cache.keys())
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    })
    const inFlightKeys = Array.from(inFlightRequests.keys())
    inFlightKeys.forEach((key) => {
      if (key.includes(pattern)) {
        inFlightRequests.delete(key)
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

function reportApiError(
  error: unknown,
  endpoint: string,
  options: RequestInit,
  extra?: Record<string, unknown>
) {
  captureClientException(error, {
    tags: {
      surface: 'b2b-api-client',
      method: options.method ?? 'GET',
    },
    extra: {
      endpoint: endpoint.split('?')[0],
      ...extra,
    },
  })
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// API Client with caching and request deduplication
export class ApiClient {
  private baseUrl: string
  private token: string | null = null
  private tokenProvider: ((forceRefresh?: boolean) => Promise<string | null>) | null = null

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  setTokenProvider(provider: ((forceRefresh?: boolean) => Promise<string | null>) | null) {
    this.tokenProvider = provider
  }

  setToken(token: string | null) {
    const tokenChanged = this.token !== token
    this.token = token
    if (tokenChanged) {
      cache.invalidate()
    }
  }

  private async resolveToken(forceRefresh = false) {
    if (!this.tokenProvider) return this.token
    const nextToken = await this.tokenProvider(forceRefresh).catch(() => null)
    if (nextToken && nextToken !== this.token) {
      this.setToken(nextToken)
    }
    return nextToken || this.token
  }

  async request<T>(endpoint: string, options: RequestInit = {}, retryAuth = true): Promise<T> {
    if (!this.token) {
      await this.resolveToken(false)
    }

    const headers = new Headers(options.headers)
    if (options.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`)

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
    let response: Response
    try {
      response = await fetch(url, { ...options, headers })
    } catch (error) {
      reportApiError(error, endpoint, options, { failureType: 'network' })
      throw error
    }

    if (response.status === 401 && retryAuth && this.tokenProvider) {
      const previousToken = this.token
      const refreshedToken = await this.resolveToken(true)
      if (refreshedToken && refreshedToken !== previousToken) {
        return this.request<T>(endpoint, options, false)
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      const apiError = new ApiError(
        error.error || 'API request failed',
        response.status,
        error.code
      )
      if (response.status >= 500) {
        reportApiError(apiError, endpoint, options, {
          failureType: 'http',
          status: response.status,
          code: error.code,
        })
      }
      throw apiError
    }

    return response.json()
  }

  // Cached GET request with deduplication
  private async cachedRequest<T>(
    endpoint: string,
    cacheKey: string,
    ttlKey?:
      | 'profile'
      | 'superAdmin'
      | 'children'
      | 'childDetail'
      | 'organizations'
      | 'reports'
      | 'branches'
      | 'notifications'
      | 'unreadCount'
      | 'content'
      | 'groups'
      | 'assignment'
      | 'default'
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
        if (inFlightRequests.get(cacheKey) === requestPromise) {
          cache.set(cacheKey, data, ttlKey)
          inFlightRequests.delete(cacheKey)
        }
        return data
      })
      .catch((error) => {
        if (inFlightRequests.get(cacheKey) === requestPromise) {
          inFlightRequests.delete(cacheKey)
        }
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

  async createPayment(orgId: string, planId: 'starter' | 'growth' | 'enterprise') {
    cache.invalidate()
    return this.request<{ paymentUrl?: string; error?: string }>(`/orgs/${orgId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ orgId, planId }),
    })
  }

  async getBillingStatus(orgId: string) {
    return this.request<BillingStatusResponse>(`/orgs/${orgId}/billing/status`)
  }

  async startTrial(
    orgId: string
  ): Promise<{ ok: boolean; trialEndsAt?: string; alreadyTrialing?: boolean }> {
    cache.invalidate()
    return this.request<{ ok: boolean; trialEndsAt?: string; alreadyTrialing?: boolean }>(
      `/orgs/${orgId}/billing/start-trial`,
      { method: 'POST', body: JSON.stringify({}) }
    )
  }

  async createStripeCheckout(orgId: string, planId: string): Promise<{ ok: boolean; url: string }> {
    cache.invalidate()
    const successUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/b2b/billing?stripe=success`
    const cancelUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/b2b/billing?stripe=cancel`
    return this.request<{ ok: boolean; url: string }>(`/orgs/${orgId}/billing/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planId, successUrl, cancelUrl }),
    })
  }

  async createBillingPortalSession(orgId: string): Promise<{ ok: boolean; url: string }> {
    return this.request<{ ok: boolean; url: string }>(`/orgs/${orgId}/billing/portal`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async getInvoices(
    orgId: string,
    params?: { parentId?: string; status?: string }
  ): Promise<{ ok: boolean; invoices: Invoice[] }> {
    const qs = new URLSearchParams()
    if (params?.parentId) qs.set('parentId', params.parentId)
    if (params?.status) qs.set('status', params.status)
    const query = qs.toString() ? `?${qs}` : ''
    return this.cachedRequest<{ ok: boolean; invoices: Invoice[] }>(
      `/orgs/${orgId}/invoices${query}`,
      `invoices:${orgId}:${query}`,
      'default'
    )
  }

  async createInvoice(
    orgId: string,
    data: CreateInvoiceInput
  ): Promise<{ ok: boolean; invoice: Invoice }> {
    cache.invalidate(`invoices:${orgId}`)
    return this.request<{ ok: boolean; invoice: Invoice }>(`/orgs/${orgId}/invoices`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async cancelInvoice(
    orgId: string,
    invoiceId: string
  ): Promise<{ ok: boolean; invoice: Invoice }> {
    cache.invalidate(`invoices:${orgId}`)
    return this.request<{ ok: boolean; invoice: Invoice }>(
      `/orgs/${orgId}/invoices/${invoiceId}/cancel`,
      { method: 'PATCH' }
    )
  }

  async getBillingProfiles(
    orgId: string,
    params?: { childId?: string }
  ): Promise<{ ok: boolean; profiles: ChildBillingProfile[] }> {
    const qs = new URLSearchParams()
    if (params?.childId) qs.set('childId', params.childId)
    const query = qs.toString() ? `?${qs}` : ''
    return this.cachedRequest<{ ok: boolean; profiles: ChildBillingProfile[] }>(
      `/orgs/${orgId}/billing/profiles${query}`,
      `billing:profiles:${orgId}:${query}`,
      'default'
    )
  }

  async createBillingProfile(
    orgId: string,
    data: CreateBillingProfileInput
  ): Promise<{ ok: boolean; profile: ChildBillingProfile }> {
    return this.request<{ ok: boolean; profile: ChildBillingProfile }>(
      `/orgs/${orgId}/billing/profiles`,
      { method: 'POST', body: JSON.stringify(data) }
    )
  }

  async updateBillingProfile(
    orgId: string,
    profileId: string,
    updates: Partial<
      Pick<CreateBillingProfileInput, 'amount' | 'dueDayOfMonth' | 'note'> & {
        status: 'active' | 'paused' | 'canceled'
      }
    >
  ): Promise<{ ok: boolean; profile: ChildBillingProfile }> {
    return this.request<{ ok: boolean; profile: ChildBillingProfile }>(
      `/orgs/${orgId}/billing/profiles/${profileId}`,
      { method: 'PATCH', body: JSON.stringify(updates) }
    )
  }

  async generateMonthlyInvoices(
    orgId: string
  ): Promise<{ ok: boolean; result: { created: number; skipped: number; failed: number } }> {
    return this.request<{
      ok: boolean
      result: { created: number; skipped: number; failed: number }
    }>(`/orgs/${orgId}/billing/generate-monthly-invoices`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async markOverdueInvoices(orgId: string): Promise<{ ok: boolean; result: { marked: number } }> {
    return this.request<{ ok: boolean; result: { marked: number } }>(
      `/orgs/${orgId}/billing/mark-overdue`,
      { method: 'POST', body: JSON.stringify({}) }
    )
  }

  async getPaymentProviders(orgId: string): Promise<{
    providers?: {
      finik?: {
        enabled: boolean
        merchantId?: string
        secretKeySet?: boolean
        configuredAt?: string
      }
    }
  }> {
    return this.cachedRequest(
      `/orgs/${orgId}/payment-providers`,
      `payment-providers:${orgId}`,
      'default'
    )
  }

  async configureFinik(orgId: string, data: { merchantId: string }): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/payment-providers/finik`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
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

  async removeChild(orgId: string, childId: string) {
    cache.invalidate(`children:${orgId}`)
    cache.invalidate(`child:${orgId}:${childId}`)
    return this.request<{ ok: boolean; childId: string; groupsCleaned: number }>(
      `/orgs/${orgId}/children/${childId}`,
      { method: 'DELETE' }
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

  // Child tasks (assignments from specialist to parent)
  async getChildTasks(orgId: string, childId: string) {
    return this.cachedRequest<{ tasks: ChildTask[] }>(
      `/orgs/${orgId}/children/${childId}/tasks`,
      `childTasks:${orgId}:${childId}`,
      'default'
    )
  }

  async createChildTask(
    orgId: string,
    childId: string,
    payload: { title: string; description?: string }
  ) {
    cache.invalidate(`childTasks:${orgId}:${childId}`)
    cache.invalidate(`child:${orgId}:${childId}`)
    return this.request<ChildTaskResponse>(`/orgs/${orgId}/children/${childId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
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
  async createMyOrganization(
    name: string,
    country?: string,
    plan?: 'nuroo' | 'nuroo_business',
    specializations?: string[]
  ) {
    cache.invalidate('profile')
    cache.invalidate('organizations')
    return this.request<{ ok: boolean; orgId: string; name: string; country: string | null }>(
      '/orgs',
      {
        method: 'POST',
        body: JSON.stringify({ name, country, plan, specializations }),
      }
    )
  }

  async updateOrganization(
    orgId: string,
    updates: {
      name?: string
      country?: string
      city?: string
      categories?: string[]
      description?: string
      address?: string
      contactPhone?: string
      whatsappNumber?: string
      websiteUrl?: string
      logoUrl?: string
      coverImageUrl?: string
      logoPositionX?: number | null
      logoPositionY?: number | null
      logoScale?: number | null
      coverPositionX?: number | null
      coverPositionY?: number | null
      coverScale?: number | null
      isPublicMarketplaceEnabled?: boolean
    }
  ) {
    cache.invalidate('profile')
    cache.invalidate('organizations')
    return this.request<{
      ok: boolean
      org: {
        id: string
        name: string
        country?: string | null
        city?: string | null
        categories?: string[] | null
        description?: string | null
        address?: string | null
        contactPhone?: string | null
        whatsappNumber?: string | null
        websiteUrl?: string | null
        logoUrl?: string | null
        coverImageUrl?: string | null
        logoPositionX?: number | null
        logoPositionY?: number | null
        logoScale?: number | null
        coverPositionX?: number | null
        coverPositionY?: number | null
        coverScale?: number | null
        isPublicMarketplaceEnabled?: boolean
        createdBy: string
        createdAt: string
        isActive: boolean
        billingPlan?: string | null
      }
    }>(`/orgs/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  async uploadOrganizationImage(orgId: string, file: File, kind: 'logo' | 'cover') {
    const formData = new FormData()
    formData.append('kind', kind)
    formData.append('media', file)

    const headers = new Headers()
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`)

    const response = await fetch(`${this.baseUrl}/orgs/${orgId}/media`, {
      method: 'POST',
      body: formData,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(error.error || error.message || 'Upload failed')
    }

    return response.json() as Promise<{
      ok: boolean
      kind: 'logo' | 'cover'
      url: string
      path: string
    }>
  }

  async getOrgBranding(orgId: string) {
    return this.cachedRequest<{ ok: boolean; branding: OrgBranding | null }>(
      `/orgs/${orgId}/branding`,
      `branding:${orgId}`,
      'default'
    )
  }

  async updateOrgBranding(orgId: string, updates: OrgBranding) {
    cache.invalidate(`branding:${orgId}`)
    return this.request<{ ok: boolean; branding: OrgBranding | null }>(`/orgs/${orgId}/branding`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
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

  async disconnectParent(orgId: string, parentUserId: string) {
    cache.invalidate(`connections:${orgId}`)
    cache.invalidate(`groups:${orgId}`)
    return this.request<{ ok: boolean; childrenUnlinked: number; groupsUpdated: number }>(
      `/orgs/${orgId}/connections/${encodeURIComponent(parentUserId)}`,
      { method: 'DELETE' }
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

  async getReports(orgId: string, days = 30) {
    return this.cachedRequest<{
      ok: boolean
      days: number
      childCompletion: Array<{
        childId: string
        childName: string
        parentName: string | null
        totalTasks: number
        completedTasks: number
        percent: number
      }>
      groupCompletion: Array<{
        groupId: string
        groupName: string
        totalTasks: number
        completedTasks: number
        percent: number
        childCount: number
        specialistName?: string
        ownerId?: string
      }>
      parentActivity: Array<{
        parentUserId: string
        parentName: string
        completedLast7: number
        completedLast30: number
      }>
      topParents: Array<{
        parentUserId: string
        parentName: string
        completedLast7: number
        completedLast30: number
      }>
      lowActivity: Array<{
        parentUserId: string
        parentName: string
        completedLast7: number
        completedLast30: number
      }>
      contentActivity: {
        totalCompleted: number
        completedLast7Days: number
        completedLast30Days: number
        byChild: Array<{ childId: string; count: number }>
      }
    }>(`/orgs/${orgId}/reports?days=${days}`, `reports:${orgId}:${days}`, 'reports')
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
  async getGroup(orgId: string, groupId: string, ownerId?: string) {
    const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''
    const cacheKey = ownerId ? `group:${orgId}:${groupId}:${ownerId}` : `group:${orgId}:${groupId}`
    return this.cachedRequest<{ ok: boolean; group: any }>(
      `/orgs/${orgId}/groups/${groupId}${query}`,
      cacheKey,
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

  async assignGroupTasks(
    orgId: string,
    groupId: string,
    contentTaskIds: string[],
    dueDate?: string | null,
    ownerId?: string,
    contentRoadmapIds?: string[]
  ) {
    const url = ownerId
      ? `/orgs/${orgId}/groups/${groupId}/assign?ownerId=${encodeURIComponent(ownerId)}`
      : `/orgs/${orgId}/groups/${groupId}/assign`
    cache.invalidate(`groupAssignments:${orgId}:${groupId}`)
    cache.invalidate(`groups:${orgId}`)
    return this.request<{
      ok: boolean
      tasksCreated: number
      childCount: number
      taskCount: number
    }>(url, {
      method: 'POST',
      body: JSON.stringify({
        contentTaskIds,
        contentRoadmapIds: contentRoadmapIds ?? [],
        dueDate: dueDate ?? null,
      }),
    })
  }

  async getGroupAssignment(orgId: string, groupId: string, assignmentId: string, ownerId?: string) {
    const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''
    const cacheKey = `groupAssignment:${orgId}:${assignmentId}`
    return this.cachedRequest<{
      ok: boolean
      assignment: {
        id: string
        groupId: string
        groupName: string
        ownerId: string
        title: string
        description: string | null
        dueDate: string | null
        taskTitles: string[]
        contentTaskIds: string[]
        contentRoadmapIds: string[]
        roadmapNames: string[]
        roadmaps: { id: string; name: string; taskTitles: string[]; taskIds?: string[] }[]
        childCount: number
        status: 'active' | 'closed'
        assignedAt: string | null
        submissions: Array<{
          childId: string
          childName: string
          age?: number
          taskId: string | null
          status: 'pending' | 'submitted' | 'graded'
          submissionText: string | null
          fileUrl: string | null
          submittedAt: string | null
          grade: 'approved' | 'needs_revision' | null
          feedback: string | null
          feedbackAt: string | null
        }>
      }
    }>(
      `/orgs/${orgId}/groups/${groupId}/assignments/${assignmentId}${query}`,
      cacheKey,
      'assignment'
    )
  }

  async updateGroupAssignment(
    orgId: string,
    groupId: string,
    assignmentId: string,
    updates: {
      status?: 'active' | 'closed'
      dueDate?: string | null
      title?: string
      description?: string | null
    }
  ) {
    cache.invalidate(`groupAssignments:${orgId}:${groupId}`)
    cache.invalidate(`groupAssignment:${orgId}:${assignmentId}`)
    return this.request<{ ok: boolean }>(
      `/orgs/${orgId}/groups/${groupId}/assignments/${assignmentId}`,
      { method: 'PATCH', body: JSON.stringify(updates) }
    )
  }

  async deleteGroupAssignment(orgId: string, groupId: string, assignmentId: string) {
    cache.invalidate(`groupAssignments:${orgId}:${groupId}`)
    cache.invalidate(`groupAssignment:${orgId}:${assignmentId}`)
    cache.invalidate(`groups:${orgId}`)
    return this.request<{ ok: boolean }>(
      `/orgs/${orgId}/groups/${groupId}/assignments/${assignmentId}`,
      { method: 'DELETE' }
    )
  }

  async getAssignmentComments(orgId: string, groupId: string, assignmentId: string) {
    return this.request<{
      ok: boolean
      comments: Array<{
        id: string
        authorId: string
        authorName: string
        authorRole: string
        text: string
        createdAt: string | null
      }>
    }>(`/orgs/${orgId}/groups/${groupId}/assignments/${assignmentId}/comments`)
  }

  async addAssignmentComment(orgId: string, groupId: string, assignmentId: string, text: string) {
    return this.request<{
      ok: boolean
      comment: { id: string; authorName: string; text: string; createdAt: string }
    }>(`/orgs/${orgId}/groups/${groupId}/assignments/${assignmentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  }

  async reviewSubmission(
    orgId: string,
    groupId: string,
    assignmentId: string,
    childId: string,
    data: { grade: 'approved' | 'needs_revision'; feedback?: string }
  ) {
    cache.invalidate(`groupAssignment:${orgId}:${assignmentId}`)
    return this.request<{ ok: boolean; childId: string; grade: string }>(
      `/orgs/${orgId}/groups/${groupId}/assignments/${assignmentId}/submissions/${childId}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    )
  }

  async getGroupAssignments(orgId: string, groupId: string, ownerId?: string) {
    const url = ownerId
      ? `/orgs/${orgId}/groups/${groupId}/assignments?ownerId=${encodeURIComponent(ownerId)}`
      : `/orgs/${orgId}/groups/${groupId}/assignments`
    return this.cachedRequest<{
      ok: boolean
      assignments: Array<{
        id: string
        groupId: string
        groupName: string
        title: string
        taskTitles: string[]
        contentTaskIds: string[]
        contentRoadmapIds: string[]
        roadmapNames: string[]
        childCount: number
        tasksCreated: number
        assignedBy: string
        assignedAt: string | null
      }>
      count: number
    }>(url, `groupAssignments:${orgId}:${groupId}`, 'default')
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

  // Org content (tasks & roadmaps for parents by org code)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getOrgContentTasks(orgId: string) {
    return this.cachedRequest<{ ok: boolean; tasks: any[]; count: number }>(
      `/orgs/${orgId}/content/tasks`,
      `orgContent:tasks:${orgId}`,
      'default'
    )
  }

  async getOrgContentTask(orgId: string, taskId: string) {
    return this.cachedRequest<{ ok: boolean; task: any }>(
      `/orgs/${orgId}/content/tasks/${taskId}`,
      `orgContent:task:${orgId}:${taskId}`,
      'default'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createOrgContentTask(orgId: string, task: any) {
    cache.invalidate(`orgContent:tasks:${orgId}`)
    return this.request<{ ok: boolean; task: any }>(`/orgs/${orgId}/content/tasks`, {
      method: 'POST',
      body: JSON.stringify(task),
    })
  }

  /** Upload media file and create org task in one request. */
  async uploadOrgTaskMedia(
    orgId: string,
    file: File,
    options: {
      title: string
      description?: string
      category?: string
      difficulty?: 'easy' | 'medium' | 'hard'
      estimatedDuration?: number
      ageRange?: { min: number; max: number }
      instructions?: string[]
    }
  ) {
    const formData = new FormData()
    formData.append('title', options.title)
    if (options.description) formData.append('description', options.description)
    if (options.category) formData.append('category', options.category)
    if (options.difficulty) formData.append('difficulty', options.difficulty)
    if (options.estimatedDuration != null)
      formData.append('estimatedDuration', options.estimatedDuration.toString())
    if (options.ageRange) {
      formData.append('ageRangeMin', options.ageRange.min.toString())
      formData.append('ageRangeMax', options.ageRange.max.toString())
    }
    if (options.instructions?.length)
      formData.append('instructions', JSON.stringify(options.instructions))
    formData.append('media', file)
    const headers = new Headers()
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`)
    const response = await fetch(`${this.baseUrl}/orgs/${orgId}/content/tasks/upload`, {
      method: 'POST',
      body: formData,
      headers,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(err.error || err.message || 'Upload failed')
    }
    cache.invalidate(`orgContent:tasks:${orgId}`)
    return response.json()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateOrgContentTask(orgId: string, taskId: string, updates: any) {
    cache.invalidate(`orgContent:tasks:${orgId}`)
    return this.request<{ ok: boolean; task: any }>(`/orgs/${orgId}/content/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  async deleteOrgContentTask(orgId: string, taskId: string) {
    cache.invalidate(`orgContent:tasks:${orgId}`)
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/content/tasks/${taskId}`, {
      method: 'DELETE',
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getOrgContentRoadmaps(orgId: string) {
    return this.cachedRequest<{ ok: boolean; roadmaps: any[]; count: number }>(
      `/orgs/${orgId}/content/roadmaps`,
      `orgContent:roadmaps:${orgId}`,
      'default'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createOrgContentRoadmap(orgId: string, roadmap: any) {
    cache.invalidate(`orgContent:roadmaps:${orgId}`)
    return this.request<{ ok: boolean; roadmap: any }>(`/orgs/${orgId}/content/roadmaps`, {
      method: 'POST',
      body: JSON.stringify(roadmap),
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateOrgContentRoadmap(orgId: string, roadmapId: string, updates: any) {
    cache.invalidate(`orgContent:roadmaps:${orgId}`)
    return this.request<{ ok: boolean; roadmap: any }>(
      `/orgs/${orgId}/content/roadmaps/${roadmapId}`,
      { method: 'PATCH', body: JSON.stringify(updates) }
    )
  }

  async deleteOrgContentRoadmap(orgId: string, roadmapId: string) {
    cache.invalidate(`orgContent:roadmaps:${orgId}`)
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/content/roadmaps/${roadmapId}`, {
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

  // Branches
  async getBranches(orgId: string) {
    return this.cachedRequest<{ ok: boolean; branches: Branch[] }>(
      `/orgs/${orgId}/branches`,
      `branches:${orgId}`,
      'branches'
    )
  }

  async createBranch(
    orgId: string,
    data: { name: string; address?: string; phone?: string; contactPerson?: string }
  ) {
    cache.invalidate(`branches:${orgId}`)
    return this.request<{ ok: boolean; branch: Branch }>(`/orgs/${orgId}/branches`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateBranch(
    orgId: string,
    branchId: string,
    data: Partial<{ name: string; address: string; phone: string; contactPerson: string }>
  ) {
    cache.invalidate(`branches:${orgId}`)
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/branches/${branchId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteBranch(orgId: string, branchId: string) {
    cache.invalidate(`branches:${orgId}`)
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/branches/${branchId}`, {
      method: 'DELETE',
    })
  }

  // Finance — Attendance
  async getAttendance(orgId: string, date: string) {
    return this.request<{ ok: boolean; date: string; records: AttendanceRecord[] }>(
      `/orgs/${orgId}/attendance?date=${date}`
    )
  }

  async saveAttendance(
    orgId: string,
    data: {
      childId: string
      childName: string
      date: string
      status: 'present' | 'absent' | 'late'
      note?: string
    }
  ) {
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/attendance`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Finance — Monthly Fees
  async getMonthlyFees(orgId: string, month: string) {
    return this.request<{ ok: boolean; month: string; records: FeeRecord[] }>(
      `/orgs/${orgId}/finance?month=${month}`
    )
  }

  async saveFee(
    orgId: string,
    data: {
      childId: string
      childName: string
      month: string
      amount: number
      status: 'paid' | 'pending' | 'overdue'
      note?: string
    }
  ) {
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/finance`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async improveInstruction(data: {
    roughText: string
    language: 'ru' | 'en' | 'ky'
    context?: {
      title?: string
      category?: string
      ageMin?: number
      ageMax?: number
    }
  }) {
    return this.request<{ ok: boolean; result: ImprovedInstructionResult }>(
      '/api/specialist/ai/improve-instruction',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  async getNotifications(options: { limit?: number; unreadOnly?: boolean } = {}) {
    const qs = new URLSearchParams()
    if (options.limit) qs.set('limit', String(options.limit))
    if (options.unreadOnly) qs.set('unreadOnly', 'true')
    return this.cachedRequest<{ notifications: NotificationItem[] }>(
      `/api/notifications?${qs}`,
      `notifications:${qs.toString()}`,
      'notifications'
    )
  }

  async getUnreadCount() {
    return this.cachedRequest<{ count: number }>(
      '/api/notifications/unread-count',
      'notifications:unread',
      'unreadCount'
    )
  }

  async markNotificationRead(id: string) {
    cache.invalidate('notifications:')
    return this.request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'PATCH' })
  }

  async markAllNotificationsRead() {
    cache.invalidate('notifications:')
    return this.request<{ ok: boolean; updated: number }>('/api/notifications/read-all', {
      method: 'PATCH',
    })
  }

  async getNotificationPreferences() {
    return this.request<{ preferences: NotificationPreferences }>('/api/notifications/preferences')
  }

  async updateNotificationPreferences(prefs: Partial<NotificationPreferences>) {
    return this.request<{ ok: boolean }>('/api/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    })
  }

  // Activity Feed
  async listActivityFeed(
    orgId: string,
    childId: string,
    filters?: { type?: string; visibility?: string }
  ): Promise<ActivityFeedItem[]> {
    const qs = new URLSearchParams()
    if (filters?.type) qs.set('type', filters.type)
    if (filters?.visibility) qs.set('visibility', filters.visibility)
    const query = qs.toString() ? `?${qs}` : ''
    const response = await this.request<ActivityFeedItem[] | ActivityFeedResponse>(
      `/orgs/${orgId}/children/${childId}/feed${query}`
    )

    return Array.isArray(response) ? response : response.items
  }

  async createActivityFeedItem(
    orgId: string,
    childId: string,
    data: { type: string; body: string; title?: string; visibility: 'internal' | 'parent_visible' }
  ): Promise<ActivityFeedItem> {
    return this.request<ActivityFeedItem>(`/orgs/${orgId}/children/${childId}/feed`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateActivityFeedItem(
    orgId: string,
    childId: string,
    feedItemId: string,
    data: Partial<ActivityFeedItem>
  ): Promise<ActivityFeedItem> {
    return this.request<ActivityFeedItem>(`/orgs/${orgId}/children/${childId}/feed/${feedItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteActivityFeedItem(orgId: string, childId: string, feedItemId: string): Promise<void> {
    await this.request<void>(`/orgs/${orgId}/children/${childId}/feed/${feedItemId}`, {
      method: 'DELETE',
    })
  }

  async listFeedComments(
    orgId: string,
    childId: string,
    feedItemId: string
  ): Promise<ActivityComment[]> {
    return this.request<ActivityComment[]>(
      `/orgs/${orgId}/children/${childId}/feed/${feedItemId}/comments`
    )
  }

  async addFeedComment(
    orgId: string,
    childId: string,
    feedItemId: string,
    body: string,
    visibility: 'internal' | 'parent_visible'
  ): Promise<ActivityComment> {
    return this.request<ActivityComment>(
      `/orgs/${orgId}/children/${childId}/feed/${feedItemId}/comments`,
      { method: 'POST', body: JSON.stringify({ body, visibility }) }
    )
  }

  async markActivityFeedRead(
    orgId: string,
    childId: string,
    feedItemIds: string[]
  ): Promise<{ marked: number }> {
    return this.request<{ marked: number }>(`/orgs/${orgId}/children/${childId}/feed/read`, {
      method: 'PATCH',
      body: JSON.stringify({ feedItemIds }),
    })
  }

  /** Reply to a parent message inside a legacy conversation (so parent sees it in mobile app) */
  async sendConversationReply(conversationId: string, text: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  }

  // ── Guardians ──────────────────────────────────────────────────────────────

  async getChildGuardians(orgId: string, childId: string): Promise<Guardian[]> {
    const res = await this.request<{ ok: boolean; guardians: Guardian[] }>(
      `/orgs/${orgId}/children/${childId}/guardians`
    )
    return res.guardians
  }

  async addChildGuardian(orgId: string, childId: string, data: GuardianInput): Promise<Guardian> {
    const res = await this.request<{ ok: boolean; guardian: Guardian }>(
      `/orgs/${orgId}/children/${childId}/guardians`,
      { method: 'POST', body: JSON.stringify(data) }
    )
    return res.guardian
  }

  async updateChildGuardian(
    orgId: string,
    childId: string,
    guardianId: string,
    data: Partial<GuardianInput>
  ): Promise<Guardian> {
    const res = await this.request<{ ok: boolean; guardian: Guardian }>(
      `/orgs/${orgId}/children/${childId}/guardians/${guardianId}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    )
    return res.guardian
  }

  async deleteChildGuardian(orgId: string, childId: string, guardianId: string): Promise<void> {
    await this.request<void>(`/orgs/${orgId}/children/${childId}/guardians/${guardianId}`, {
      method: 'DELETE',
    })
  }

  // ── Intake form ────────────────────────────────────────────────────────────

  async getChildIntake(orgId: string, childId: string): Promise<ChildIntakeForm | null> {
    const res = await this.request<{ ok: boolean; intake: ChildIntakeForm | null }>(
      `/orgs/${orgId}/children/${childId}/intake`
    )
    return res.intake
  }

  async saveChildIntake(
    orgId: string,
    childId: string,
    data: Partial<ChildIntakeForm>
  ): Promise<{ ok: boolean; updatedAt: string; isNew: boolean }> {
    return this.request(`/orgs/${orgId}/children/${childId}/intake`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // ── AI Reports ────────────────────────────────────────────────────────────

  async generateAIReport(params: {
    orgId: string
    childId: string
    periodStart: string
    periodEnd: string
    specialistType:
      | 'speech_therapist'
      | 'psychologist'
      | 'aba_specialist'
      | 'defectologist'
      | 'ot_specialist'
    language: 'ru' | 'en' | 'ky'
    selectedMetrics: Record<string, string[]>
    additionalNotes?: string
    childName: string
    childAge?: number
  }) {
    const { orgId, childId, ...body } = params
    return this.request<{ ok: boolean; childId: string; text: string }>(
      `/orgs/${orgId}/children/${childId}/ai-reports/generate`,
      { method: 'POST', body: JSON.stringify(body) }
    )
  }

  async saveAIReport(params: {
    orgId: string
    childId: string
    periodStart: string
    periodEnd: string
    specialistType:
      | 'speech_therapist'
      | 'psychologist'
      | 'aba_specialist'
      | 'defectologist'
      | 'ot_specialist'
    language: 'ru' | 'en' | 'ky'
    selectedMetrics: Record<string, string[]>
    additionalNotes?: string
    aiGeneratedText: string
    finalText: string
    status: 'draft' | 'sent'
  }) {
    const { orgId, childId, ...body } = params
    cache.invalidate(`aiReports:${orgId}:${childId}`)
    return this.request<{ ok: boolean; reportId: string }>(
      `/orgs/${orgId}/children/${childId}/ai-reports`,
      { method: 'POST', body: JSON.stringify(body) }
    )
  }

  async listAIReports(orgId: string, childId: string) {
    return this.cachedRequest<{ ok: boolean; reports: any[] }>(
      `/orgs/${orgId}/children/${childId}/ai-reports`,
      `aiReports:${orgId}:${childId}`,
      'default'
    )
  }

  async seedDemoData(orgId: string) {
    return this.request<{
      ok: boolean
      created: { children: number; tasks: number }
      message: string
    }>(`/orgs/${orgId}/demo/seed`, { method: 'POST' })
  }

  async clearDemoData(orgId: string) {
    return this.request<{ ok: boolean; deleted: { children: number; tasks: number } }>(
      `/orgs/${orgId}/demo/seed`,
      { method: 'DELETE' }
    )
  }

  // ── Organization reviews ────────────────────────────────────────────────────

  async getOrgReviewsAdmin(orgId: string) {
    return this.request<{
      ok: boolean
      reviews: {
        id: string
        authorId: string
        authorName: string
        rating: number
        text: string
        status: 'published' | 'removed'
        createdAt: string
        updatedAt: string
        isVerifiedEnrollment: boolean
      }[]
      reviewCount: number
      averageRating: number
    }>(`/orgs/${orgId}/reviews`)
  }

  async updateReviewStatus(orgId: string, reviewId: string, status: 'published' | 'removed') {
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/reviews/${reviewId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  }

  // ── Bookings ──────────────────────────────────────────────────────────────

  async getOrgBookings(orgId: string, status?: string, specialistId?: string) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (specialistId) params.set('specialistId', specialistId)
    const q = params.size > 0 ? `?${params}` : ''
    return this.request<{
      ok: boolean
      bookings: {
        id: string
        orgId: string
        specialistId: string
        parentId: string
        childId: string | null
        serviceId: string | null
        slotId: string
        date: string
        startTime: string
        endTime: string
        status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
        intakeStatus: 'none' | 'pending' | 'submitted' | 'reviewed'
        intakeFormId: string | null
        notes: string | null
        cancelReason: string | null
        createdAt: string
        updatedAt: string
      }[]
    }>(`/orgs/${orgId}/bookings${q}`)
  }

  async updateBookingStatus(
    orgId: string,
    bookingId: string,
    status: 'confirmed' | 'completed' | 'cancelled',
    cancelReason?: string
  ) {
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/bookings/${bookingId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, cancelReason }),
    })
  }

  // ── Intake submissions ────────────────────────────────────────────────────

  async getBookingIntake(orgId: string, bookingId: string) {
    return this.request<{
      intake: {
        answers: Record<string, string | boolean>
        submittedAt: string
        templateSnapshot: {
          name: string
          fields: unknown[]
          sections?: unknown[]
        }
      } | null
    }>(`/orgs/${orgId}/bookings/${bookingId}/intake`)
  }

  async markIntakeReviewed(orgId: string, bookingId: string) {
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/bookings/${bookingId}/intake/reviewed`, {
      method: 'POST',
    })
  }

  // ── Services ──────────────────────────────────────────────────────────────

  async getOrgServices(orgId: string) {
    return this.request<{
      services: {
        id: string
        name: string
        description: string | null
        durationMinutes: number
        price: number
        currency: string
        specialistId: string
        intakeFormId: string | null
      }[]
    }>(`/orgs/${orgId}/services`)
  }

  async createOrgService(
    orgId: string,
    payload: {
      name: string
      description?: string | null
      durationMinutes: number
      price: number
      currency: string
      specialistId?: string | null
      intakeFormId?: string | null
    }
  ) {
    return this.request<{ ok: boolean; service: { id: string } }>(`/orgs/${orgId}/services`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateOrgService(
    orgId: string,
    serviceId: string,
    payload: {
      name?: string
      description?: string | null
      durationMinutes?: number
      price?: number
      currency?: string
      specialistId?: string | null
      intakeFormId?: string | null
    }
  ) {
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/services/${serviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async deleteOrgService(orgId: string, serviceId: string) {
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/services/${serviceId}`, {
      method: 'DELETE',
    })
  }

  async ensureDefaultIntakeTemplate(orgId: string) {
    return this.request<{ form: { id: string } }>(`/orgs/${orgId}/default-intake-template`, {
      method: 'POST',
    })
  }

  // ── Specialist availability ────────────────────────────────────────────────

  async getSpecialistAvailability(orgId: string, specialistId: string) {
    return this.request<{
      availability: {
        schedule: Record<string, { start: string; end: string }[]>
        slotDurationMinutes: number
        breakBetweenSlotsMinutes: number
      } | null
    }>(`/orgs/${orgId}/specialists/${specialistId}/availability`)
  }

  async updateSpecialistAvailability(
    orgId: string,
    specialistId: string,
    payload: {
      schedule: Record<string, { start: string; end: string }[]>
      slotDurationMinutes: number
      breakBetweenSlotsMinutes: number
    }
  ) {
    return this.request<{ ok: boolean }>(
      `/orgs/${orgId}/specialists/${specialistId}/availability`,
      { method: 'PUT', body: JSON.stringify(payload) }
    )
  }

  // ── Cohorts ───────────────────────────────────────────────────────────────

  async getCohorts(orgId: string) {
    return this.request<{ ok: boolean; cohorts: any[] }>(`/orgs/${orgId}/cohorts`)
  }

  async getCohort(orgId: string, cohortId: string) {
    return this.request<{ ok: boolean; cohort: any }>(`/orgs/${orgId}/cohorts/${cohortId}`)
  }

  async createCohort(orgId: string, body: Record<string, unknown>) {
    return this.request<{ ok: boolean; cohort: any }>(`/orgs/${orgId}/cohorts`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async updateCohort(orgId: string, cohortId: string, body: Record<string, unknown>) {
    return this.request<{ ok: boolean; cohort: any }>(`/orgs/${orgId}/cohorts/${cohortId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  }

  async uploadCohortCover(orgId: string, cohortId: string, file: File): Promise<string> {
    const formData = new FormData()
    formData.append('cover', file)

    const headers = new Headers()
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`)

    const response = await fetch(`${this.baseUrl}/orgs/${orgId}/cohorts/${cohortId}/cover`, {
      method: 'POST',
      body: formData,
      headers,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(err.error || 'Upload failed')
    }
    const data = (await response.json()) as { ok: boolean; coverUrl: string }
    return data.coverUrl
  }

  async deleteCohort(orgId: string, cohortId: string) {
    return this.request<{ ok: boolean }>(`/orgs/${orgId}/cohorts/${cohortId}`, {
      method: 'DELETE',
    })
  }

  async getCohortSessions(orgId: string, cohortId: string) {
    return this.request<{ ok: boolean; sessions: any[] }>(
      `/orgs/${orgId}/cohorts/${cohortId}/sessions`
    )
  }

  async createCohortSession(orgId: string, cohortId: string, body: Record<string, unknown>) {
    return this.request<{ ok: boolean; session: any }>(
      `/orgs/${orgId}/cohorts/${cohortId}/sessions`,
      { method: 'POST', body: JSON.stringify(body) }
    )
  }

  async updateCohortSession(
    orgId: string,
    cohortId: string,
    sessionId: string,
    body: Record<string, unknown>
  ) {
    return this.request<{ ok: boolean; session: any }>(
      `/orgs/${orgId}/cohorts/${cohortId}/sessions/${sessionId}`,
      { method: 'PATCH', body: JSON.stringify(body) }
    )
  }

  async deleteCohortSession(orgId: string, cohortId: string, sessionId: string) {
    return this.request<{ ok: boolean }>(
      `/orgs/${orgId}/cohorts/${cohortId}/sessions/${sessionId}`,
      { method: 'DELETE' }
    )
  }

  async getCohortParticipants(orgId: string, cohortId: string) {
    return this.request<{ ok: boolean; participants: any[] }>(
      `/orgs/${orgId}/cohorts/${cohortId}/participants`
    )
  }

  async addCohortParticipant(orgId: string, cohortId: string, body: Record<string, unknown>) {
    return this.request<{ ok: boolean; participant: any }>(
      `/orgs/${orgId}/cohorts/${cohortId}/participants`,
      { method: 'POST', body: JSON.stringify(body) }
    )
  }

  async updateCohortParticipant(
    orgId: string,
    cohortId: string,
    participantId: string,
    body: Record<string, unknown>
  ) {
    return this.request<{ ok: boolean; participant: any }>(
      `/orgs/${orgId}/cohorts/${cohortId}/participants/${participantId}`,
      { method: 'PATCH', body: JSON.stringify(body) }
    )
  }

  async getCohortAttendance(orgId: string, cohortId: string, sessionId: string) {
    return this.request<{ ok: boolean; attendance: any[] }>(
      `/orgs/${orgId}/cohorts/${cohortId}/sessions/${sessionId}/attendance`
    )
  }

  async saveCohortAttendance(
    orgId: string,
    cohortId: string,
    sessionId: string,
    records: Array<{ childId: string; status: 'present' | 'absent' | 'late' }>
  ) {
    return this.request<{ ok: boolean; count: number }>(
      `/orgs/${orgId}/cohorts/${cohortId}/sessions/${sessionId}/attendance`,
      { method: 'POST', body: JSON.stringify({ records }) }
    )
  }

  // ── Schedule blocking ──────────────────────────────────────────────────────

  async getSpecialistBlocking(orgId: string, specialistId: string) {
    return this.request<{
      blocks: Array<{
        id: string
        startDate: string
        endDate: string
        startTime: string | null
        endTime: string | null
        reason: string | null
        createdAt: string
      }>
    }>(`/orgs/${orgId}/specialists/${specialistId}/blocking`)
  }

  async createSpecialistBlock(
    orgId: string,
    specialistId: string,
    payload: {
      startDate: string
      endDate: string
      startTime?: string | null
      endTime?: string | null
      reason?: string | null
    }
  ) {
    return this.request<{ ok: boolean; block: { id: string } }>(
      `/orgs/${orgId}/specialists/${specialistId}/blocking`,
      { method: 'POST', body: JSON.stringify(payload) }
    )
  }

  async deleteSpecialistBlock(orgId: string, specialistId: string, blockId: string) {
    return this.request<{ ok: boolean }>(
      `/orgs/${orgId}/specialists/${specialistId}/blocking/${blockId}`,
      { method: 'DELETE' }
    )
  }

  // ── Google Calendar integration ──────────────────────────────────────────

  async getCalendarConnectUrl() {
    return this.request<{ ok: boolean; url: string }>('/calendar/connect')
  }

  async getCalendarStatus() {
    return this.request<{
      ok: boolean
      connected: boolean
      googleEmail?: string
      connectedAt?: string
    }>('/calendar/status')
  }

  async disconnectCalendar() {
    return this.request<{ ok: boolean }>('/calendar/disconnect', { method: 'DELETE' })
  }

  // ── Legal / Consent ──────────────────────────────────────────────────────

  /** Public — no auth required */
  async getLegalDocuments() {
    return this.request<{
      documents: Array<{
        type: string
        version: string
        effectiveAt: string
        titleRu: string
        requiresReacceptance: boolean
        path: string
      }>
    }>('/legal/documents')
  }

  async getUserConsents() {
    return this.request<{
      consents: Array<{
        consentType: string
        isAccepted: boolean
        needsReacceptance: boolean
        documentVersion: string | null
        currentVersion: string
        acceptedAt: string | null
        withdrawnAt: string | null
      }>
    }>('/legal/consents')
  }

  async acceptConsent(
    consentType: string,
    documentVersion: string,
    locale = 'ru',
    metadata?: Record<string, string>
  ) {
    return this.request<{ ok: boolean; id: string; acceptedAt: string }>('/legal/consents', {
      method: 'POST',
      body: JSON.stringify({ consentType, documentVersion, locale, metadata }),
    })
  }

  async withdrawConsent(consentType: string) {
    return this.request<{ ok: boolean; withdrawnAt: string }>('/legal/consents/withdraw', {
      method: 'POST',
      body: JSON.stringify({ consentType }),
    })
  }

  async checkRequiredConsents() {
    return this.request<{ allRequiredAccepted: boolean; missing: string[] }>(
      '/legal/consents/check'
    )
  }

  // Clear all cache (useful for logout)
  clearCache() {
    cache.invalidate()
  }
}

export const apiClient = new ApiClient()
