import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ─── Re-define schemas here (mirrors courses.routes.ts) to test in isolation ─

const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  coverImageUrl: z.string().url().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  targetAudience: z.string().max(500).optional().nullable(),
  ageRange: z.string().max(50).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  visibility: z
    .enum(['PRIVATE', 'PUBLIC', 'org_only', 'marketplace'])
    .default('PRIVATE')
    .transform((v) => (v === 'marketplace' ? 'PUBLIC' : v === 'org_only' ? 'PRIVATE' : v)),
  accessPolicy: z.enum(['FREE', 'PAID', 'VERIFIED_SPECIAL_NEEDS', 'INVITATION_ONLY']).optional(),
  price: z.number().min(0).default(0),
  currency: z.string().default('KGS'),
})

const updateCourseSchema = createCourseSchema.partial().extend({
  status: z
    .enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'draft', 'published', 'archived'])
    .optional()
    .transform((v) =>
      v === undefined
        ? undefined
        : v === 'published'
          ? 'PUBLISHED'
          : v === 'archived'
            ? 'ARCHIVED'
            : v === 'draft'
              ? 'DRAFT'
              : v
    ),
})

// ─── createCourseSchema ────────────────────────────────────────────────────

describe('createCourseSchema', () => {
  const valid = { title: 'Test', description: 'Desc' }

  it('accepts minimal valid input', () => {
    const result = createCourseSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = createCourseSchema.safeParse({ ...valid, title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty description', () => {
    const result = createCourseSchema.safeParse({ ...valid, description: '' })
    expect(result.success).toBe(false)
  })

  it('rejects title over 200 chars', () => {
    const result = createCourseSchema.safeParse({ ...valid, title: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('defaults visibility to PRIVATE', () => {
    const result = createCourseSchema.safeParse(valid)
    expect(result.success && result.data.visibility).toBe('PRIVATE')
  })

  it('transforms marketplace → PUBLIC', () => {
    const result = createCourseSchema.safeParse({ ...valid, visibility: 'marketplace' })
    expect(result.success && result.data.visibility).toBe('PUBLIC')
  })

  it('transforms org_only → PRIVATE', () => {
    const result = createCourseSchema.safeParse({ ...valid, visibility: 'org_only' })
    expect(result.success && result.data.visibility).toBe('PRIVATE')
  })

  it('defaults price to 0', () => {
    const result = createCourseSchema.safeParse(valid)
    expect(result.success && result.data.price).toBe(0)
  })

  it('rejects negative price', () => {
    const result = createCourseSchema.safeParse({ ...valid, price: -1 })
    expect(result.success).toBe(false)
  })

  it('defaults currency to KGS', () => {
    const result = createCourseSchema.safeParse(valid)
    expect(result.success && result.data.currency).toBe('KGS')
  })

  it('defaults tags to empty array', () => {
    const result = createCourseSchema.safeParse(valid)
    expect(result.success && result.data.tags).toEqual([])
  })

  it('rejects more than 10 tags', () => {
    const result = createCourseSchema.safeParse({ ...valid, tags: Array(11).fill('tag') })
    expect(result.success).toBe(false)
  })

  it('accepts valid difficulty values', () => {
    for (const d of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const) {
      expect(createCourseSchema.safeParse({ ...valid, difficulty: d }).success).toBe(true)
    }
  })

  it('rejects invalid difficulty', () => {
    const result = createCourseSchema.safeParse({ ...valid, difficulty: 'EXPERT' })
    expect(result.success).toBe(false)
  })

  it('accepts valid accessPolicy values', () => {
    const policies = ['FREE', 'PAID', 'VERIFIED_SPECIAL_NEEDS', 'INVITATION_ONLY']
    for (const p of policies) {
      expect(createCourseSchema.safeParse({ ...valid, accessPolicy: p }).success).toBe(true)
    }
  })

  it('rejects invalid coverUrl', () => {
    const result = createCourseSchema.safeParse({ ...valid, coverUrl: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('accepts null coverUrl', () => {
    const result = createCourseSchema.safeParse({ ...valid, coverUrl: null })
    expect(result.success).toBe(true)
  })
})

// ─── updateCourseSchema ────────────────────────────────────────────────────

describe('updateCourseSchema', () => {
  it('accepts empty object (all optional)', () => {
    expect(updateCourseSchema.safeParse({}).success).toBe(true)
  })

  it('transforms lowercase published → PUBLISHED', () => {
    const result = updateCourseSchema.safeParse({ status: 'published' })
    expect(result.success && result.data.status).toBe('PUBLISHED')
  })

  it('transforms lowercase archived → ARCHIVED', () => {
    const result = updateCourseSchema.safeParse({ status: 'archived' })
    expect(result.success && result.data.status).toBe('ARCHIVED')
  })

  it('transforms lowercase draft → DRAFT', () => {
    const result = updateCourseSchema.safeParse({ status: 'draft' })
    expect(result.success && result.data.status).toBe('DRAFT')
  })

  it('keeps uppercase status as-is', () => {
    const result = updateCourseSchema.safeParse({ status: 'PUBLISHED' })
    expect(result.success && result.data.status).toBe('PUBLISHED')
  })

  it('allows partial updates (only title)', () => {
    const result = updateCourseSchema.safeParse({ title: 'New Title' })
    expect(result.success).toBe(true)
    expect(result.success && result.data.title).toBe('New Title')
  })

  it('rejects invalid status', () => {
    const result = updateCourseSchema.safeParse({ status: 'PENDING' })
    expect(result.success).toBe(false)
  })
})

// ─── validatePublishableCourse (logic inline) ──────────────────────────────

describe('validatePublishableCourse logic', () => {
  function validate(
    course: Partial<{
      title: string
      description: string
      accessPolicy: string
      price: number
      status: string
    }>
  ): string | null {
    if (course.status !== 'PUBLISHED') return null
    if (!course.title?.trim()) return 'Published courses require a title'
    if (!course.description?.trim()) return 'Published courses require a description'
    if (course.accessPolicy !== 'FREE' && Number(course.price || 0) <= 0) {
      return 'Paid access policies require a positive price'
    }
    return null
  }

  it('passes for DRAFT (no validation)', () => {
    expect(validate({ status: 'DRAFT' })).toBeNull()
  })

  it('blocks publishing without title', () => {
    expect(validate({ status: 'PUBLISHED', title: '', description: 'ok' })).toMatch(/title/)
  })

  it('blocks publishing without description', () => {
    expect(validate({ status: 'PUBLISHED', title: 'ok', description: '' })).toMatch(/description/)
  })

  it('blocks PAID course with price 0', () => {
    expect(
      validate({
        status: 'PUBLISHED',
        title: 'ok',
        description: 'ok',
        accessPolicy: 'PAID',
        price: 0,
      })
    ).toMatch(/price/)
  })

  it('passes FREE course with price 0', () => {
    expect(
      validate({
        status: 'PUBLISHED',
        title: 'ok',
        description: 'ok',
        accessPolicy: 'FREE',
        price: 0,
      })
    ).toBeNull()
  })

  it('passes PAID course with positive price', () => {
    expect(
      validate({
        status: 'PUBLISHED',
        title: 'ok',
        description: 'ok',
        accessPolicy: 'PAID',
        price: 1500,
      })
    ).toBeNull()
  })

  it('whitespace-only title fails', () => {
    expect(validate({ status: 'PUBLISHED', title: '   ', description: 'ok' })).toMatch(/title/)
  })
})
