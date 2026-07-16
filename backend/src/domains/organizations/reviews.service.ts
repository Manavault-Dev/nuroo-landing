// Pure business logic for org reviews — no Firestore imports, fully unit-testable.

export type ReviewStatus = 'published' | 'removed'

export interface ReviewDoc {
  authorId: string
  authorName: string
  rating: number // 1–5 integer
  text: string
  status: ReviewStatus
  createdAt: string // ISO-8601
  updatedAt: string
  isVerifiedEnrollment: boolean
}

export interface PublicReview {
  id: string
  authorName: string
  rating: number
  text: string
  createdAt: string
  updatedAt: string
  isVerifiedEnrollment: boolean
}

export interface OrgRatingAggregate {
  reviewCount: number
  averageRating: number // 0.0 – 5.0, one decimal
}

export const RATING_MIN = 1
export const RATING_MAX = 5
export const TEXT_MIN = 0
export const TEXT_MAX = 1000
export const AUTHOR_NAME_MAX = 100

/**
 * Recalculate aggregate when a review is added, edited, or deleted.
 *
 * - oldRating = null  →  new review (nothing to undo)
 * - newRating = null  →  review deleted (undo without adding)
 * - both provided     →  review edited (swap old for new)
 */
export function recalculateAggregate(
  current: OrgRatingAggregate,
  oldRating: number | null,
  newRating: number | null
): OrgRatingAggregate {
  let sum = current.reviewCount * current.averageRating
  let count = current.reviewCount

  if (oldRating !== null) {
    sum -= oldRating
    count -= 1
  }
  if (newRating !== null) {
    sum += newRating
    count += 1
  }

  // Guard against floating-point drift and count underflow
  count = Math.max(0, count)
  const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0

  return { reviewCount: count, averageRating: avg }
}

/** Strip author-private fields before sending to public clients. */
export function toPublicReview(id: string, doc: ReviewDoc): PublicReview {
  return {
    id,
    authorName: doc.authorName,
    rating: doc.rating,
    text: doc.text,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    isVerifiedEnrollment: doc.isVerifiedEnrollment,
  }
}

/** Validate rating/text values; return null if valid, error string if not. */
export function validateReviewInput(rating: unknown, text: unknown): string | null {
  if (
    typeof rating !== 'number' ||
    !Number.isInteger(rating) ||
    rating < RATING_MIN ||
    rating > RATING_MAX
  ) {
    return `rating must be an integer between ${RATING_MIN} and ${RATING_MAX}`
  }
  if (typeof text !== 'string') {
    return 'text must be a string'
  }
  if (TEXT_MIN > 0 && text.trim().length < TEXT_MIN) {
    return `text must be at least ${TEXT_MIN} characters`
  }
  if (text.trim().length > TEXT_MAX) {
    return `text must be at most ${TEXT_MAX} characters`
  }
  return null
}
