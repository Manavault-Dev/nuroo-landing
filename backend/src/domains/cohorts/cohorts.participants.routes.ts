import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import admin from 'firebase-admin'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import { eventDispatcher } from '../../modules/notifications/event.dispatcher.js'
import { writeAudit } from '../../infrastructure/audit/audit.js'
import { canManageCohort, denyNotInstructor } from './cohorts.auth.js'
import type { CohortDoc, ParticipantDoc } from './cohorts.types.js'
import { RATE, COL, participantCreateSchema, nowIso } from './cohorts.helpers.js'

export const cohortsParticipantsRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  // ── GET /orgs/:orgId/cohorts/:cohortId/participants ───────────────────────

  fastify.get<{ Params: { orgId: string; cohortId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/participants',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId } = request.params
      const snap = await db.collection(COL.participants(orgId, cohortId)).orderBy('enrolledAt', 'asc').get()
      const participants = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ParticipantDoc[]
      return { ok: true, participants }
    },
  )

  // ── POST /orgs/:orgId/cohorts/:cohortId/participants ─────────────────────

  fastify.post<{ Params: { orgId: string; cohortId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/participants',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const member = await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId } = request.params
      const cohortRef = db.doc(COL.cohort(orgId, cohortId))
      const cohortSnap = await cohortRef.get()
      if (!cohortSnap.exists) return reply.code(404).send({ error: 'Cohort not found' })

      const cohortData = cohortSnap.data() as CohortDoc
      if (!canManageCohort(member, cohortData)) return denyNotInstructor(reply)
      if (cohortData.enrolledCount >= cohortData.maxParticipants) {
        return reply.code(409).send({ error: 'Cohort is full' })
      }

      const body = participantCreateSchema.parse(request.body)
      const now = nowIso()
      const { randomUUID } = await import('crypto')
      const id = randomUUID()

      const doc: Omit<ParticipantDoc, 'id'> = {
        cohortId, orgId,
        childId: body.childId, childName: body.childName,
        parentId: body.parentId, parentName: body.parentName,
        parentPhone: body.parentPhone ?? null,
        status: 'active',
        paymentStatus: body.paymentStatus,
        amountPaid: body.amountPaid,
        totalAmount: cohortData.price,
        currency: cohortData.currency,
        enrolledAt: now, updatedAt: now,
      }

      await db.runTransaction(async (tx) => {
        tx.set(db.doc(COL.participant(orgId, cohortId, id)), doc)
        tx.update(cohortRef, { enrolledCount: admin.firestore.FieldValue.increment(1), updatedAt: now })
      })

      void (async () => {
        try {
          const [orgSnap, parentSnap] = await Promise.all([
            db.doc(`organizations/${orgId}`).get(),
            body.parentId ? db.doc(`users/${body.parentId}`).get() : Promise.resolve(null),
          ])
          const orgName: string = (orgSnap.data() as { name?: string } | undefined)?.name ?? orgId
          const parentEmail: string = (parentSnap?.data() as { email?: string } | undefined)?.email ?? ''
          const specialistName: string = cohortData.instructorId
            ? (((await db.doc(`users/${cohortData.instructorId}`).get()).data() as { fullName?: string } | undefined)?.fullName ?? 'Специалист')
            : 'Специалист'

          if (parentEmail && body.parentId) {
            eventDispatcher.dispatch({
              type: 'cohort_enrollment_confirmed',
              orgId, cohortId,
              cohortTitle: cohortData.title,
              parentId: body.parentId, parentName: body.parentName, parentEmail,
              specialistName, orgName,
              startDate: cohortData.startDate,
              meetingUrl: cohortData.meetingUrl ?? null,
            })
          }
        } catch { /* notification failure must never affect enrollment response */ }
      })()

      writeAudit({
        db, orgId,
        entityType: 'participant', entityId: id,
        action: 'participant.enrolled',
        actorId: request.user!.uid,
        actorRole: member.role === 'org_admin' ? 'org_admin' : 'specialist',
        before: {},
        after: { cohortId, parentId: body.parentId, childName: body.childName },
      })

      return reply.code(201).send({ ok: true, participant: { id, ...doc } })
    },
  )

  // ── PATCH /orgs/:orgId/cohorts/:cohortId/participants/:participantId ──────

  fastify.patch<{ Params: { orgId: string; cohortId: string; participantId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/participants/:participantId',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const member = await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId, participantId } = request.params
      const cohortSnap = await db.doc(COL.cohort(orgId, cohortId)).get()
      if (!cohortSnap.exists) return reply.code(404).send({ error: 'Cohort not found' })
      if (!canManageCohort(member, cohortSnap.data() as CohortDoc)) return denyNotInstructor(reply)

      const ref = db.doc(COL.participant(orgId, cohortId, participantId))
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Participant not found' })

      const body = z.object({
        status:        z.enum(['active', 'dropped', 'completed']).optional(),
        paymentStatus: z.enum(['paid', 'partial', 'pending']).optional(),
        amountPaid:    z.number().min(0).optional(),
        parentPhone:   z.string().max(30).nullable().optional(),
      }).parse(request.body)

      await ref.update({ ...body, updatedAt: nowIso() })
      return { ok: true, participant: { id: participantId, ...snap.data(), ...body } }
    },
  )
}
