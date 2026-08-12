import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import { canTransition, buildStatusUpdate, validateBookingInput } from './booking.service.js'
import type { BookingDoc, Slot } from './types.js'
import { eventDispatcher } from '../../modules/notifications/event.dispatcher.js'
import { writeAudit } from '../../infrastructure/audit/audit.js'

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
  status: z.enum(['confirmed', 'completed', 'cancelled', 'no_show']),
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

// Reads from userBookings index, then fetches fresh canonical data to avoid stale status
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

  return sortBookingsByDateDesc(freshDocs.filter((b): b is NonNullable<typeof b> => b !== null))
}

export const bookingRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  // POST /marketplace/organizations/:orgId/bookings — parent creates a booking
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
      if (!orgSnap.exists) return reply.code(404).send({ error: 'Organization not found' })

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

      try {
        await db.runTransaction(async (tx) => {
          const slotSnap = await tx.get(slotRef)

          if (slotSnap.exists && slotSnap.data()?.status === 'booked') {
            throw Object.assign(new Error('Slot already booked'), { code: 'SLOT_TAKEN' })
          }

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
            attendanceStatus: null,
            rescheduledAt: null,
            rescheduledFrom: null,
            rescheduledFromDate: null,
            rescheduledFromTime: null,
            rescheduledBy: null,
            createdAt: now,
            updatedAt: now,
            confirmedAt: null,
            completedAt: null,
            cancelledAt: null,
            noShowAt: null,
          }

          tx.set(bookingRef, bookingDoc)
          // Mirror to userBookings for fast parent-facing queries
          tx.set(db.doc(`userBookings/${parentId}/items/${bookingRef.id}`), bookingDoc)
          // Mark slot as booked
          tx.set(slotRef, {
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
          } as Slot)
        })
      } catch (err: any) {
        if (err.code === 'SLOT_TAKEN')
          return reply.code(409).send({ error: 'This slot is no longer available' })
        if (err.code === 'DUPLICATE_BOOKING')
          return reply.code(409).send({ error: 'You already have a booking at this time' })
        throw err
      }

      // Fire push + email notification in background — non-blocking
      const orgData = orgSnap.data() as { name?: string } | undefined
      const parentUser = request.user
      void (async () => {
        try {
          const [specialistSnap, parentSnap] = await Promise.all([
            db.doc(`users/${specialistId}`).get(),
            db.doc(`users/${parentId}`).get(),
          ])
          const specialistName: string =
            (specialistSnap.data() as { fullName?: string } | undefined)?.fullName ?? 'Специалист'
          const parentEmail: string =
            (parentSnap.data() as { email?: string } | undefined)?.email ?? parentUser?.email ?? ''
          const parentName: string =
            (parentSnap.data() as { fullName?: string } | undefined)?.fullName ?? 'Родитель'

          console.log(`[Booking] Sending booking_confirmed email to: "${parentEmail}"`)
          if (parentEmail) {
            eventDispatcher.dispatch({
              type: 'booking_confirmed',
              bookingId: bookingRef.id,
              orgId,
              orgName: orgData?.name ?? orgId,
              parentId,
              parentName,
              parentEmail,
              specialistName,
              date,
              startTime,
              endTime,
            })
          }
        } catch (err) {
          console.error('[Booking] Notification dispatch failed:', err)
        }
      })()

      return reply
        .code(201)
        .send({ ok: true, bookingId: bookingRef.id, intakeStatus, intakeFormId })
    }
  )

  // GET /marketplace/bookings — parent's own bookings
  fastify.get(
    '/marketplace/bookings',
    { config: { rateLimit: RATE_READ } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const bookings = await listParentBookings(db, request.user.uid)
      return { ok: true, bookings }
    }
  )

  // GET /marketplace/my/bookings — backwards-compatible alias
  fastify.get(
    '/marketplace/my/bookings',
    { config: { rateLimit: RATE_READ } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const bookings = await listParentBookings(db, request.user.uid)
      return { ok: true, bookings }
    }
  )

  // GET /marketplace/organizations/:orgId/bookings/:bookingId — parent views own booking
  fastify.get<{ Params: { orgId: string; bookingId: string } }>(
    '/marketplace/organizations/:orgId/bookings/:bookingId',
    { config: { rateLimit: RATE_READ } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, bookingId } = request.params

      const snap = await db.doc(`organizations/${orgId}/bookings/${bookingId}`).get()
      if (!snap.exists) return reply.code(404).send({ error: 'Booking not found' })

      const booking = snap.data() as BookingDoc
      if (booking.parentId !== request.user.uid) return reply.code(403).send({ error: 'Forbidden' })

      return { ok: true, booking: { id: snap.id, ...booking } }
    }
  )

  // PUT /marketplace/organizations/:orgId/bookings/:bookingId/cancel — parent cancels
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
        tx.update(db.doc(`userBookings/${parentId}/items/${bookingId}`), update)
        if (booking.slotId) {
          tx.update(db.doc(`organizations/${orgId}/slots/${booking.slotId}`), {
            status: 'available',
            bookingId: null,
          })
        }
      })

      writeAudit({
        db,
        orgId,
        entityType: 'booking',
        entityId: bookingId,
        action: 'booking.cancelled',
        actorId: request.user.uid,
        actorRole: 'parent',
        before: { status: booking.status },
        after: { status: 'cancelled' },
        reason: body.data?.reason ?? null,
      })

      // Notify parent of cancellation (fire-and-forget)
      void (async () => {
        try {
          const [parentSnap, specialistSnap] = await Promise.all([
            db.doc(`users/${parentId}`).get(),
            db.doc(`users/${booking.specialistId}`).get(),
          ])
          const parentEmail: string =
            (parentSnap.data() as { email?: string } | undefined)?.email ??
            request.user?.email ??
            ''
          const parentName: string =
            (parentSnap.data() as { fullName?: string } | undefined)?.fullName ?? 'Родитель'
          const specialistName: string =
            (specialistSnap.data() as { fullName?: string } | undefined)?.fullName ?? 'Специалист'
          eventDispatcher.dispatch({
            type: 'booking_cancelled',
            bookingId,
            orgId,
            parentId,
            parentName,
            parentEmail,
            specialistName,
            date: booking.date,
            startTime: booking.startTime,
            reason: body.data?.reason ?? null,
          })
        } catch (err) {
          console.error('[Booking] Cancellation notification failed:', err)
        }
      })()

      return { ok: true }
    }
  )

  // GET /orgs/:orgId/bookings — org admin views all bookings
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

  // PUT /orgs/:orgId/bookings/:bookingId/status — org admin updates booking status
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

      // Keep userBookings mirror in sync (best-effort)
      await db
        .doc(`userBookings/${booking.parentId}/items/${bookingId}`)
        .update(update)
        .catch(() => {})

      // Free the slot on cancellation or no-show
      if (
        (parse.data.status === 'cancelled' || parse.data.status === 'no_show') &&
        booking.slotId
      ) {
        await db
          .doc(`organizations/${orgId}/slots/${booking.slotId}`)
          .update({ status: 'available', bookingId: null })
          .catch(() => {})
      }

      writeAudit({
        db,
        orgId,
        entityType: 'booking',
        entityId: bookingId,
        action: `booking.${parse.data.status}` as any,
        actorId: request.user.uid,
        actorRole: 'org_admin',
        before: { status: booking.status },
        after: { status: parse.data.status },
        reason: parse.data.cancelReason ?? null,
      })

      return { ok: true }
    }
  )
}
