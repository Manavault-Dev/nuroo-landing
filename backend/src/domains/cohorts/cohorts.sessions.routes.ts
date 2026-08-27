import type { FastifyPluginAsync } from 'fastify'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import { canManageCohort, denyNotInstructor } from './cohorts.auth.js'
import { createUniqueLink } from '../../infrastructure/meetings/google-meet.js'
import type { CohortDoc, SessionDoc } from './cohorts.types.js'
import {
  RATE, COL,
  sessionCreateSchema, sessionUpdateSchema,
  nowIso, sortSessionsBySchedule,
  getSpecialistRefreshToken,
} from './cohorts.helpers.js'

export const cohortsSessionsRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  // ── GET /orgs/:orgId/cohorts/:cohortId/sessions ──────────────────────────

  fastify.get<{ Params: { orgId: string; cohortId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/sessions',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId } = request.params
      const snap = await db.collection(COL.sessions(orgId, cohortId)).get()
      const sessions = sortSessionsBySchedule(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SessionDoc[],
      )
      return { ok: true, sessions }
    },
  )

  // ── POST /orgs/:orgId/cohorts/:cohortId/sessions ─────────────────────────

  fastify.post<{ Params: { orgId: string; cohortId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/sessions',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const member = await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId } = request.params
      const cohortSnap = await db.doc(COL.cohort(orgId, cohortId)).get()
      if (!cohortSnap.exists) return reply.code(404).send({ error: 'Cohort not found' })
      if (!canManageCohort(member, cohortSnap.data() as CohortDoc)) return denyNotInstructor(reply)

      const body = sessionCreateSchema.parse(request.body)
      const now = nowIso()
      const { randomUUID } = await import('crypto')
      const id = randomUUID()
      const cohortData = cohortSnap.data() as CohortDoc
      const sessionFormat = body.format ?? cohortData.format

      let meetingUrl: string | null = cohortData.meetingUrl ?? null
      if (sessionFormat === 'online' && !meetingUrl) {
        try {
          const refreshToken = await getSpecialistRefreshToken(db, cohortData.instructorId)
          const meet = await createUniqueLink({
            title: `${cohortData.title} · ${body.date}`,
            date: body.date,
            startTime: body.startTime,
            endTime: body.endTime,
            refreshToken,
          })
          meetingUrl = meet.meetingUrl
        } catch (err) {
          fastify.log.warn({ err }, 'Google Meet unique link creation failed')
        }
      }

      const doc: Omit<SessionDoc, 'id'> = {
        cohortId, orgId,
        date: body.date, startTime: body.startTime, endTime: body.endTime,
        format: sessionFormat, meetingUrl,
        status: 'scheduled',
        topic: body.topic ?? null, notes: body.notes ?? null,
        postponedFrom: null, createdAt: now, updatedAt: now,
      }

      await db.doc(COL.session(orgId, cohortId, id)).set(doc)
      return reply.code(201).send({ ok: true, session: { id, ...doc } })
    },
  )

  // ── PATCH /orgs/:orgId/cohorts/:cohortId/sessions/:sessionId ─────────────

  fastify.patch<{ Params: { orgId: string; cohortId: string; sessionId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/sessions/:sessionId',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const member = await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId, sessionId } = request.params
      const cohortSnap = await db.doc(COL.cohort(orgId, cohortId)).get()
      if (!cohortSnap.exists) return reply.code(404).send({ error: 'Cohort not found' })
      if (!canManageCohort(member, cohortSnap.data() as CohortDoc)) return denyNotInstructor(reply)

      const ref = db.doc(COL.session(orgId, cohortId, sessionId))
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Session not found' })

      const body = sessionUpdateSchema.parse(request.body)
      await ref.update({ ...body, updatedAt: nowIso() })
      return { ok: true, session: { id: sessionId, ...snap.data(), ...body } }
    },
  )

  // ── DELETE /orgs/:orgId/cohorts/:cohortId/sessions/:sessionId ────────────

  fastify.delete<{ Params: { orgId: string; cohortId: string; sessionId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/sessions/:sessionId',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const member = await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId, sessionId } = request.params
      const cohortSnap = await db.doc(COL.cohort(orgId, cohortId)).get()
      if (!cohortSnap.exists) return reply.code(404).send({ error: 'Cohort not found' })
      if (!canManageCohort(member, cohortSnap.data() as CohortDoc)) return denyNotInstructor(reply)

      const ref = db.doc(COL.session(orgId, cohortId, sessionId))
      if (!(await ref.get()).exists) return reply.code(404).send({ error: 'Session not found' })

      await ref.update({ status: 'cancelled', updatedAt: nowIso() })
      return { ok: true }
    },
  )
}
