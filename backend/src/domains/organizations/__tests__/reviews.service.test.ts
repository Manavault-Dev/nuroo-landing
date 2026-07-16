import { describe, it, expect } from 'vitest'
import {
  recalculateAggregate,
  toPublicReview,
  validateReviewInput,
  type ReviewDoc,
  type OrgRatingAggregate,
} from '../reviews.service.js'

// ── helpers ────────────────────────────────────────────────────────────────────

function agg(count: number, avg: number): OrgRatingAggregate {
  return { reviewCount: count, averageRating: avg }
}

const DOC: ReviewDoc = {
  authorId: 'u1',
  authorName: 'Айгуль',
  rating: 5,
  text: 'Отличный центр!',
  status: 'published',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  isVerifiedEnrollment: false,
}

// ── recalculateAggregate ───────────────────────────────────────────────────────

describe('recalculateAggregate', () => {
  it('adds first review to empty aggregate', () => {
    const result = recalculateAggregate(agg(0, 0), null, 5)
    expect(result).toEqual({ reviewCount: 1, averageRating: 5 })
  })

  it('adds second review and computes average', () => {
    const result = recalculateAggregate(agg(1, 5), null, 3)
    // (5 + 3) / 2 = 4.0
    expect(result).toEqual({ reviewCount: 2, averageRating: 4 })
  })

  it('rounds average to one decimal place', () => {
    // (5 + 3 + 4) / 3 = 4.0 exactly; test with 4+4+5+3 = 16/4 = 4.0
    // let's pick a case that needs rounding: (5+3+3) / 3 = 3.666… → 3.7
    const start = recalculateAggregate(agg(2, 4), null, 3) // adds 3 to (4+4) → 11/3 = 3.666…
    expect(start.averageRating).toBe(3.7)
    expect(start.reviewCount).toBe(3)
  })

  it('removes a review and recomputes average', () => {
    // 2 reviews avg 4.0  → remove one with rating 3 → only the 5 remains
    const result = recalculateAggregate(agg(2, 4), 3, null)
    expect(result).toEqual({ reviewCount: 1, averageRating: 5 })
  })

  it('returns zero avg when last review is removed', () => {
    const result = recalculateAggregate(agg(1, 4), 4, null)
    expect(result).toEqual({ reviewCount: 0, averageRating: 0 })
  })

  it('does not go below zero count on underflow', () => {
    // Defensive: call with empty aggregate and deletion
    const result = recalculateAggregate(agg(0, 0), 5, null)
    expect(result.reviewCount).toBe(0)
    expect(result.averageRating).toBe(0)
  })

  it('edits a review (swap old rating for new)', () => {
    // 3 reviews avg 4.0 (sum 12). Change one from 4 → 2: new sum 10, avg 3.3
    const result = recalculateAggregate(agg(3, 4), 4, 2)
    expect(result.reviewCount).toBe(3)
    expect(result.averageRating).toBe(3.3)
  })

  it('re-publishing a removed review adds it back to aggregate', () => {
    // oldRating = null (was removed from count), newRating = the rating
    const result = recalculateAggregate(agg(2, 4), null, 5)
    // (4+4+5)/3 = 4.3
    expect(result).toEqual({ reviewCount: 3, averageRating: 4.3 })
  })
})

// ── toPublicReview ─────────────────────────────────────────────────────────────

describe('toPublicReview', () => {
  it('strips authorId from output', () => {
    const pub = toPublicReview('review-1', DOC)
    expect((pub as any).authorId).toBeUndefined()
  })

  it('includes expected public fields', () => {
    const pub = toPublicReview('review-1', DOC)
    expect(pub).toMatchObject({
      id: 'review-1',
      authorName: 'Айгуль',
      rating: 5,
      text: 'Отличный центр!',
      isVerifiedEnrollment: false,
    })
  })

  it('does not include status (internal field)', () => {
    const pub = toPublicReview('r', DOC)
    expect((pub as any).status).toBeUndefined()
  })
})

// ── validateReviewInput ────────────────────────────────────────────────────────

describe('validateReviewInput', () => {
  it('returns null for valid input', () => {
    expect(validateReviewInput(4, 'Хороший центр, рекомендую!')).toBeNull()
  })

  it('rejects rating below 1', () => {
    expect(validateReviewInput(0, 'valid text here')).not.toBeNull()
  })

  it('rejects rating above 5', () => {
    expect(validateReviewInput(6, 'valid text here')).not.toBeNull()
  })

  it('rejects non-integer rating', () => {
    expect(validateReviewInput(4.5, 'valid text here')).not.toBeNull()
  })

  it('rejects non-number rating', () => {
    expect(validateReviewInput('5', 'valid text here')).not.toBeNull()
  })

  it('accepts empty review text for rating-only reviews', () => {
    expect(validateReviewInput(5, '')).toBeNull()
  })

  it('accepts short review text', () => {
    expect(validateReviewInput(5, 'Хорошо')).toBeNull()
  })

  it('rejects text longer than 1000 chars', () => {
    expect(validateReviewInput(5, 'a'.repeat(1001))).not.toBeNull()
  })

  it('accepts one-character text', () => {
    expect(validateReviewInput(3, 'a')).toBeNull()
  })

  it('accepts text at exactly max length', () => {
    expect(validateReviewInput(3, 'a'.repeat(1000))).toBeNull()
  })

  it('trims text before max length check', () => {
    expect(validateReviewInput(3, `   ${'a'.repeat(1000)}   `)).toBeNull()
  })
})
