import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import { canTransition, buildStatusUpdate, validateBookingInput } from './booking.service.js'
import type { BookingDoc, Slot } from './types.js'

const RATE = { max: 30, timeWindow: '1 minute' }
const RATE_READ = { max: 120, timeWindow: '1 minute' }

const createBookingSchema = z.object({
  specialistId: z.string().trim().min(1),
  serviceId: z.string().trim().min(1).optional().nullable(),
  slotId: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  childId: z.string().trim().min(1).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

const statusUpdateSchema = z.object({
  status: z.enum(['confirmed', 'completed', 'cancelled']),
  cancelReason: z.string().trim().max(500).optional(),
})

function sortBookingsByDateDesc<T extends Pick<BookingDoc, 'date' | 'startTime'>>(
  bookings: T[]
): T[] {
  return [...bookings].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date)
    return dateCompare || b.startTime.localeCompare(a.startTime)
  })
}

/**
 * Read the index from userBookings (to avoid collectionGroup), then fetch fresh
 * data from the canonical location (organizations/.../bookings/...) so status
 * is always up to date without needing mirror sync.
 */
async function listParentBookings(db: FirebaseFirestore.Firestore, parentId: string) {
  const indexSnap = await db.collection(`userBookings/${parentId}/items`).limit(50).get()
  if (indexSnap.empty) return []

  const freshDocs = await Promise.all(
    indexSnap.docs.map(async (d) => {
      const cached = d.data() as BookingDoc
      const orgId = cached.orgId
      if (!orgId) return { id: d.id, ...cached }
      const fresh = await db.doc(`organizations/${orgId}/bookings/${d.id}`).get()
      if (!fresh.exists) return null
      return { id: d.id, ...(fresh.data() as BookingDoc) }
    })
  )

  return sortBookingsByDateDesc(
    freshDocs.filter((b): b is NonNullable<typeof b> => b !== null)
  )
}

export const bookingRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  /**
   * POST /marketplace/organizations/:orgId/bookings
   * Parent creates a booking — atomically claims a slot via Firestore transaction.
   */
  fastify.post<{ Params: { orgId: string } }>(
    '/marketplace/organizations/:orgId/bookings',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId } = request.params
      const parentId = request.user.uid

      const parse = createBookingSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid input', issues: parse.error.issues })
      }

      const { specialistId, serviceId, slotId, date, startTime, endTime, childId, notes } =
        parse.data

      const inputError = validateBookingInput(specialistId, slotId, date)
      if (inputError) return reply.code(400).send({ error: inputError })

      const orgSnap = await db.doc(`organizations/${orgId}`).get()
      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found' })
      }

      // Determine intake status based on service's intake form configuration
      let intakeFormId: string | null = null
      if (serviceId) {
        const svcSnap = await db.doc(`organizations/${orgId}/specialistServices/${serviceId}`).get()
        if (svcSnap.exists) {
          intakeFormId = (svcSnap.data() as { intakeFormId?: string | null }).intakeFormId ?? null
        }
      }
      const intakeStatus = intakeFormId ? 'pending' : 'not_required'

      const now = new Date().toISOString()
      const bookingRef = db.collection(`organizations/${orgId}/bookings`).doc()
      const slotRef = db.doc(`organizations/${orgId}/slots/${slotId}`)

      // Double-booking protection via Firestore transaction
      try {
        await db.runTransaction(async (tx) => {
          const slotSnap = await tx.get(slotRef)

          // If slot doc exists and is already booked — reject
          if (slotSnap.exists && slotSnap.data()?.status === 'booked') {
            throw Object.assign(new Error('Slot already booked'), { code: 'SLOT_TAKEN' })
          }

          // Check for existing booking from this parent for same specialist+date+time
          const conflictSnap = await db
            .collection(`organizations/${orgId}/bookings`)
            .where('parentId', '==', parentId)
            .get()

          const duplicateBooking = conflictSnap.docs.some((doc) => {
            const booking = doc.data() as BookingDoc
            return (
              booking.specialistId === specialistId &&
              booking.date === date &&
              booking.startTime === startTime &&
              ['pending', 'confirmed'].includes(booking.status)
            )
          })

          if (duplicateBooking) {
            throw Object.assign(new Error('Duplicate booking'), { code: 'DUPLICATE_BOOKING' })
          }

          const bookingDoc: BookingDoc = {
            orgId,
            specialistId,
            parentId,
            childId: childId ?? null,
            serviceId: serviceId ?? null,
            slotId,
            date,
            startTime,
            endTime,
            status: 'pending',
            intakeStatus,
            intakeFormId,
            notes: notes ?? null,
            cancelReason: null,
            createdAt: now,
            updatedAt: now,
            confirmedAt: null,
            completedAt: null,
            cancelledAt: null,
          }

          tx.set(bookingRef, bookingDoc)

          // Mirror to userBookings for fast parent-facing queries (no collectionGroup index needed)
          const userBookingRef = db.doc(`userBookings/${parentId}/items/${bookingRef.id}`)
          tx.set(userBookingRef, bookingDoc)

          // Mark slot as booked (upsert)
          const slotDoc: Slot = {
            id: slotId,
            orgId,
            specialistId,
            serviceId: serviceId ?? null,
            date,
            startTime,
            endTime,
            status: 'booked',
            bookingId: bookingRef.id,
            createdAt: now,
          }
          tx.set(slotRef, slotDoc)
        })
      } catch (err: any) {
        if (err.code === 'SLOT_TAKEN')
          return reply.code(409).send({ error: 'This slot is no longer available' })
        if (err.code === 'DUPLICATE_BOOKING')
          return reply.code(409).send({ error: 'You already have a booking at this time' })
        throw err
      }

      return reply.code(201).send({ ok: true, bookingId: bookingRef.id, intakeStatus, intakeFormId })
    }
  )

  /**
   * GET /marketplace/bookings — authenticated parent's own bookings
   * Reads from userBookings/{parentId}/items — no collectionGroup index required.
   */
  fastify.get(
    '/marketplace/bookings',
    { config: { rateLimit: RATE_READ } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const bookings = await listParentBookings(db, request.user.uid)

      return { ok: true, bookings }
    }
  )

  /**
   * GET /marketplace/my/bookings — backwards-compatible parent bookings endpoint.
   */
  fastify.get(
    '/marketplace/my/bookings',
    { config: { rateLimit: RATE_READ } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const bookings = await listParentBookings(db, request.user.uid)

      return { ok: true, bookings }
    }
  )

  /**
   * GET /marketplace/organizations/:orgId/bookings/:bookingId — parent views own booking
   */
  fastify.get<{ Params: { orgId: string; bookingId: string } }>(
    '/marketplace/organizations/:orgId/bookings/:bookingId',
    { config: { rateLimit: RATE_READ } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, bookingId } = request.params

      const snap = await db.doc(`organizations/${orgId}/bookings/${bookingId}`).get()
      if (!snap.exists) return reply.code(404).send({ error: 'Booking not found' })

      const booking = snap.data() as BookingDoc
      if (booking.parentId !== request.user.uid) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      return { ok: true, booking: { id: snap.id, ...booking } }
    }
  )

  /**
   * PUT /marketplace/organizations/:orgId/bookings/:bookingId/cancel — parent cancels
   */
  fastify.put<{ Params: { orgId: string; bookingId: string } }>(
    '/marketplace/organizations/:orgId/bookings/:bookingId/cancel',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, bookingId } = request.params

      const ref = db.doc(`organizations/${orgId}/bookings/${bookingId}`)
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Booking not found' })

      const booking = snap.data() as BookingDoc
      if (booking.parentId !== request.user.uid) return reply.code(403).send({ error: 'Forbidden' })

      if (!canTransition(booking.status, 'cancelled')) {
        return reply
          .code(409)
          .send({ error: `Cannot cancel a booking with status '${booking.status}'` })
      }

      const body = z
        .object({ reason: z.string().trim().max(500).optional() })
        .safeParse(request.body)
      const update = buildStatusUpdate('cancelled', body.data?.reason)

      const parentId = booking.parentId
      await db.runTransaction(async (tx) => {
        tx.update(ref, update)
        const userRef = db.doc(`userBookings/${parentId}/items/${bookingId}`)
        tx.update(userRef, update)
        if (booking.slotId) {
          const slotRef = db.doc(`organizations/${orgId}/slots/${booking.slotId}`)
          tx.update(slotRef, { status: 'available', bookingId: null })
        }
      })

      return { ok: true }
    }
  )

  /**
   * GET /orgs/:orgId/bookings — org admin views all bookings
   */
  fastify.get<{
    Params: { orgId: string }
    Querystring: { status?: string; specialistId?: string; date?: string }
  }>('/orgs/:orgId/bookings', { config: { rateLimit: RATE_READ } }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
    const { orgId } = request.params
    const member = await requireOrgMember(request, reply, orgId)
    if (reply.sent) return
    if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })

    const snap = await db.collection(`organizations/${orgId}/bookings`).limit(250).get()

    const { status, specialistId, date } = request.query as Record<string, string>

    let bookings = snap.docs.map((d) => ({ id: d.id, ...(d.data() as BookingDoc) }))
    if (specialistId) bookings = bookings.filter((b) => b.specialistId === specialistId)
    if (date) bookings = bookings.filter((b) => b.date === date)
    if (status) bookings = bookings.filter((b) => b.status === status)
    bookings = sortBookingsByDateDesc(bookings).slice(0, 100)

    return { ok: true, bookings }
  })

  /**
   * PUT /orgs/:orgId/bookings/:bookingId/status — org admin updates booking status
   */
  fastify.put<{ Params: { orgId: string; bookingId: string } }>(
    '/orgs/:orgId/bookings/:bookingId/status',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, bookingId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })

      const parse = statusUpdateSchema.safeParse(request.body)
      if (!parse.success) return reply.code(400).send({ error: 'Invalid status' })

      const ref = db.doc(`organizations/${orgId}/bookings/${bookingId}`)
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Booking not found' })

      const booking = snap.data() as BookingDoc
      if (!canTransition(booking.status, parse.data.status)) {
        return reply.code(409).send({
          error: `Cannot transition from '${booking.status}' to '${parse.data.status}'`,
        })
      }

      const update = buildStatusUpdate(parse.data.status, parse.data.cancelReason)
      await ref.update(update)

      // Keep userBookings mirror in sync (best-effort — doc may not exist for old bookings)
      await db
        .doc(`userBookings/${booking.parentId}/items/${bookingId}`)
        .update(update)
        .catch(() => {})

      // If cancelling, free the slot
      if (parse.data.status === 'cancelled' && booking.slotId) {
        await db
          .doc(`organizations/${orgId}/slots/${booking.slotId}`)
          .update({ status: 'available', bookingId: null })
          .catch(() => {})
      }

      return { ok: true }
    }
  )
}
