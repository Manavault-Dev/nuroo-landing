/**
 * Reschedule + Quick-rebook routes for bookings.
 *
 * PUT  /marketplace/organizations/:orgId/bookings/:bookingId/reschedule
 *   → Atomically frees old slot, claims new slot, updates booking fields.
 *   → Accessible by the parent owner OR an org_admin.
 *
 * POST /marketplace/organizations/:orgId/bookings/:bookingId/rebook
 *   → Creates a fresh booking copying specialistId/serviceId from the original.
 *   → Caller provides new slotId/date/time.
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import { timesOverlap, validateBookingInput } from './booking.service.js'
import type { BookingDoc, Slot } from './types.js'
import { writeAudit } from '../../infrastructure/audit/audit.js'

const RATE = { max: 30, timeWindow: '1 minute' }

const rescheduleSchema = z.object({
  slotId: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(500).optional(),
})

const rebookSchema = z.object({
  slotId: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  childId: z.string().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export const bookingRescheduleRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  /**
   * PUT /marketplace/organizations/:orgId/bookings/:bookingId/reschedule
   * Parent (or org_admin) reschedules a booking to a new slot.
   * Atomically: frees old slot, claims new slot, updates booking.
   */
  fastify.put<{ Params: { orgId: string; bookingId: string } }>(
    '/marketplace/organizations/:orgId/bookings/:bookingId/reschedule',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, bookingId } = request.params
      const actorId = request.user.uid

      const parse = rescheduleSchema.safeParse(request.body)
      if (!parse.success)
        return reply.code(400).send({ error: 'Invalid input', issues: parse.error.issues })

      const { slotId: newSlotId, date, startTime, endTime, reason } = parse.data

      const bookingRef = db.doc(`organizations/${orgId}/bookings/${bookingId}`)
      const newSlotRef = db.doc(`organizations/${orgId}/slots/${newSlotId}`)

      const bookingSnap = await bookingRef.get()
      if (!bookingSnap.exists) return reply.code(404).send({ error: 'Booking not found' })

      const booking = bookingSnap.data() as BookingDoc

      // Only parent or org_admin can reschedule
      const isOwner = booking.parentId === actorId
      if (!isOwner) {
        const member = await requireOrgMember(request, reply, orgId)
        if (reply.sent) return
        if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })
      }

      if (!['pending', 'confirmed'].includes(booking.status)) {
        return reply
          .code(409)
          .send({ error: `Cannot reschedule a booking with status '${booking.status}'` })
      }

      const now = new Date().toISOString()

      try {
        await db.runTransaction(async (tx) => {
          const newSlotSnap = await tx.get(newSlotRef)

          if (newSlotSnap.exists && newSlotSnap.data()?.status === 'booked') {
            throw Object.assign(new Error('Slot already booked'), { code: 'SLOT_TAKEN' })
          }

          // Check for other conflicting bookings for this parent on the new date
          const conflictSnap = await db
            .collection(`organizations/${orgId}/bookings`)
            .where('parentId', '==', booking.parentId)
            .where('date', '==', date)
            .get()

          const hasConflict = conflictSnap.docs.some((doc) => {
            if (doc.id === bookingId) return false
            const b = doc.data() as BookingDoc
            return (
              b.specialistId === booking.specialistId &&
              ['pending', 'confirmed'].includes(b.status) &&
              timesOverlap(startTime, endTime, b.startTime, b.endTime)
            )
          })

          if (hasConflict) {
            throw Object.assign(new Error('Time conflict'), { code: 'TIME_CONFLICT' })
          }

          const update: Partial<BookingDoc> = {
            slotId: newSlotId,
            date,
            startTime,
            endTime,
            rescheduledAt: now,
            rescheduledFrom: booking.slotId,
            rescheduledFromDate: booking.date,
            rescheduledFromTime: booking.startTime,
            rescheduledBy: actorId,
            updatedAt: now,
          }

          tx.update(bookingRef, update)
          tx.update(db.doc(`userBookings/${booking.parentId}/items/${bookingId}`), update)

          // Free old slot
          if (booking.slotId) {
            tx.update(db.doc(`organizations/${orgId}/slots/${booking.slotId}`), {
              status: 'available',
              bookingId: null,
            })
          }

          // Claim new slot
          const newSlotData: Slot = {
            id: newSlotId,
            orgId,
            specialistId: booking.specialistId,
            serviceId: booking.serviceId,
            date,
            startTime,
            endTime,
            status: 'booked',
            bookingId,
            createdAt: now,
          }
          tx.set(newSlotRef, newSlotData)
        })
      } catch (err: any) {
        if (err.code === 'SLOT_TAKEN')
          return reply.code(409).send({ error: 'This slot is no longer available' })
        if (err.code === 'TIME_CONFLICT')
          return reply.code(409).send({ error: 'You already have a booking at this time' })
        throw err
      }

      writeAudit({
        db,
        orgId,
        entityType: 'booking',
        entityId: bookingId,
        action: 'booking.rescheduled',
        actorId,
        actorRole: isOwner ? 'parent' : 'org_admin',
        before: { date: booking.date, startTime: booking.startTime, slotId: booking.slotId },
        after: { date, startTime, slotId: newSlotId },
        reason: reason ?? null,
      })

      return { ok: true }
    }
  )

  /**
   * POST /marketplace/organizations/:orgId/bookings/:bookingId/rebook
   * Quick rebook — creates a new booking for the same specialist + service.
   * Caller provides a new slotId/date/time (pre-selected from availability).
   */
  fastify.post<{ Params: { orgId: string; bookingId: string } }>(
    '/marketplace/organizations/:orgId/bookings/:bookingId/rebook',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, bookingId } = request.params
      const parentId = request.user.uid

      const originalSnap = await db.doc(`organizations/${orgId}/bookings/${bookingId}`).get()
      if (!originalSnap.exists) return reply.code(404).send({ error: 'Original booking not found' })

      const original = originalSnap.data() as BookingDoc
      if (original.parentId !== parentId) return reply.code(403).send({ error: 'Forbidden' })

      const parse = rebookSchema.safeParse(request.body)
      if (!parse.success)
        return reply.code(400).send({ error: 'Invalid input', issues: parse.error.issues })

      const { slotId, date, startTime, endTime, childId, notes } = parse.data

      const inputError = validateBookingInput(original.specialistId, slotId, date)
      if (inputError) return reply.code(400).send({ error: inputError })

      const now = new Date().toISOString()
      const newRef = db.collection(`organizations/${orgId}/bookings`).doc()
      const slotRef = db.doc(`organizations/${orgId}/slots/${slotId}`)

      try {
        await db.runTransaction(async (tx) => {
          const slotSnap = await tx.get(slotRef)
          if (slotSnap.exists && slotSnap.data()?.status === 'booked') {
            throw Object.assign(new Error('Slot taken'), { code: 'SLOT_TAKEN' })
          }

          const intakeStatus = original.intakeFormId ? 'pending' : 'not_required'

          const newDoc: BookingDoc = {
            orgId,
            specialistId: original.specialistId,
            parentId,
            childId: childId ?? original.childId,
            serviceId: original.serviceId,
            slotId,
            date,
            startTime,
            endTime,
            status: 'pending',
            intakeStatus,
            intakeFormId: original.intakeFormId,
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

          tx.set(newRef, newDoc)
          tx.set(db.doc(`userBookings/${parentId}/items/${newRef.id}`), newDoc)
          tx.set(slotRef, {
            id: slotId,
            orgId,
            specialistId: original.specialistId,
            serviceId: original.serviceId,
            date,
            startTime,
            endTime,
            status: 'booked',
            bookingId: newRef.id,
            createdAt: now,
          } satisfies Slot)
        })
      } catch (err: any) {
        if (err.code === 'SLOT_TAKEN')
          return reply.code(409).send({ error: 'This slot is no longer available' })
        throw err
      }

      return reply.code(201).send({ ok: true, bookingId: newRef.id })
    }
  )
}
