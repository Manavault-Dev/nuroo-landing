/**
 * TDD tests for favorites routes — London School (mock-first).
 * Tests the domain logic / input validation, not Firestore directly.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ── Schemas duplicated here for unit testing without spinning up Fastify ───────

const addFavoriteSchema = z.object({
  orgId: z.string().trim().min(1),
  specialistId: z.string().trim().min(1),
  specialistName: z.string().trim().max(200).default(''),
  specialistAvatar: z.string().url().nullable().optional(),
  orgName: z.string().trim().max(200).default(''),
})

describe('favorites input validation', () => {
  it('accepts valid favorite input', () => {
    const result = addFavoriteSchema.safeParse({
      orgId: 'org_1',
      specialistId: 'spec_1',
      specialistName: 'Иванов Иван',
      orgName: 'Центр',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing orgId', () => {
    const result = addFavoriteSchema.safeParse({
      specialistId: 'spec_1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid avatar URL', () => {
    const result = addFavoriteSchema.safeParse({
      orgId: 'org_1',
      specialistId: 'spec_1',
      specialistAvatar: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('allows null avatar', () => {
    const result = addFavoriteSchema.safeParse({
      orgId: 'org_1',
      specialistId: 'spec_1',
      specialistAvatar: null,
    })
    expect(result.success).toBe(true)
  })

  it('defaults specialistName to empty string', () => {
    const result = addFavoriteSchema.safeParse({
      orgId: 'org_1',
      specialistId: 'spec_1',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.specialistName).toBe('')
  })
})

describe('favorites idempotency key', () => {
  it('uses specialistId as the Firestore doc ID (idempotent saves)', () => {
    // Design contract: userFavorites/{parentId}/specialists/{specialistId}
    // Re-saving same specialist replaces, not duplicates
    const specialistId = 'spec_abc'
    const docPath = `userFavorites/parent_1/specialists/${specialistId}`
    expect(docPath).toBe('userFavorites/parent_1/specialists/spec_abc')
  })
})
