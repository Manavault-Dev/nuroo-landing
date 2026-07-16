import type { FastifyPluginAsync } from 'fastify'
import { FieldPath } from 'firebase-admin/firestore'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import {
  recalculateAggregate,
  toPublicReview,
  validateReviewInput,
  type ReviewDoc,
} from './reviews.service.js'

const RATE_READ = { max: 120, timeWindow: '1 minute' }
const RATE_WRITE = { max: 10, timeWindow: '1 minute' }

const reviewInputSchema = z
  .object({
    rating: z.preprocess(
      (value) => (typeof value === 'string' ? Number(value) : value),
      z.number().int().min(1).max(5)
    ),
    text: z.string().trim().max(1000).optional().nullable(),
    comment: z.string().trim().max(1000).optional().nullable(),
    authorName: z.string().trim().max(100).optional().nullable(),
  })
  .transform((value) => ({
    rating: value.rating,
    text: (value.text ?? value.comment ?? '').trim(),
    authorName: value.authorName?.trim() || null,
  }))

const statusSchema = z.object({ status: z.enum(['published', 'removed']) })

// ── helpers ────────────────────────────────────────────────────────────────────

async function getOrgAggregate(db: FirebaseFirestore.Firestore, orgId: string) {
  const snap = await db.doc(`organizations/${orgId}`).get()
  const d = snap.data() || {}
  return {
    reviewCount: (d.reviewCount as number) ?? 0,
    averageRating: (d.averageRating as number) ?? 0,
  }
}

async function isOrgAdmin(
  db: FirebaseFirestore.Firestore,
  orgId: string,
  userId: string
): Promise<boolean> {
  const snap = await db
    .collection(`organizations/${orgId}/members`)
    .where('userId', '==', userId)
    .where('role', '==', 'admin')
    .limit(1)
    .get()
  return !snap.empty
}

function nowIso() {
  return new Date().toISOString()
}

async function resolveReviewerName(
  db: FirebaseFirestore.Firestore,
  userId: string,
  email: string | undefined,
  providedName: string | null
): Promise<string> {
  if (providedName) return providedName

  const [userSnap, parentSnap] = await Promise.all([
    db.doc(`users/${userId}`).get(),
    db.doc(`parents/${userId}`).get(),
  ])

  const userData = userSnap.data()
  const parentData = parentSnap.data()
  const profileName =
    parentData?.displayName ||
    parentData?.fullName ||
    parentData?.name ||
    userData?.displayName ||
    userData?.fullName ||
    userData?.name

  if (typeof profileName === 'string' && profileName.trim()) {
    return profileName.trim().slice(0, 100)
  }

  const emailName = email?.split('@')[0]?.trim()
  if (emailName) return emailName.slice(0, 100)

  return `User ${userId.slice(0, 6)}`
}

// ── routes ─────────────────────────────────────────────────────────────────────

export const reviewsRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  /**
   * GET /marketplace/orgs/:orgId/reviews
   * Public: returns published reviews for a public org, paginated.
   */
  fastify.get<{ Params: { orgId: string }; Querystring: { limit?: string; cursor?: string } }>(
    '/marketplace/orgs/:orgId/reviews',
    { config: { rateLimit: RATE_READ } },
    async (request, reply) => {
      const { orgId } = request.params
      const limit = Math.min(Number(request.query.limit ?? 20), 50)

      const orgSnap = await db.doc(`organizations/${orgId}`).get()
      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found' })
      }
      const orgData = orgSnap.data()!

      // Fetch more than needed, filter published in-memory (avoids composite index requirement)
      const snap = await db
        .collection(`organizations/${orgId}/reviews`)
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get()

      const allPublished = snap.docs.filter((d) => d.data().status === 'published')

      // Cursor-based pagination
      let startIndex = 0
      if (request.query.cursor) {
        const idx = allPublished.findIndex((d) => d.id === request.query.cursor)
        if (idx !== -1) startIndex = idx + 1
      }

      const page = allPublished.slice(startIndex, startIndex + limit)
      const reviews = page.map((d) => toPublicReview(d.id, d.data() as ReviewDoc))
      const nextCursor = page.length === limit ? page[page.length - 1].id : null

      return {
        ok: true,
        reviews,
        nextCursor,
        reviewCount: (orgData.reviewCount as number) ?? 0,
        averageRating: (orgData.averageRating as number) ?? 0,
      }
    }
  )

  /**
   * POST /marketplace/orgs/:orgId/reviews
   * Authenticated parent submits or updates their review (1 per user per org).
   */
  fastify.post<{ Params: { orgId: string } }>(
    '/marketplace/orgs/:orgId/reviews',
    { config: { rateLimit: RATE_WRITE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId } = request.params
      const userId = request.user.uid

      // Validate request body first (fail fast)
      const parse = reviewInputSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid input', issues: parse.error.issues })
      }
      const { rating, text } = parse.data

      // Double-check with service validator (source of truth for the rules)
      const validationError = validateReviewInput(rating, text)
      if (validationError) return reply.code(400).send({ error: validationError })

      // Verify org exists and is public
      const orgRef = db.doc(`organizations/${orgId}`)
      const orgSnap = await orgRef.get()
      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found' })
      }

      const authorName = await resolveReviewerName(
        db,
        userId,
        request.user.email,
        parse.data.authorName
      )

      // Load existing review for this user (upsert by userId as doc ID)
      const reviewRef = db.doc(`organizations/${orgId}/reviews/${userId}`)
      const existingSnap = await reviewRef.get()
      const oldRating = existingSnap.exists ? (existingSnap.data()!.rating as number) : null
      const isUpdate = existingSnap.exists

      // Check if user has any course entitlement for this org.
      // Entitlement doc IDs are `${orgId}_${courseId}` stored under
      // users/{userId}/courseEntitlements — a range query on __name__ needs
      // no composite index and no collection group index.
      const entSnap = await db
        .collection(`users/${userId}/courseEntitlements`)
        .where(FieldPath.documentId(), '>=', `${orgId}_`)
        .where(FieldPath.documentId(), '<', `${orgId}_￿`)
        .limit(1)
        .get()
      const isVerifiedEnrollment = !entSnap.empty

      const now = nowIso()
      const reviewDoc: ReviewDoc = {
        authorId: userId,
        authorName,
        rating,
        text,
        status: 'published',
        createdAt: isUpdate ? (existingSnap.data()!.createdAt as string) : now,
        updatedAt: now,
        isVerifiedEnrollment,
      }

      const orgData = orgSnap.data()!
      const current = {
        reviewCount: (orgData.reviewCount as number) ?? 0,
        averageRating: (orgData.averageRating as number) ?? 0,
      }
      const newAggregate = recalculateAggregate(current, oldRating, rating)

      const batch = db.batch()
      batch.set(reviewRef, reviewDoc)
      batch.update(orgRef, {
        reviewCount: newAggregate.reviewCount,
        averageRating: newAggregate.averageRating,
        updatedAt: now,
      })
      await batch.commit()

      return reply.code(isUpdate ? 200 : 201).send({
        ok: true,
        review: toPublicReview(userId, reviewDoc),
        aggregate: newAggregate,
      })
    }
  )

  /**
   * DELETE /marketplace/orgs/:orgId/reviews/:reviewId
   * Author can delete their own review; org admin can delete any review.
   */
  fastify.delete<{ Params: { orgId: string; reviewId: string } }>(
    '/marketplace/orgs/:orgId/reviews/:reviewId',
    { config: { rateLimit: RATE_WRITE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId, reviewId } = request.params
      const userId = request.user.uid

      const reviewRef = db.doc(`organizations/${orgId}/reviews/${reviewId}`)
      const reviewSnap = await reviewRef.get()
      if (!reviewSnap.exists) return reply.code(404).send({ error: 'Review not found' })

      const reviewData = reviewSnap.data() as ReviewDoc
      const isOwner = reviewData.authorId === userId
      if (!isOwner && !(await isOrgAdmin(db, orgId, userId))) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      const orgRef = db.doc(`organizations/${orgId}`)
      const current = await getOrgAggregate(db, orgId)

      // Only adjust aggregate if the review was published
      const newAggregate =
        reviewData.status === 'published'
          ? recalculateAggregate(current, reviewData.rating, null)
          : current

      const batch = db.batch()
      batch.delete(reviewRef)
      batch.update(orgRef, {
        reviewCount: newAggregate.reviewCount,
        averageRating: newAggregate.averageRating,
        updatedAt: nowIso(),
      })
      await batch.commit()

      return { ok: true, aggregate: newAggregate }
    }
  )

  /**
   * PUT /orgs/:orgId/reviews/:reviewId/status
   * Org admin: moderate a review (publish / remove).
   */
  fastify.put<{ Params: { orgId: string; reviewId: string } }>(
    '/orgs/:orgId/reviews/:reviewId/status',
    { config: { rateLimit: RATE_WRITE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId, reviewId } = request.params
      const userId = request.user.uid

      if (!(await isOrgAdmin(db, orgId, userId))) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      const parse = statusSchema.safeParse(request.body)
      if (!parse.success) return reply.code(400).send({ error: 'Invalid status' })

      const reviewRef = db.doc(`organizations/${orgId}/reviews/${reviewId}`)
      const reviewSnap = await reviewRef.get()
      if (!reviewSnap.exists) return reply.code(404).send({ error: 'Review not found' })

      const reviewData = reviewSnap.data() as ReviewDoc
      const wasPublished = reviewData.status === 'published'
      const willBePublished = parse.data.status === 'published'
      const statusChanged = wasPublished !== willBePublished

      const batch = db.batch()
      batch.update(reviewRef, { status: parse.data.status, updatedAt: nowIso() })

      if (statusChanged) {
        const orgRef = db.doc(`organizations/${orgId}`)
        const current = await getOrgAggregate(db, orgId)
        // Re-publishing: treat as adding the rating back (oldRating=null, newRating=rating)
        // Removing: treat as deleting it (oldRating=rating, newRating=null)
        const newAggregate = willBePublished
          ? recalculateAggregate(current, null, reviewData.rating)
          : recalculateAggregate(current, reviewData.rating, null)
        batch.update(orgRef, {
          reviewCount: newAggregate.reviewCount,
          averageRating: newAggregate.averageRating,
        })
      }

      await batch.commit()
      return { ok: true }
    }
  )

  /**
   * GET /orgs/:orgId/reviews
   * Org admin: list all reviews (all statuses) for moderation.
   */
  fastify.get<{ Params: { orgId: string }; Querystring: { status?: string } }>(
    '/orgs/:orgId/reviews',
    { config: { rateLimit: RATE_READ } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId } = request.params
      const userId = request.user.uid

      if (!(await isOrgAdmin(db, orgId, userId))) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      const snap = await db
        .collection(`organizations/${orgId}/reviews`)
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get()

      let reviews = snap.docs.map((d) => ({ id: d.id, ...(d.data() as ReviewDoc) }))

      if (request.query.status) {
        reviews = reviews.filter((r) => r.status === request.query.status)
      }

      const aggregate = await getOrgAggregate(db, orgId)

      return { ok: true, reviews, ...aggregate }
    }
  )
}
