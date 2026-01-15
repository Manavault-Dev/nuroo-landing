import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { getFirestore } from '../firebaseAdmin.js'
import { z } from 'zod'

const joinSchema = z.object({
  inviteCode: z.string().min(1).max(100),
})

export const joinRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof joinSchema> }>('/join', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid, email } = request.user
    const body = joinSchema.parse(request.body)
    const inviteCode = body.inviteCode.trim()

    const inviteRef = db.doc(`orgInvites/${inviteCode}`)
    const inviteSnap = await inviteRef.get()

    if (!inviteSnap.exists) {
      return reply.code(404).send({ error: 'Invalid invite code' })
    }

    const inviteData = inviteSnap.data()!
    const orgId = inviteData.orgId as string
    const role = (inviteData.role as 'specialist' | 'admin') || 'specialist'

    if (inviteData.expiresAt) {
      const expiresAt = inviteData.expiresAt.toDate()
      if (new Date() > expiresAt) {
        return reply.code(400).send({ error: 'Invite code has expired' })
      }
    }

    const maxUses = inviteData.maxUses as number | undefined
    const usedCount = (inviteData.usedCount as number) || 0
    if (maxUses !== undefined && usedCount >= maxUses) {
      return reply.code(400).send({ error: 'Invite code has reached maximum usage' })
    }

    const orgRef = db.doc(`organizations/${orgId}`)
    const orgSnap = await orgRef.get()
    if (!orgSnap.exists) {
      return reply.code(404).send({ error: 'Organization not found' })
    }

    const memberRef = db.doc(`organizations/${orgId}/members/${uid}`)
    const memberSnap = await memberRef.get()
    if (memberSnap.exists) {
      return { ok: true, orgId }
    }

    const now = new Date()
    await memberRef.set({
      role,
      status: 'active',
      joinedAt: admin.firestore.Timestamp.fromDate(now),
    })

    const specialistRef = db.doc(`specialists/${uid}`)
    const specialistSnap = await specialistRef.get()
    if (specialistSnap.exists) {
      await specialistRef.update({
        orgId,
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      })
    } else {
      await specialistRef.set({
        uid,
        email: email || '',
        name: email?.split('@')[0] || 'Specialist',
        orgId,
        role: 'specialist',
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      })
    }

    try {
      await inviteRef.update({ usedCount: usedCount + 1 })
    } catch {}

    return { ok: true, orgId }
  })
}
