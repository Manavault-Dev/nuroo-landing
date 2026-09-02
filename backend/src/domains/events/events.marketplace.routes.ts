import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import type { EventDoc, PublicEvent } from './events.types.js'

const RATE = { max: 120, timeWindow: '1 minute' }

function toPublic(doc: EventDoc): PublicEvent {
  const spotsLeft =
    doc.spotsTotal === 0 ? Infinity : Math.max(0, doc.spotsTotal - doc.registeredCount)
  return {
    id: doc.id,
    orgId: doc.orgId,
    orgName: doc.orgName,
    orgLogoUrl: doc.orgLogoUrl,
    title: doc.title,
    description: doc.description,
    coverUrl: doc.coverUrl,
    date: doc.date,
    endDate: doc.endDate,
    location: doc.location,
    city: doc.city,
    format: doc.format,
    price: doc.price,
    currency: doc.currency,
    spotsTotal: doc.spotsTotal,
    spotsLeft: doc.spotsTotal === 0 ? 999 : spotsLeft,
    registeredCount: doc.registeredCount,
    category: doc.category,
    ageMin: doc.ageMin,
    ageMax: doc.ageMax,
  }
}

let _cache: { data: PublicEvent[]; expiresAt: number } | null = null

async function getCachedEvents(db: ReturnType<typeof getFirestore>): Promise<PublicEvent[]> {
  if (_cache && Date.now() < _cache.expiresAt) return _cache.data

  const now = new Date().toISOString()
  const snap = await db.collection('events').where('status', '==', 'published').limit(200).get()

  const data = snap.docs
    .map((d) => toPublic({ id: d.id, ...d.data() } as EventDoc))
    .filter((e) => e.date >= now)
    .sort((a, b) => (a.date > b.date ? 1 : -1))
  _cache = { data, expiresAt: Date.now() + 60_000 }
  return data
}

export const eventsMarketplaceRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  fastify.get('/marketplace/events', { config: { rateLimit: RATE } }, async (request, reply) => {
    const query = z
      .object({
        category: z.string().optional(),
        format: z.enum(['online', 'offline', 'hybrid']).optional(),
        city: z.string().optional(),
        free: z.enum(['true', 'false']).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(24),
      })
      .parse(request.query)

    let events = await getCachedEvents(db)

    if (query.category) events = events.filter((e) => e.category === query.category)
    if (query.format) events = events.filter((e) => e.format === query.format)
    if (query.city)
      events = events.filter((e) => e.city?.toLowerCase() === query.city!.toLowerCase())
    if (query.free === 'true') events = events.filter((e) => e.price === 0)
    events = events.slice(0, query.limit)

    reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
    return { ok: true, events }
  })

  fastify.post<{ Params: { eventId: string } }>(
    '/marketplace/events/:eventId/register',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { eventId } = request.params
      const eventRef = db.doc(`events/${eventId}`)
      const snap = await eventRef.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Event not found' })

      const event = { id: snap.id, ...snap.data() } as EventDoc
      if (event.status !== 'published')
        return reply.code(409).send({ error: 'Event not available' })
      if (new Date(event.date) < new Date())
        return reply.code(409).send({ error: 'Event has passed' })

      const registrationRef = db.doc(`events/${eventId}/registrations/${request.user.uid}`)
      const existing = await registrationRef.get()
      if (existing.exists) return reply.code(409).send({ error: 'Already registered' })

      if (event.spotsTotal > 0 && event.registeredCount >= event.spotsTotal) {
        return reply.code(409).send({ error: 'Event is full' })
      }

      const now = new Date().toISOString()
      const { FieldValue } = (await import('firebase-admin')).default.firestore

      // Fetch user profile for extra fields (phone, displayName)
      const profileSnap = await db.doc(`users/${request.user.uid}`).get()
      const profile = profileSnap.data() ?? {}

      await db.runTransaction(async (tx) => {
        tx.set(registrationRef, {
          uid: request.user!.uid,
          email: request.user!.email ?? profile.email ?? null,
          displayName: request.user!.displayName ?? profile.displayName ?? profile.name ?? null,
          phone: profile.phone ?? profile.phoneNumber ?? null,
          registeredAt: now,
        })
        tx.update(eventRef, {
          registeredCount: FieldValue.increment(1),
          updatedAt: now,
        })
      })

      _cache = null

      return reply.code(201).send({ ok: true })
    }
  )
}
