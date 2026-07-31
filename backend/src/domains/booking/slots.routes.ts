import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { generateSlotsForRange } from './booking.service.js'
import type { AvailabilityTemplate, BlockedPeriod, Slot } from './types.js'

const RATE_PUBLIC = { max: 120, timeWindow: '1 minute' }

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  days: z.string().optional(),
  serviceId: z.string().optional(),
})

export const slotsRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  /**
   * GET /marketplace/organizations/:orgId/specialists/:specialistId/slots
   * Returns available slots (generated from availability template, minus booked ones)
   */
  fastify.get<{
    Params: { orgId: string; specialistId: string }
    Querystring: { date?: string; days?: string; serviceId?: string }
  }>(
    '/marketplace/organizations/:orgId/specialists/:specialistId/slots',
    { config: { rateLimit: RATE_PUBLIC } },
    async (request, reply) => {
      const { orgId, specialistId } = request.params

      const orgSnap = await db.doc(`organizations/${orgId}`).get()
      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found' })
      }

      const queryParse = querySchema.safeParse(request.query)
      if (!queryParse.success) return reply.code(400).send({ error: 'Invalid query' })

      const startDate = queryParse.data.date ?? new Date().toISOString().split('T')[0]
      const days = Math.min(Number(queryParse.data.days ?? 7), 30)
      const serviceId = queryParse.data.serviceId ?? null

      // Load availability template
      const availSnap = await db
        .doc(`organizations/${orgId}/specialistAvailability/${specialistId}`)
        .get()

      if (!availSnap.exists) {
        return { ok: true, slots: [] }
      }

      const template = availSnap.data() as AvailabilityTemplate
      const generated = generateSlotsForRange(template, startDate, days, serviceId)

      // Load already booked slots for this range to filter them out
      const endDate = new Date(startDate + 'T00:00:00Z')
      endDate.setUTCDate(endDate.getUTCDate() + days)
      const endDateStr = endDate.toISOString().split('T')[0]

      const bookedSnap = await db
        .collection(`organizations/${orgId}/slots`)
        .where('date', '>=', startDate)
        .where('date', '<', endDateStr)
        .get()

      const bookedKeys = new Set(
        bookedSnap.docs
          .map((d) => d.data() as Slot)
          .filter((slot) => slot.specialistId === specialistId && slot.status === 'booked')
          .map((slot) => `${slot.date}|${slot.startTime}`)
      )

      // Load blocked periods for this specialist (single-equality query — no composite index needed)
      // and filter the date range in JS to avoid requiring a Firestore composite index.
      let blocks: BlockedPeriod[] = []
      try {
        const blockedSnap = await db
          .collection(`organizations/${orgId}/specialistBlocking`)
          .where('specialistId', '==', specialistId)
          .get()

        blocks = blockedSnap.docs
          .map((d) => d.data() as BlockedPeriod)
          .filter((b) => b.endDate >= startDate && b.startDate <= endDateStr)
      } catch {
        // Non-fatal: if blocking query fails, serve slots without blocking applied
        blocks = []
      }

      const isBlocked = (date: string, startTime: string, endTime: string): boolean => {
        for (const b of blocks) {
          if (date < b.startDate || date > b.endDate) continue
          // Full-day block
          if (!b.startTime || !b.endTime) return true
          // Time-range block — blocked if slot overlaps the block window
          if (startTime < b.endTime && endTime > b.startTime) return true
        }
        return false
      }

      const available = generated.filter(
        (s) => !bookedKeys.has(`${s.date}|${s.startTime}`) && !isBlocked(s.date, s.startTime, s.endTime)
      )

      return {
        ok: true,
        slots: available.map((s) => ({
          id: `${specialistId}|${s.date}|${s.startTime}`,
          ...s,
          status: 'available',
        })),
      }
    }
  )
}
