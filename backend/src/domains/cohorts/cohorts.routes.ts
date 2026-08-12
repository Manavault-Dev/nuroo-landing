import type { FastifyPluginAsync } from 'fastify'
import multipart from '@fastify/multipart'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import admin from 'firebase-admin'
import { getFirestore, getStorageBucket } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import { eventDispatcher } from '../../modules/notifications/event.dispatcher.js'
import { writeAudit } from '../../infrastructure/audit/audit.js'
import {
  canCreateCohort,
  canManageCohort,
  canApproveCohort,
  isAdmin,
  validateStatusTransition,
  validateImmutableFields,
  denyNotInstructor,
  denyForbidden,
} from './cohorts.auth.js'
import {
  createPersistentRoom,
  createUniqueLink,
} from '../../infrastructure/meetings/google-meet.js'
import type {
  CohortDoc,
  SessionDoc,
  ParticipantDoc,
  AttendanceDoc,
  RecurringTemplate,
  CohortStatus,
} from './cohorts.types.js'

const RATE = { max: 60, timeWindow: '1 minute' }

// ─── Collections ──────────────────────────────────────────────────────────────

const COL = {
  cohorts: (orgId: string) => `organizations/${orgId}/cohorts`,
  cohort: (orgId: string, cohortId: string) => `organizations/${orgId}/cohorts/${cohortId}`,
  sessions: (orgId: string, cohortId: string) =>
    `organizations/${orgId}/cohorts/${cohortId}/sessions`,
  session: (orgId: string, cohortId: string, sessionId: string) =>
    `organizations/${orgId}/cohorts/${cohortId}/sessions/${sessionId}`,
  participants: (orgId: string, cohortId: string) =>
    `organizations/${orgId}/cohorts/${cohortId}/participants`,
  participant: (orgId: string, cohortId: string, participantId: string) =>
    `organizations/${orgId}/cohorts/${cohortId}/participants/${participantId}`,
  attendance: (orgId: string, cohortId: string, sessionId: string) =>
    `organizations/${orgId}/cohorts/${cohortId}/sessions/${sessionId}/attendance`,
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const recurringTemplateSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  repeatUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const cohortCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  instructorId: z.string().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  ageMin: z.number().int().min(0).max(100).nullable().optional(),
  ageMax: z.number().int().min(0).max(100).nullable().optional(),
  format: z.enum(['online', 'offline']).default('offline'),
  targetAudience: z.enum(['children', 'parents', 'specialists', 'all']).default('children'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price: z.number().min(0).default(0),
  currency: z.string().default('KGS'),
  maxParticipants: z.number().int().min(1).max(500).default(20),
  scheduleType: z.enum(['manual', 'recurring']).default('manual'),
  recurringTemplate: recurringTemplateSchema.nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
})

const COHORT_STATUSES = [
  'draft',
  'pending_approval',
  'open',
  'full',
  'in_progress',
  'completed',
  'archived',
  'cancelled',
] as const

const cohortUpdateSchema = cohortCreateSchema.partial().extend({
  status: z.enum(COHORT_STATUSES).optional(),
  rejectionComment: z.string().max(1000).nullable().optional(),
})

const sessionCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  format: z.enum(['online', 'offline']).optional(),
  topic: z.string().max(300).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const sessionUpdateSchema = sessionCreateSchema.partial().extend({
  status: z.enum(['scheduled', 'completed', 'cancelled', 'postponed']).optional(),
  meetingUrl: z.string().url().nullable().optional(),
  postponedFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
})

const participantCreateSchema = z.object({
  childId: z.string().min(1),
  childName: z.string().min(1).max(200),
  parentId: z.string().min(1),
  parentName: z.string().max(200).default(''),
  parentPhone: z.string().max(30).nullable().optional(),
  paymentStatus: z.enum(['paid', 'partial', 'pending']).default('pending'),
  amountPaid: z.number().min(0).default(0),
})

const attendanceSchema = z.object({
  records: z
    .array(
      z.object({
        childId: z.string().min(1),
        status: z.enum(['present', 'absent', 'late']),
      })
    )
    .min(1),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString()
}

function sortSessionsBySchedule<T extends Pick<SessionDoc, 'date' | 'startTime'>>(
  sessions: T[]
): T[] {
  return [...sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
  )
}

/** Generate session dates from recurring template */
function generateSessionDates(template: RecurringTemplate, cohortStartDate: string): string[] {
  const dates: string[] = []
  const until = new Date(template.repeatUntil + 'T00:00:00Z')
  const current = new Date(cohortStartDate + 'T00:00:00Z')

  let safety = 0
  while (current <= until && safety < 500) {
    safety++
    if (template.weekdays.includes(current.getUTCDay())) {
      dates.push(current.toISOString().split('T')[0])
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return dates
}

async function getOrgMeta(db: admin.firestore.Firestore, orgId: string) {
  const snap = await db.doc(`organizations/${orgId}`).get()
  const d = snap.data()
  return {
    orgName: (d?.name as string) || null,
    orgLogoUrl: (d?.logoUrl as string) || null,
    requireGroupApproval: (d?.requireGroupApproval as boolean) ?? false,
  }
}

async function getSpecialistName(db: admin.firestore.Firestore, uid: string): Promise<string> {
  const snap = await db.doc(`specialists/${uid}`).get()
  const d = snap.data()
  return d?.fullName || d?.name || ''
}

/** Fetch specialist's Google Calendar refresh token (if connected) */
async function getSpecialistRefreshToken(
  db: admin.firestore.Firestore,
  uid: string | null | undefined
): Promise<string | null> {
  if (!uid) return null
  const snap = await db.doc(`specialists/${uid}/integrations/google_calendar`).get()
  const d = snap.data()
  if (!d?.connected || !d?.refreshToken) return null
  return d.refreshToken as string
}

function computeStatus(cohort: CohortDoc): CohortStatus {
  if (cohort.status === 'cancelled' || cohort.status === 'completed') return cohort.status
  if (cohort.enrolledCount >= cohort.maxParticipants) return 'full'
  const today = new Date().toISOString().split('T')[0]
  if (cohort.startDate <= today && cohort.endDate >= today) return 'in_progress'
  if (cohort.endDate < today) return 'completed'
  return cohort.status
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export const cohortsRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  // ── GET /orgs/:orgId/cohorts ─────────────────────────────────────────────

  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/cohorts',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId } = request.params
      const snap = await db
        .collection(COL.cohorts(orgId))
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get()

      const cohorts = snap.docs.map((d) => {
        const data = { id: d.id, ...d.data() } as CohortDoc
        return { ...data, status: computeStatus(data) }
      })

      return { ok: true, cohorts }
    }
  )

  // ── POST /orgs/:orgId/cohorts ────────────────────────────────────────────

  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/cohorts',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const member = await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return
      if (!canCreateCohort(member))
        return denyForbidden(reply, 'Only org members can create groups')

      const { orgId } = request.params
      const body = cohortCreateSchema.parse(request.body)
      const now = nowIso()
      const id = randomUUID()

      const { orgName, orgLogoUrl } = await getOrgMeta(db, orgId)

      // Specialist auto-becomes instructor; admin can assign explicitly
      const resolvedInstructorId = isAdmin(member) ? (body.instructorId ?? member.uid) : member.uid

      const instructorName = await getSpecialistName(db, resolvedInstructorId)

      const doc: Omit<CohortDoc, 'id'> = {
        orgId,
        title: body.title,
        description: body.description,
        instructorId: resolvedInstructorId,
        instructorName,
        category: body.category ?? null,
        ageMin: body.ageMin ?? null,
        ageMax: body.ageMax ?? null,
        format: body.format,
        targetAudience: body.targetAudience ?? 'children',
        startDate: body.startDate,
        endDate: body.endDate,
        price: body.price,
        currency: body.currency,
        maxParticipants: body.maxParticipants,
        enrolledCount: 0,
        status: 'draft',
        scheduleType: body.scheduleType,
        recurringTemplate: (body.recurringTemplate as RecurringTemplate) ?? null,
        coverUrl: body.coverUrl ?? null,
        meetingUrl: null,
        meetingEventId: null,
        approvalStatus: null,
        submittedForApprovalAt: null,
        submittedBy: null,
        approvedAt: null,
        approvedBy: null,
        rejectionComment: null,
        orgName,
        orgLogoUrl,
        createdBy: request.user.uid,
        updatedBy: null,
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
      }

      await db.doc(COL.cohort(orgId, id)).set(doc)

      // Auto-generate sessions from recurring template
      if (body.scheduleType === 'recurring' && body.recurringTemplate) {
        const dates = generateSessionDates(
          body.recurringTemplate as RecurringTemplate,
          body.startDate
        )
        const sessionBatch = db.batch()
        for (const date of dates) {
          const sessionId = randomUUID()
          const sessionDoc: Omit<SessionDoc, 'id'> = {
            cohortId: id,
            orgId,
            date,
            startTime: body.recurringTemplate.startTime,
            endTime: body.recurringTemplate.endTime,
            format: body.format,
            meetingUrl: null,
            status: 'scheduled',
            topic: null,
            notes: null,
            postponedFrom: null,
            createdAt: now,
            updatedAt: now,
          }
          sessionBatch.set(db.doc(COL.session(orgId, id, sessionId)), sessionDoc)
        }
        await sessionBatch.commit()
      }

      return reply.code(201).send({ ok: true, cohort: { id, ...doc } })
    }
  )

  // ── GET /orgs/:orgId/cohorts/:cohortId ───────────────────────────────────

  fastify.get<{ Params: { orgId: string; cohortId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId } = request.params
      const snap = await db.doc(COL.cohort(orgId, cohortId)).get()
      if (!snap.exists) return reply.code(404).send({ error: 'Cohort not found' })

      const cohort = { id: snap.id, ...snap.data() } as CohortDoc
      return { ok: true, cohort: { ...cohort, status: computeStatus(cohort) } }
    }
  )

  // ── PATCH /orgs/:orgId/cohorts/:cohortId ─────────────────────────────────

  fastify.patch<{ Params: { orgId: string; cohortId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const member = await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId } = request.params
      const ref = db.doc(COL.cohort(orgId, cohortId))
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Cohort not found' })

      const cohort = snap.data() as CohortDoc

      // Permission: admin (any cohort) OR instructor (own cohort)
      if (!canManageCohort(member, cohort)) return denyNotInstructor(reply)

      const body = cohortUpdateSchema.parse(request.body)

      // Immutable field check for specialists
      if (!validateImmutableFields({ member, body: body as Record<string, unknown>, reply })) return

      const { requireGroupApproval } = await getOrgMeta(db, orgId)
      const updates: Record<string, unknown> = {
        ...body,
        updatedAt: nowIso(),
        updatedBy: request.user.uid,
      }

      // ── Status transition handling ────────────────────────────────────────
      if (body.status && body.status !== cohort.status) {
        const valid = validateStatusTransition({
          member,
          cohort,
          nextStatus: body.status,
          requireGroupApproval,
          reply,
        })
        if (!valid) return

        // pending_approval: set approval metadata
        if (body.status === 'pending_approval') {
          updates.approvalStatus = 'pending'
          updates.submittedForApprovalAt = nowIso()
          updates.submittedBy = request.user.uid
          updates.rejectionComment = null
        }

        // open (approve): set approval + published metadata
        if (body.status === 'open' && cohort.status === 'pending_approval') {
          if (!canApproveCohort(member))
            return denyForbidden(reply, 'Only admins can approve groups')
          updates.approvalStatus = 'approved'
          updates.approvedAt = nowIso()
          updates.approvedBy = request.user.uid
        }

        // draft (reject): store rejection comment
        if (body.status === 'draft' && cohort.status === 'pending_approval') {
          updates.approvalStatus = 'rejected'
          updates.rejectionComment = body.rejectionComment ?? null
        }

        // open: set publishedAt on first publish
        if (body.status === 'open' && !cohort.publishedAt) {
          updates.publishedAt = nowIso()

          // Auto-generate Google Meet room (online cohorts only)
          if (cohort.format === 'online' && !cohort.meetingUrl) {
            // Try: instructor's token → requesting user's token → skip
            const instructorToken = await getSpecialistRefreshToken(db, cohort.instructorId)
            const requesterToken =
              request.user!.uid !== cohort.instructorId
                ? await getSpecialistRefreshToken(db, request.user!.uid)
                : null
            const refreshToken = instructorToken ?? requesterToken

            if (!refreshToken) {
              fastify.log.info(
                { instructorId: cohort.instructorId, requesterId: request.user!.uid },
                'Google Meet skipped: no connected Google Calendar found for instructor or requester'
              )
            } else {
              try {
                const meet = await createPersistentRoom({
                  title: cohort.title,
                  description: cohort.description || undefined,
                  startDate: cohort.startDate,
                  endDate: cohort.endDate,
                  orgName: cohort.orgName ?? undefined,
                  refreshToken,
                })
                updates.meetingUrl = meet.meetingUrl
                updates.meetingEventId = meet.eventId
                fastify.log.info({ meetingUrl: meet.meetingUrl }, 'Google Meet room created ✅')

                const sessionsSnap = await db.collection(COL.sessions(orgId, cohortId)).get()
                if (!sessionsSnap.empty) {
                  const batch = db.batch()
                  for (const s of sessionsSnap.docs) {
                    batch.update(s.ref, { meetingUrl: meet.meetingUrl, updatedAt: nowIso() })
                  }
                  await batch.commit()
                }
              } catch (err) {
                fastify.log.warn({ err }, 'Google Meet room creation failed (non-fatal)')
              }
            }
          }
        }
      }

      // Only admin can reassign instructor
      if (body.instructorId && isAdmin(member)) {
        updates.instructorName = await getSpecialistName(db, body.instructorId)
      } else {
        delete updates.instructorId
      }

      await ref.update(updates)
      const updated = { id: cohortId, ...snap.data(), ...updates } as CohortDoc
      return { ok: true, cohort: { ...updated, status: computeStatus(updated) } }
    }
  )

  // ── DELETE /orgs/:orgId/cohorts/:cohortId ────────────────────────────────

  fastify.delete<{ Params: { orgId: string; cohortId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const member = await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId } = request.params
      const ref = db.doc(COL.cohort(orgId, cohortId))
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Cohort not found' })

      const cohort = snap.data() as CohortDoc
      if (!canManageCohort(member, cohort)) return denyNotInstructor(reply)

      await ref.update({ status: 'cancelled', updatedAt: nowIso(), updatedBy: request.user!.uid })
      return { ok: true }
    }
  )

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
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SessionDoc[]
      )
      return { ok: true, sessions }
    }
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
      const id = randomUUID()
      const cohortData = cohortSnap.data() as CohortDoc

      const sessionFormat = body.format ?? cohortData.format

      // For online sessions: inherit cohort's persistent room, or generate a unique link
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
        cohortId,
        orgId,
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        format: sessionFormat,
        meetingUrl,
        status: 'scheduled',
        topic: body.topic ?? null,
        notes: body.notes ?? null,
        postponedFrom: null,
        createdAt: now,
        updatedAt: now,
      }

      await db.doc(COL.session(orgId, cohortId, id)).set(doc)
      return reply.code(201).send({ ok: true, session: { id, ...doc } })
    }
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
    }
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
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Session not found' })

      await ref.update({ status: 'cancelled', updatedAt: nowIso() })
      return { ok: true }
    }
  )

  // ── GET /orgs/:orgId/cohorts/:cohortId/participants ───────────────────────

  fastify.get<{ Params: { orgId: string; cohortId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/participants',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId } = request.params
      const snap = await db
        .collection(COL.participants(orgId, cohortId))
        .orderBy('enrolledAt', 'asc')
        .get()

      const participants = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ParticipantDoc[]
      return { ok: true, participants }
    }
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
      const id = randomUUID()

      const doc: Omit<ParticipantDoc, 'id'> = {
        cohortId,
        orgId,
        childId: body.childId,
        childName: body.childName,
        parentId: body.parentId,
        parentName: body.parentName,
        parentPhone: body.parentPhone ?? null,
        status: 'active',
        paymentStatus: body.paymentStatus,
        amountPaid: body.amountPaid,
        totalAmount: cohortData.price,
        currency: cohortData.currency,
        enrolledAt: now,
        updatedAt: now,
      }

      await db.runTransaction(async (tx) => {
        tx.set(db.doc(COL.participant(orgId, cohortId, id)), doc)
        tx.update(cohortRef, {
          enrolledCount: admin.firestore.FieldValue.increment(1),
          updatedAt: now,
        })
      })

      // Fire cohort_enrollment_confirmed event (push + email) — non-blocking
      void (async () => {
        try {
          const [orgSnap, parentSnap] = await Promise.all([
            db.doc(`organizations/${orgId}`).get(),
            body.parentId ? db.doc(`users/${body.parentId}`).get() : Promise.resolve(null),
          ])
          const orgName: string = (orgSnap.data() as { name?: string } | undefined)?.name ?? orgId
          const parentEmail: string =
            (parentSnap?.data() as { email?: string } | undefined)?.email ?? ''
          const specialistName: string = cohortData.instructorId
            ? ((
                (await db.doc(`users/${cohortData.instructorId}`).get()).data() as
                  | { fullName?: string }
                  | undefined
              )?.fullName ?? 'Специалист')
            : 'Специалист'

          if (parentEmail && body.parentId) {
            eventDispatcher.dispatch({
              type: 'cohort_enrollment_confirmed',
              orgId,
              cohortId,
              cohortTitle: cohortData.title,
              parentId: body.parentId,
              parentName: body.parentName,
              parentEmail,
              specialistName,
              orgName,
              startDate: cohortData.startDate,
              meetingUrl: cohortData.meetingUrl ?? null,
            })
          }
        } catch {
          // notification failure must never affect enrollment response
        }
      })()

      writeAudit({
        db,
        orgId,
        entityType: 'participant',
        entityId: id,
        action: 'participant.enrolled',
        actorId: request.user!.uid,
        actorRole: member.role === 'org_admin' ? 'org_admin' : 'specialist',
        before: {},
        after: { cohortId, parentId: body.parentId, childName: body.childName },
      })

      return reply.code(201).send({ ok: true, participant: { id, ...doc } })
    }
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

      const body = z
        .object({
          status: z.enum(['active', 'dropped', 'completed']).optional(),
          paymentStatus: z.enum(['paid', 'partial', 'pending']).optional(),
          amountPaid: z.number().min(0).optional(),
          parentPhone: z.string().max(30).nullable().optional(),
        })
        .parse(request.body)

      await ref.update({ ...body, updatedAt: nowIso() })
      return { ok: true, participant: { id: participantId, ...snap.data(), ...body } }
    }
  )

  // ── POST /orgs/:orgId/cohorts/:cohortId/sessions/:sessionId/attendance ────

  fastify.post<{ Params: { orgId: string; cohortId: string; sessionId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/sessions/:sessionId/attendance',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const member = await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId, sessionId } = request.params
      const cohortSnap = await db.doc(COL.cohort(orgId, cohortId)).get()
      if (!cohortSnap.exists) return reply.code(404).send({ error: 'Cohort not found' })
      if (!canManageCohort(member, cohortSnap.data() as CohortDoc)) return denyNotInstructor(reply)

      const body = attendanceSchema.parse(request.body)
      const now = nowIso()
      const markedBy = request.user.uid

      const batch = db.batch()
      for (const record of body.records) {
        const doc: AttendanceDoc = {
          childId: record.childId,
          sessionId,
          cohortId,
          status: record.status,
          markedAt: now,
          markedBy,
        }
        batch.set(db.doc(`${COL.attendance(orgId, cohortId, sessionId)}/${record.childId}`), doc)
      }
      // Mark session as completed
      await db.doc(COL.session(orgId, cohortId, sessionId)).update({
        status: 'completed',
        updatedAt: now,
      })
      await batch.commit()

      return { ok: true, count: body.records.length }
    }
  )

  // ── GET /orgs/:orgId/cohorts/:cohortId/sessions/:sessionId/attendance ─────

  fastify.get<{ Params: { orgId: string; cohortId: string; sessionId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/sessions/:sessionId/attendance',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId, sessionId } = request.params
      const snap = await db.collection(COL.attendance(orgId, cohortId, sessionId)).get()
      const attendance = snap.docs.map((d) => d.data()) as AttendanceDoc[]
      return { ok: true, attendance }
    }
  )

  // ── POST /orgs/:orgId/cohorts/:cohortId/cover ─────────────────────────────
  // Upload cohort cover image — admin only

  await fastify.register(multipart, { limits: { fileSize: 8 * 1024 * 1024, files: 1 } })

  fastify.post<{ Params: { orgId: string; cohortId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/cover',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const member = await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId } = request.params
      const ref = db.doc(COL.cohort(orgId, cohortId))
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Cohort not found' })
      if (!canManageCohort(member, snap.data() as CohortDoc)) return denyNotInstructor(reply)

      let imageBuffer: Buffer | null = null
      let imageMimetype = ''
      let imageFilename = 'cover'

      const parts = request.parts()
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'cover') {
          const chunks: Buffer[] = []
          for await (const chunk of part.file) chunks.push(chunk)
          imageBuffer = Buffer.concat(chunks)
          imageMimetype = part.mimetype || ''
          imageFilename = part.filename || 'cover'
        }
      }

      if (!imageBuffer || imageBuffer.length === 0) {
        return reply.code(400).send({ error: 'Image file is required' })
      }
      if (!imageMimetype.startsWith('image/')) {
        return reply.code(400).send({ error: 'Only image uploads are allowed' })
      }

      const bucket = await getStorageBucket()
      const safeName = imageFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `orgs/${orgId}/cohorts/${cohortId}/cover/${Date.now()}-${safeName}`
      const file = bucket.file(storagePath)

      await file.save(imageBuffer, {
        contentType: imageMimetype,
        metadata: { cacheControl: 'public, max-age=31536000' },
      })
      await file.makePublic()

      const coverUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`
      await ref.update({ coverUrl, updatedAt: new Date().toISOString() })

      return reply.code(200).send({ ok: true, coverUrl })
    }
  )
}
