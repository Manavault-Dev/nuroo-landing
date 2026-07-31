import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import admin from 'firebase-admin'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import type {
  CohortDoc,
  SessionDoc,
  ParticipantDoc,
  AttendanceDoc,
  RecurringTemplate,
  CohortFormat,
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
  ageMin: z.number().int().min(0).max(18).nullable().optional(),
  ageMax: z.number().int().min(0).max(18).nullable().optional(),
  format: z.enum(['online', 'offline']).default('offline'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price: z.number().min(0).default(0),
  currency: z.string().default('KGS'),
  maxParticipants: z.number().int().min(1).max(500).default(20),
  scheduleType: z.enum(['manual', 'recurring']).default('manual'),
  recurringTemplate: recurringTemplateSchema.nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
})

const cohortUpdateSchema = cohortCreateSchema.partial().extend({
  status: z.enum(['draft', 'open', 'full', 'in_progress', 'completed', 'cancelled']).optional(),
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
  postponedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
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
  records: z.array(
    z.object({
      childId: z.string().min(1),
      status: z.enum(['present', 'absent', 'late']),
    })
  ).min(1),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString()
}

/** Generate session dates from recurring template */
function generateSessionDates(template: RecurringTemplate, cohortStartDate: string): string[] {
  const dates: string[] = []
  const until = new Date(template.repeatUntil + 'T00:00:00Z')
  let current = new Date(cohortStartDate + 'T00:00:00Z')

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
  }
}

async function getSpecialistName(db: admin.firestore.Firestore, uid: string): Promise<string> {
  const snap = await db.doc(`specialists/${uid}`).get()
  const d = snap.data()
  return d?.fullName || d?.name || ''
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
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Admins only' })

      const { orgId } = request.params
      const body = cohortCreateSchema.parse(request.body)
      const now = nowIso()
      const id = randomUUID()

      const { orgName, orgLogoUrl } = await getOrgMeta(db, orgId)
      const instructorName = body.instructorId
        ? await getSpecialistName(db, body.instructorId)
        : null

      const doc: Omit<CohortDoc, 'id'> = {
        orgId,
        title: body.title,
        description: body.description,
        instructorId: body.instructorId ?? null,
        instructorName,
        category: body.category ?? null,
        ageMin: body.ageMin ?? null,
        ageMax: body.ageMax ?? null,
        format: body.format,
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
        orgName,
        orgLogoUrl,
        createdBy: request.user.uid,
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
      }

      await db.doc(COL.cohort(orgId, id)).set(doc)

      // Auto-generate sessions from recurring template
      if (body.scheduleType === 'recurring' && body.recurringTemplate) {
        const dates = generateSessionDates(body.recurringTemplate as RecurringTemplate, body.startDate)
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
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Admins only' })

      const { orgId, cohortId } = request.params
      const ref = db.doc(COL.cohort(orgId, cohortId))
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Cohort not found' })

      const body = cohortUpdateSchema.parse(request.body)
      const updates: Record<string, unknown> = { ...body, updatedAt: nowIso() }

      if (body.status === 'open' && !snap.data()?.publishedAt) {
        updates.publishedAt = nowIso()
      }
      if (body.instructorId) {
        updates.instructorName = await getSpecialistName(db, body.instructorId)
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
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Admins only' })

      const { orgId, cohortId } = request.params
      const ref = db.doc(COL.cohort(orgId, cohortId))
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Cohort not found' })

      await ref.update({ status: 'cancelled', updatedAt: nowIso() })
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
      const snap = await db
        .collection(COL.sessions(orgId, cohortId))
        .orderBy('date', 'asc')
        .orderBy('startTime', 'asc')
        .get()

      const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SessionDoc[]
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
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Admins only' })

      const { orgId, cohortId } = request.params
      const cohortSnap = await db.doc(COL.cohort(orgId, cohortId)).get()
      if (!cohortSnap.exists) return reply.code(404).send({ error: 'Cohort not found' })

      const body = sessionCreateSchema.parse(request.body)
      const now = nowIso()
      const id = randomUUID()
      const cohortData = cohortSnap.data() as CohortDoc

      const doc: Omit<SessionDoc, 'id'> = {
        cohortId,
        orgId,
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        format: body.format ?? cohortData.format,
        meetingUrl: null,
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
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Admins only' })

      const { orgId, cohortId, sessionId } = request.params
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
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Admins only' })

      const { orgId, cohortId, sessionId } = request.params
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
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Admins only' })

      const { orgId, cohortId } = request.params
      const cohortRef = db.doc(COL.cohort(orgId, cohortId))
      const cohortSnap = await cohortRef.get()
      if (!cohortSnap.exists) return reply.code(404).send({ error: 'Cohort not found' })

      const cohortData = cohortSnap.data() as CohortDoc
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
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Admins only' })

      const { orgId, cohortId, participantId } = request.params
      const ref = db.doc(COL.participant(orgId, cohortId, participantId))
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Participant not found' })

      const body = z.object({
        status: z.enum(['active', 'dropped', 'completed']).optional(),
        paymentStatus: z.enum(['paid', 'partial', 'pending']).optional(),
        amountPaid: z.number().min(0).optional(),
        parentPhone: z.string().max(30).nullable().optional(),
      }).parse(request.body)

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
      await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId, sessionId } = request.params
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
        batch.set(
          db.doc(`${COL.attendance(orgId, cohortId, sessionId)}/${record.childId}`),
          doc
        )
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
}
