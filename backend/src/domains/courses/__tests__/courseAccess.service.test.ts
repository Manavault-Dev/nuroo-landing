import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeCourseStatus,
  normalizeCourseVisibility,
  normalizeAccessPolicy,
  isPublishedPublicCourse,
  publicCoursePayload,
  entitlementIdFor,
  decideCourseAccess,
  grantCourseEntitlement,
  createEnrollmentFromEntitlement,
} from '../courseAccess.service.js'
import type { CourseDoc, CourseEntitlementDoc } from '../courses.types.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCourse(overrides: Partial<CourseDoc> = {}): CourseDoc {
  return {
    id: 'course1',
    orgId: 'org1',
    ownerOrgId: 'org1',
    title: 'Test Course',
    description: 'Test',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    accessPolicy: 'FREE',
    price: 0,
    currency: 'KGS',
    moduleCount: 0,
    lessonCount: 0,
    enrollmentCount: 0,
    createdBy: 'user1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    tags: [],
    ...overrides,
  } as CourseDoc
}

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    doc: (path: string) => ({
      get: vi.fn().mockResolvedValue({
        exists: path in overrides,
        id: path.split('/').pop(),
        data: () => overrides[path] ?? null,
      }),
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    }),
    collection: () => ({
      where: () => ({
        limit: () => ({ get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) }),
        where: () => ({
          orderBy: () => ({
            limit: () => ({ get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) }),
          }),
        }),
        orderBy: () => ({
          limit: () => ({ get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) }),
        }),
      }),
    }),
  } as any
}

// ─── normalizeCourseStatus ─────────────────────────────────────────────────

describe('normalizeCourseStatus', () => {
  it('normalizes lowercase published', () =>
    expect(normalizeCourseStatus('published')).toBe('PUBLISHED'))
  it('normalizes uppercase PUBLISHED', () =>
    expect(normalizeCourseStatus('PUBLISHED')).toBe('PUBLISHED'))
  it('normalizes lowercase archived', () =>
    expect(normalizeCourseStatus('archived')).toBe('ARCHIVED'))
  it('normalizes uppercase ARCHIVED', () =>
    expect(normalizeCourseStatus('ARCHIVED')).toBe('ARCHIVED'))
  it('defaults to DRAFT for undefined', () =>
    expect(normalizeCourseStatus(undefined)).toBe('DRAFT'))
  it('defaults to DRAFT for unknown value', () =>
    expect(normalizeCourseStatus('draft' as any)).toBe('DRAFT'))
  it('defaults to DRAFT for DRAFT', () => expect(normalizeCourseStatus('DRAFT')).toBe('DRAFT'))
})

// ─── normalizeCourseVisibility ─────────────────────────────────────────────

describe('normalizeCourseVisibility', () => {
  it('normalizes marketplace alias', () =>
    expect(normalizeCourseVisibility('marketplace' as any)).toBe('PUBLIC'))
  it('normalizes PUBLIC', () => expect(normalizeCourseVisibility('PUBLIC')).toBe('PUBLIC'))
  it('defaults to PRIVATE for undefined', () =>
    expect(normalizeCourseVisibility(undefined)).toBe('PRIVATE'))
  it('defaults to PRIVATE for org_only alias', () =>
    expect(normalizeCourseVisibility('PRIVATE')).toBe('PRIVATE'))
})

// ─── normalizeAccessPolicy ─────────────────────────────────────────────────

describe('normalizeAccessPolicy', () => {
  it('returns explicit policy when set', () => {
    expect(normalizeAccessPolicy({ accessPolicy: 'PAID' })).toBe('PAID')
    expect(normalizeAccessPolicy({ accessPolicy: 'INVITATION_ONLY' })).toBe('INVITATION_ONLY')
  })
  it('infers PAID from positive price', () => {
    expect(normalizeAccessPolicy({ price: 500 })).toBe('PAID')
  })
  it('infers FREE when price is 0', () => {
    expect(normalizeAccessPolicy({ price: 0 })).toBe('FREE')
  })
  it('infers FREE when price is absent', () => {
    expect(normalizeAccessPolicy({})).toBe('FREE')
  })
})

// ─── isPublishedPublicCourse ───────────────────────────────────────────────

describe('isPublishedPublicCourse', () => {
  it('returns true for PUBLISHED + PUBLIC', () => {
    expect(isPublishedPublicCourse(makeCourse())).toBe(true)
  })
  it('returns false for DRAFT', () => {
    expect(isPublishedPublicCourse(makeCourse({ status: 'DRAFT' }))).toBe(false)
  })
  it('returns false for PRIVATE visibility', () => {
    expect(isPublishedPublicCourse(makeCourse({ visibility: 'PRIVATE' }))).toBe(false)
  })
  it('returns false for ARCHIVED', () => {
    expect(isPublishedPublicCourse(makeCourse({ status: 'ARCHIVED' }))).toBe(false)
  })
  it('handles lowercase published + marketplace aliases', () => {
    expect(
      isPublishedPublicCourse(
        makeCourse({ status: 'published' as any, visibility: 'marketplace' as any })
      )
    ).toBe(true)
  })
})

// ─── publicCoursePayload ───────────────────────────────────────────────────

describe('publicCoursePayload', () => {
  it('normalizes status and visibility', () => {
    const result = publicCoursePayload(
      makeCourse({ status: 'published' as any, visibility: 'marketplace' as any })
    )
    expect(result.status).toBe('PUBLISHED')
    expect(result.visibility).toBe('PUBLIC')
  })

  it('forces price to 0 for FREE policy', () => {
    const result = publicCoursePayload(makeCourse({ accessPolicy: 'FREE', price: 999 }))
    expect(result.price).toBe(0)
  })

  it('keeps price for PAID policy', () => {
    const result = publicCoursePayload(makeCourse({ accessPolicy: 'PAID', price: 1500 }))
    expect(result.price).toBe(1500)
  })

  it('prefers coverUrl over coverImageUrl', () => {
    const result = publicCoursePayload(
      makeCourse({ coverUrl: 'https://a.com/cover.jpg', coverImageUrl: 'https://b.com/old.jpg' })
    )
    expect(result.coverUrl).toBe('https://a.com/cover.jpg')
  })

  it('falls back to coverImageUrl when coverUrl is absent', () => {
    const result = publicCoursePayload(
      makeCourse({ coverUrl: undefined, coverImageUrl: 'https://b.com/old.jpg' })
    )
    expect(result.coverUrl).toBe('https://b.com/old.jpg')
  })

  it('defaults currency to KGS', () => {
    const result = publicCoursePayload(makeCourse({ currency: undefined }))
    expect(result.currency).toBe('KGS')
  })

  it('sets ownerOrgId from orgId when missing', () => {
    const result = publicCoursePayload(makeCourse({ ownerOrgId: undefined }))
    expect(result.ownerOrgId).toBe('org1')
  })
})

// ─── entitlementIdFor ──────────────────────────────────────────────────────

describe('entitlementIdFor', () => {
  it('combines orgId and courseId with underscore', () => {
    expect(entitlementIdFor('org1', 'course1')).toBe('org1_course1')
  })
})

// ─── decideCourseAccess ────────────────────────────────────────────────────

describe('decideCourseAccess', () => {
  it('grants access for FREE course without entitlement', async () => {
    const db = makeDb()
    const course = makeCourse({ accessPolicy: 'FREE' })
    const result = await decideCourseAccess(db, course, 'user1')
    expect(result.canAccess).toBe(true)
    expect(result.requiresPayment).toBe(false)
    expect(result.freeReason).toBe('FREE_POLICY')
  })

  it('grants access when active entitlement exists', async () => {
    const entitlement: CourseEntitlementDoc = {
      id: 'org1_course1',
      courseId: 'course1',
      orgId: 'org1',
      userId: 'user1',
      source: 'FREE_POLICY',
      status: 'ACTIVE',
      pricePaid: 0,
      currency: 'KGS',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const db = makeDb({ 'users/user1/courseEntitlements/org1_course1': entitlement })
    const course = makeCourse({ accessPolicy: 'PAID', price: 1500 })
    const result = await decideCourseAccess(db, course, 'user1')
    expect(result.canAccess).toBe(true)
    expect(result.entitlement).toBeDefined()
  })

  it('blocks PAID course without entitlement and sets requiresPayment', async () => {
    const db = makeDb()
    const course = makeCourse({ accessPolicy: 'PAID', price: 1500 })
    const result = await decideCourseAccess(db, course, 'user1')
    expect(result.canAccess).toBe(false)
    expect(result.requiresPayment).toBe(true)
    expect(result.price).toBe(1500)
  })

  it('blocks INVITATION_ONLY course', async () => {
    const db = makeDb()
    const course = makeCourse({ accessPolicy: 'INVITATION_ONLY' })
    const result = await decideCourseAccess(db, course, 'user1')
    expect(result.canAccess).toBe(false)
    expect(result.blockedReason).toBe('INVITATION_REQUIRED')
    expect(result.requiresPayment).toBe(false)
  })

  it('blocks VERIFIED_SPECIAL_NEEDS without approved verification', async () => {
    const db = makeDb()
    const course = makeCourse({ accessPolicy: 'VERIFIED_SPECIAL_NEEDS', price: 500 })
    const result = await decideCourseAccess(db, course, 'user1')
    expect(result.canAccess).toBe(false)
    expect(result.verificationStatus).toBe('NONE')
  })

  it('grants VERIFIED_SPECIAL_NEEDS when verification is APPROVED', async () => {
    const verDoc = {
      parentUserId: 'user1',
      childId: 'child1',
      status: 'APPROVED',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const approvedResult = { empty: false, docs: [{ data: () => verDoc }] }
    const db = {
      doc: (path: string) => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
      }),
      collection: () => ({
        where: () => ({
          limit: () => ({ get: vi.fn().mockResolvedValue(approvedResult) }),
          where: () => ({
            orderBy: () => ({
              limit: () => ({ get: vi.fn().mockResolvedValue(approvedResult) }),
            }),
          }),
          orderBy: () => ({
            limit: () => ({ get: vi.fn().mockResolvedValue(approvedResult) }),
          }),
        }),
      }),
    } as any
    const course = makeCourse({ accessPolicy: 'VERIFIED_SPECIAL_NEEDS', price: 0 })
    const result = await decideCourseAccess(db, course, 'user1')
    expect(result.canAccess).toBe(true)
    expect(result.freeReason).toBe('APPROVED_SPECIAL_NEEDS')
  })
})

// ─── grantCourseEntitlement ────────────────────────────────────────────────

describe('grantCourseEntitlement', () => {
  it('creates entitlement with correct fields', async () => {
    const setMock = vi.fn().mockResolvedValue(undefined)
    const db = { doc: () => ({ set: setMock, get: vi.fn() }) } as any
    const course = makeCourse()
    const result = await grantCourseEntitlement(db, course, 'user1', 'FREE_POLICY', undefined, 0)

    expect(result.userId).toBe('user1')
    expect(result.courseId).toBe('course1')
    expect(result.orgId).toBe('org1')
    expect(result.status).toBe('ACTIVE')
    expect(result.source).toBe('FREE_POLICY')
    expect(result.pricePaid).toBe(0)
    expect(setMock).toHaveBeenCalledOnce()
  })

  it('stores pricePaid for PURCHASE source', async () => {
    const setMock = vi.fn().mockResolvedValue(undefined)
    const db = { doc: () => ({ set: setMock, get: vi.fn() }) } as any
    const course = makeCourse({ accessPolicy: 'PAID', price: 1500 })
    const result = await grantCourseEntitlement(db, course, 'user1', 'PURCHASE', undefined, 1500)
    expect(result.pricePaid).toBe(1500)
    expect(result.source).toBe('PURCHASE')
  })
})

// ─── createEnrollmentFromEntitlement ──────────────────────────────────────

describe('createEnrollmentFromEntitlement', () => {
  it('creates enrollment with ACTIVE status', async () => {
    const setMock = vi.fn().mockResolvedValue(undefined)
    const db = { doc: () => ({ set: setMock }) } as any
    const course = makeCourse()
    const entitlement: CourseEntitlementDoc = {
      id: 'org1_course1',
      courseId: 'course1',
      orgId: 'org1',
      userId: 'user1',
      source: 'FREE_POLICY',
      status: 'ACTIVE',
      pricePaid: 0,
      currency: 'KGS',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const result = await createEnrollmentFromEntitlement(db, course, entitlement)
    expect(result.status).toBe('ACTIVE')
    expect(result.userId).toBe('user1')
    expect(result.courseId).toBe('course1')
    expect(result.accessSource).toBe('FREE_POLICY')
    expect(setMock).toHaveBeenCalledOnce()
  })
})
