import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import type { CohortDoc, PublicCohort } from './cohorts.types.js'

const RATE = { max: 120, timeWindow: '1 minute' }

function toPublic(doc: CohortDoc): PublicCohort {
  return {
    id: doc.id,
    orgId: doc.orgId,
    orgName: doc.orgName,
    orgLogoUrl: doc.orgLogoUrl,
    title: doc.title,
    description: doc.description,
    instructorName: doc.instructorName,
    category: doc.category,
    ageMin: doc.ageMin,
    ageMax: doc.ageMax,
    format: doc.format,
    startDate: doc.startDate,
    endDate: doc.endDate,
    price: doc.price,
    currency: doc.currency,
    maxParticipants: doc.maxParticipants,
    enrolledCount: doc.enrolledCount,
    spotsLeft: Math.max(0, doc.maxParticipants - doc.enrolledCount),
    status: doc.status,
    coverUrl: doc.coverUrl,
  }
}

export const cohortsMarketplaceRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  // ── GET /marketplace/cohorts ─────────────────────────────────────────────
  // Public listing — no auth required

  const listQuerySchema = z.object({
    category: z.string().optional(),
    format: z.enum(['online', 'offline']).optional(),
    ageMin: z.coerce.number().int().optional(),
    ageMax: z.coerce.number().int().optional(),
    orgId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(24),
  })

  fastify.get('/marketplace/cohorts', { config: { rateLimit: RATE } }, async (request) => {
    const query = listQuerySchema.parse(request.query)

    let cohorts: PublicCohort[] = []

    if (query.orgId) {
      // Single-org query — no index needed
      const snap = await db
        .collection(`organizations/${query.orgId}/cohorts`)
        .where('status', 'in', ['open', 'in_progress'])
        .limit(query.limit)
        .get()
      cohorts = snap.docs.map((d) => toPublic({ id: d.id, ...d.data() } as CohortDoc))
    } else {
      // Cross-org: fetch all org IDs first, then query each sub-collection individually.
      // Avoids collectionGroup indexes (which require firebase deploy --only firestore:indexes).
      const orgsSnap = await db.collection('organizations').select().get()
      const orgIds = orgsSnap.docs.map((d) => d.id)

      const perOrgLimit = Math.min(query.limit, 20)
      const results = await Promise.all(
        orgIds.map((orgId) =>
          db
            .collection(`organizations/${orgId}/cohorts`)
            .where('status', 'in', ['open', 'in_progress'])
            .limit(perOrgLimit)
            .get()
            .then((snap) => snap.docs.map((d) => toPublic({ id: d.id, ...d.data() } as CohortDoc)))
            .catch(() => [] as PublicCohort[])
        )
      )
      cohorts = results.flat()
    }

    if (query.category) cohorts = cohorts.filter((c) => c.category === query.category)
    if (query.format) cohorts = cohorts.filter((c) => c.format === query.format)
    if (query.ageMin !== null && query.ageMin !== undefined) {
      cohorts = cohorts.filter((c) => (c.ageMax ?? 99) >= query.ageMin!)
    }
    if (query.ageMax !== null && query.ageMax !== undefined) {
      cohorts = cohorts.filter((c) => (c.ageMin ?? 0) <= query.ageMax!)
    }

    cohorts.sort((a, b) => a.startDate.localeCompare(b.startDate))

    return { ok: true, cohorts }
  })

  // ── GET /marketplace/cohorts/:orgId/:cohortId ─────────────────────────────
  // Public detail page — no auth required

  fastify.get<{ Params: { orgId: string; cohortId: string } }>(
    '/marketplace/cohorts/:orgId/:cohortId',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      const { orgId, cohortId } = request.params
      const snap = await db.doc(`organizations/${orgId}/cohorts/${cohortId}`).get()
      if (!snap.exists) return reply.code(404).send({ error: 'Cohort not found' })

      const doc = { id: snap.id, ...snap.data() } as CohortDoc
      if (!['open', 'in_progress', 'full'].includes(doc.status)) {
        return reply.code(404).send({ error: 'Cohort not available' })
      }

      return { ok: true, cohort: toPublic(doc) }
    }
  )

  // ── GET /marketplace/cohorts/:orgId/:cohortId/sessions ───────────────────
  // Public upcoming sessions — no auth required

  fastify.get<{ Params: { orgId: string; cohortId: string } }>(
    '/marketplace/cohorts/:orgId/:cohortId/sessions',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      const { orgId, cohortId } = request.params
      const cohortSnap = await db.doc(`organizations/${orgId}/cohorts/${cohortId}`).get()
      if (!cohortSnap.exists) return reply.code(404).send({ error: 'Cohort not found' })

      const snap = await db
        .collection(`organizations/${orgId}/cohorts/${cohortId}/sessions`)
        .where('status', '==', 'scheduled')
        .orderBy('date', 'asc')
        .orderBy('startTime', 'asc')
        .limit(20)
        .get()

      const sessions = snap.docs.map((d) => {
        const s = d.data()
        return {
          id: d.id,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          format: s.format,
          status: s.status,
          topic: s.topic ?? null,
          meetingUrl: null, // don't expose meeting URLs publicly
        }
      })

      return { ok: true, sessions }
    }
  )

  // ── POST /marketplace/cohorts/:orgId/:cohortId/enroll ─────────────────────
  // Parent enrolls their child — auth required

  fastify.post<{ Params: { orgId: string; cohortId: string } }>(
    '/marketplace/cohorts/:orgId/:cohortId/enroll',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId, cohortId } = request.params
      const body = z
        .object({
          childId: z.string().min(1),
          childName: z.string().min(1).max(200),
          parentPhone: z.string().max(30).nullable().optional(),
        })
        .parse(request.body)

      const db2 = getFirestore()
      const cohortRef = db2.doc(`organizations/${orgId}/cohorts/${cohortId}`)
      const cohortSnap = await cohortRef.get()
      if (!cohortSnap.exists) return reply.code(404).send({ error: 'Cohort not found' })

      const cohort = cohortSnap.data() as CohortDoc
      if (!['open', 'in_progress'].includes(cohort.status)) {
        return reply.code(409).send({ error: 'Enrollment not available' })
      }
      if (cohort.enrolledCount >= cohort.maxParticipants) {
        return reply.code(409).send({ error: 'Cohort is full' })
      }

      // Check for duplicate enrollment
      const existingSnap = await db2
        .collection(`organizations/${orgId}/cohorts/${cohortId}/participants`)
        .where('childId', '==', body.childId)
        .limit(1)
        .get()
      if (!existingSnap.empty) {
        return reply.code(409).send({ error: 'Child already enrolled' })
      }

      // Get parent name from Firestore
      let parentName = ''
      try {
        const parentSnap = await db2.doc(`parents/${request.user.uid}`).get()
        if (parentSnap.exists) {
          const d = parentSnap.data()!
          parentName = d.fullName?.trim() || d.name?.trim() || ''
        }
      } catch {}

      const { randomUUID } = await import('crypto')
      const now = new Date().toISOString()
      const id = randomUUID()

      await db2.runTransaction(async (tx) => {
        const participantRef = db2.doc(
          `organizations/${orgId}/cohorts/${cohortId}/participants/${id}`
        )
        tx.set(participantRef, {
          cohortId,
          orgId,
          childId: body.childId,
          childName: body.childName,
          parentId: request.user!.uid,
          parentName,
          parentPhone: body.parentPhone ?? null,
          status: 'active',
          paymentStatus: 'pending',
          amountPaid: 0,
          totalAmount: cohort.price,
          currency: cohort.currency,
          enrolledAt: now,
          updatedAt: now,
        })
        tx.update(cohortRef, {
          enrolledCount: (await import('firebase-admin')).default.firestore.FieldValue.increment(1),
          updatedAt: now,
        })
      })

      return reply.code(201).send({ ok: true, enrollmentId: id })
    }
  )
}
