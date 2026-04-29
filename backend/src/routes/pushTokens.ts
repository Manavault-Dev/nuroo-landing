import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../infrastructure/database/firebase.js'

const registerTokenSchema = z.object({
  token: z
    .string()
    .min(1)
    .refine((t) => t.startsWith('ExponentPushToken'), {
      message: 'Must be a valid Expo push token',
    }),
})

export const pushTokensRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/push/token', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

    const parse = registerTokenSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: 'Invalid token', details: parse.error.issues })
    }

    const db = getFirestore()
    await db.doc(`users/${request.user.uid}`).set(
      {
        pushToken: parse.data.token,
        pushTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    return { ok: true }
  })

  fastify.delete('/api/push/token', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

    const db = getFirestore()
    await db.doc(`users/${request.user.uid}`).set(
      {
        pushToken: admin.firestore.FieldValue.delete(),
        pushTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    return { ok: true }
  })

  fastify.get<{ Querystring: { limit?: string; unreadOnly?: string } }>(
    '/api/notifications',
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const limit = Math.min(parseInt((request.query as any).limit || '50', 10), 100)
      const unreadOnly = (request.query as any).unreadOnly === 'true'

      const db = getFirestore()
      let query = db
        .collection(`users/${request.user.uid}/notifications`)
        .orderBy('createdAt', 'desc')
        .limit(limit)

      if (unreadOnly) {
        query = query.where('read', '==', false) as typeof query
      }

      const snap = await query.get()
      const notifications = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() ?? null,
      }))

      return { notifications }
    }
  )

  fastify.patch<{ Params: { id: string } }>(
    '/api/notifications/:id/read',
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const db = getFirestore()
      const ref = db.doc(`users/${request.user.uid}/notifications/${request.params.id}`)
      await ref.set({ read: true }, { merge: true })

      return { ok: true }
    }
  )

  fastify.patch('/api/notifications/read-all', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

    const db = getFirestore()
    const snap = await db
      .collection(`users/${request.user.uid}/notifications`)
      .where('read', '==', false)
      .get()

    const batch = db.batch()
    snap.docs.forEach((doc) => batch.update(doc.ref, { read: true }))
    await batch.commit()

    return { ok: true, updated: snap.size }
  })
}
