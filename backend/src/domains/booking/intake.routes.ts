import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import type {
  BookingDoc,
  IntakeDraftDoc,
  IntakeField,
  IntakeFormDoc,
  IntakeReviewDoc,
  IntakeSection,
  IntakeSubmissionDoc,
} from './types.js'
import {
  NUROO_SECTIONS,
  NUROO_DEFAULT_FIELDS,
  getAllFields,
  validateAnswers,
  buildTemplateSnapshot,
  sortByCreatedAtDesc,
} from './intake.service.js'

const RATE = { max: 60, timeWindow: '1 minute' }
const RATE_DRAFT = { max: 120, timeWindow: '1 minute' }

// ── Routes ────────────────────────────────────────────────────────────────────

const intakeFieldSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).max(300),
  type: z.enum(['text', 'textarea', 'select', 'checkbox']),
  options: z.array(z.string().trim().min(1)).max(20).optional(),
  required: z.boolean(),
})

const intakeSectionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  fields: z.array(intakeFieldSchema).min(1).max(20),
})

const intakeFormSchema = z.object({
  name: z.string().trim().min(1).max(200),
  fields: z.array(intakeFieldSchema).max(50).optional(),
  sections: z.array(intakeSectionSchema).max(15).optional(),
})

const answersSchema = z
  .record(z.union([z.string().max(2000), z.boolean()]))
  .refine((a) => Object.keys(a).length <= 50, { message: 'Too many fields' })

export const intakeRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  // ── Admin: list intake forms ───────────────────────────────────────────────

  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/intake-forms',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })

      const snap = await db
        .collection(`organizations/${orgId}/intakeForms`)
        .where('isActive', '==', true)
        .get()

      return {
        ok: true,
        forms: sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      }
    }
  )

  // ── Admin: create intake form ──────────────────────────────────────────────

  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/intake-forms',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })

      const parse = intakeFormSchema.safeParse(request.body)
      if (!parse.success)
        return reply.code(400).send({ error: 'Invalid form', issues: parse.error.issues })

      const { name, fields = [], sections } = parse.data

      if (!sections && fields.length === 0)
        return reply.code(400).send({ error: 'Provide either fields or sections' })

      const now = new Date().toISOString()
      const doc: IntakeFormDoc = {
        orgId,
        name,
        fields: sections
          ? sections.flatMap((s) => s.fields as IntakeField[])
          : (fields as IntakeField[]),
        sections: sections as IntakeSection[] | undefined,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }

      const ref = db.collection(`organizations/${orgId}/intakeForms`).doc()
      await ref.set(doc)

      return reply.code(201).send({ ok: true, form: { id: ref.id, ...doc } })
    }
  )

  // ── Admin: create default Nuroo template (idempotent) ─────────────────────

  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/default-intake-template',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })

      // Idempotent: return existing default if already present
      const existingSnap = await db
        .collection(`organizations/${orgId}/intakeForms`)
        .where('isDefault', '==', true)
        .limit(1)
        .get()

      if (!existingSnap.empty) {
        const existing = existingSnap.docs[0]
        return { ok: true, created: false, form: { id: existing.id, ...existing.data() } }
      }

      const now = new Date().toISOString()
      const doc: IntakeFormDoc = {
        orgId,
        name: 'Форма Nuroo — подготовка к приёму',
        fields: NUROO_DEFAULT_FIELDS,
        sections: NUROO_SECTIONS,
        isActive: true,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      }

      const ref = db.collection(`organizations/${orgId}/intakeForms`).doc()
      await ref.set(doc)

      return reply.code(201).send({ ok: true, created: true, form: { id: ref.id, ...doc } })
    }
  )

  // ── Public: parent fetches intake form ────────────────────────────────────

  fastify.get<{ Params: { orgId: string; formId: string } }>(
    '/marketplace/organizations/:orgId/intake-forms/:formId',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { orgId, formId } = request.params

      const orgSnap = await db.doc(`organizations/${orgId}`).get()
      if (!orgSnap.exists) return reply.code(404).send({ error: 'Organization not found' })

      const snap = await db.doc(`organizations/${orgId}/intakeForms/${formId}`).get()
      if (!snap.exists || !snap.data()?.isActive)
        return reply.code(404).send({ error: 'Form not found' })

      const data = snap.data() as IntakeFormDoc
      return {
        ok: true,
        form: {
          id: snap.id,
          name: data.name,
          fields: data.fields,
          sections: data.sections ?? null,
        },
      }
    }
  )

  // ── Parent: save draft (autosave) ─────────────────────────────────────────

  fastify.patch<{ Params: { orgId: string; bookingId: string } }>(
    '/marketplace/organizations/:orgId/bookings/:bookingId/intake/draft',
    { config: { rateLimit: RATE_DRAFT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, bookingId } = request.params
      const parentId = request.user.uid

      const bookingSnap = await db.doc(`organizations/${orgId}/bookings/${bookingId}`).get()
      if (!bookingSnap.exists) return reply.code(404).send({ error: 'Booking not found' })

      const booking = bookingSnap.data() as BookingDoc
      if (booking.parentId !== parentId) return reply.code(403).send({ error: 'Forbidden' })
      if (booking.intakeStatus === 'submitted' || booking.intakeStatus === 'reviewed') {
        return reply.code(409).send({ error: 'Intake already submitted' })
      }

      const parse = z
        .object({
          formId: z.string().trim().min(1),
          answers: answersSchema,
        })
        .safeParse(request.body)

      if (!parse.success) return reply.code(400).send({ error: 'Invalid draft payload' })

      const draftDoc: IntakeDraftDoc = {
        bookingId,
        parentId,
        formId: parse.data.formId,
        answers: parse.data.answers,
        updatedAt: new Date().toISOString(),
      }

      await db
        .doc(`organizations/${orgId}/bookings/${bookingId}/intake/draft`)
        .set(draftDoc, { merge: true })

      return { ok: true }
    }
  )

  // ── Parent: get own intake (draft + submission) ───────────────────────────

  fastify.get<{ Params: { orgId: string; bookingId: string } }>(
    '/marketplace/organizations/:orgId/bookings/:bookingId/intake',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, bookingId } = request.params
      const parentId = request.user.uid

      const bookingSnap = await db.doc(`organizations/${orgId}/bookings/${bookingId}`).get()
      if (!bookingSnap.exists) return reply.code(404).send({ error: 'Booking not found' })

      const booking = bookingSnap.data() as BookingDoc
      if (booking.parentId !== parentId) return reply.code(403).send({ error: 'Forbidden' })

      const [submissionSnap, draftSnap] = await Promise.all([
        db.doc(`organizations/${orgId}/bookings/${bookingId}/intake/submission`).get(),
        db.doc(`organizations/${orgId}/bookings/${bookingId}/intake/draft`).get(),
      ])

      return {
        ok: true,
        intakeStatus: booking.intakeStatus,
        intakeFormId: booking.intakeFormId,
        submission: submissionSnap.exists ? (submissionSnap.data() as IntakeSubmissionDoc) : null,
        draft: draftSnap.exists ? (draftSnap.data() as IntakeDraftDoc) : null,
      }
    }
  )

  // ── Parent: submit intake ─────────────────────────────────────────────────

  fastify.post<{ Params: { orgId: string; bookingId: string } }>(
    '/marketplace/organizations/:orgId/bookings/:bookingId/intake',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, bookingId } = request.params
      const parentId = request.user.uid

      const bookingRef = db.doc(`organizations/${orgId}/bookings/${bookingId}`)
      const bookingSnap = await bookingRef.get()
      if (!bookingSnap.exists) return reply.code(404).send({ error: 'Booking not found' })

      const booking = bookingSnap.data() as BookingDoc
      if (booking.parentId !== parentId) return reply.code(403).send({ error: 'Forbidden' })

      // Idempotent: if already submitted, return 200 without overwriting
      if (booking.intakeStatus === 'submitted' || booking.intakeStatus === 'reviewed') {
        return { ok: true, alreadySubmitted: true }
      }

      const parse = z
        .object({
          formId: z.string().trim().min(1),
          answers: answersSchema,
          consentGiven: z.literal(true, { errorMap: () => ({ message: 'Consent is required' }) }),
        })
        .safeParse(request.body)

      if (!parse.success)
        return reply.code(400).send({ error: 'Invalid submission', issues: parse.error.issues })

      // Validate form exists and belongs to this org
      const formSnap = await db.doc(`organizations/${orgId}/intakeForms/${parse.data.formId}`).get()
      if (!formSnap.exists || !formSnap.data()?.isActive)
        return reply.code(404).send({ error: 'Intake form not found' })

      const form = formSnap.data() as IntakeFormDoc
      const allFields = getAllFields(form)

      const validationError = validateAnswers(allFields, parse.data.answers)
      if (validationError) return reply.code(400).send({ error: validationError })

      const now = new Date().toISOString()
      const submissionDoc: IntakeSubmissionDoc = {
        bookingId,
        parentId,
        formId: parse.data.formId,
        templateSnapshot: buildTemplateSnapshot(form),
        answers: parse.data.answers,
        consentGiven: true,
        submittedAt: now,
      }

      const submissionRef = db.doc(`organizations/${orgId}/bookings/${bookingId}/intake/submission`)

      const batch = db.batch()
      batch.set(submissionRef, submissionDoc)
      batch.update(bookingRef, { intakeStatus: 'submitted', updatedAt: now })
      // Mirror status to userBookings
      const userRef = db.doc(`userBookings/${parentId}/items/${bookingId}`)
      batch.update(userRef, { intakeStatus: 'submitted', updatedAt: now })
      // Delete draft on successful submit
      const draftRef = db.doc(`organizations/${orgId}/bookings/${bookingId}/intake/draft`)
      batch.delete(draftRef)
      await batch.commit()

      return reply.code(201).send({ ok: true })
    }
  )

  // ── Specialist/Admin: view submitted intake (client brief) ────────────────

  fastify.get<{ Params: { orgId: string; bookingId: string } }>(
    '/orgs/:orgId/bookings/:bookingId/intake',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, bookingId } = request.params
      const userId = request.user.uid

      // Verify org membership
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return

      // Fetch booking to verify specialist assignment
      const bookingSnap = await db.doc(`organizations/${orgId}/bookings/${bookingId}`).get()
      if (!bookingSnap.exists) return reply.code(404).send({ error: 'Booking not found' })

      const booking = bookingSnap.data() as BookingDoc

      // Only the assigned specialist or org admin may read the intake
      const isAssignedSpecialist = booking.specialistId === userId
      const isAdmin = member.role === 'org_admin'
      if (!isAssignedSpecialist && !isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      const [submissionSnap, reviewSnap] = await Promise.all([
        db.doc(`organizations/${orgId}/bookings/${bookingId}/intake/submission`).get(),
        db.doc(`organizations/${orgId}/bookings/${bookingId}/intake/review`).get(),
      ])

      if (!submissionSnap.exists)
        return reply.code(404).send({ error: 'No intake submission found' })

      return {
        ok: true,
        intakeStatus: booking.intakeStatus,
        intake: submissionSnap.data() as IntakeSubmissionDoc,
        review: reviewSnap.exists ? (reviewSnap.data() as IntakeReviewDoc) : null,
      }
    }
  )

  // ── Specialist/Admin: mark intake as reviewed ─────────────────────────────

  fastify.post<{ Params: { orgId: string; bookingId: string } }>(
    '/orgs/:orgId/bookings/:bookingId/intake/reviewed',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, bookingId } = request.params
      const userId = request.user.uid

      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return

      const bookingRef = db.doc(`organizations/${orgId}/bookings/${bookingId}`)
      const bookingSnap = await bookingRef.get()
      if (!bookingSnap.exists) return reply.code(404).send({ error: 'Booking not found' })

      const booking = bookingSnap.data() as BookingDoc

      const isAssignedSpecialist = booking.specialistId === userId
      const isAdmin = member.role === 'org_admin'
      if (!isAssignedSpecialist && !isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      if (booking.intakeStatus !== 'submitted') {
        return reply.code(409).send({ error: 'Intake must be submitted before it can be reviewed' })
      }

      const now = new Date().toISOString()
      const reviewDoc: IntakeReviewDoc = { reviewedAt: now, reviewedBy: userId }

      const batch = db.batch()
      batch.set(db.doc(`organizations/${orgId}/bookings/${bookingId}/intake/review`), reviewDoc)
      batch.update(bookingRef, { intakeStatus: 'reviewed', updatedAt: now })
      await batch.commit()

      return { ok: true }
    }
  )
}
