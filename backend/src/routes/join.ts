import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../firebaseAdmin.js'

const COLLECTIONS = {
  ORG_INVITES: 'orgInvites',
  ORGANIZATIONS: 'organizations',
  ORG_MEMBERS: (orgId: string) => `organizations/${orgId}/members`,
  SPECIALISTS: 'specialists',
} as const

const joinSchema = z.object({
  inviteCode: z.string().min(1).max(100),
})

function validateInviteExpiration(expiresAt: admin.firestore.Timestamp | undefined): boolean {
  if (!expiresAt) return true
  return new Date() <= expiresAt.toDate()
}

function validateInviteUsage(usedCount: number, maxUses: number | undefined): boolean {
  if (maxUses === undefined) return true
  return usedCount < maxUses
}

function buildMemberData(role: string, now: Date) {
  return {
    role,
    status: 'active',
    joinedAt: admin.firestore.Timestamp.fromDate(now),
  }
}

function buildSpecialistData(uid: string, email: string | undefined, orgId: string, now: Date) {
  return {
    uid,
    email: email || '',
    name: email?.split('@')[0] || 'Specialist',
    orgId,
    role: 'specialist',
    createdAt: admin.firestore.Timestamp.fromDate(now),
    updatedAt: admin.firestore.Timestamp.fromDate(now),
  }
}

export const joinRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof joinSchema> }>('/join', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid, email } = request.user
    const body = joinSchema.parse(request.body)
    const inviteCode = body.inviteCode.trim()

    const inviteRef = db.doc(`${COLLECTIONS.ORG_INVITES}/${inviteCode}`)
    const inviteSnap = await inviteRef.get()

    if (!inviteSnap.exists) {
      return reply.code(404).send({ error: 'Invalid invite code' })
    }

    const inviteData = inviteSnap.data()!
    const orgId = inviteData.orgId as string
    const role = (inviteData.role as 'specialist' | 'admin') || 'specialist'

    if (!validateInviteExpiration(inviteData.expiresAt)) {
      return reply.code(400).send({ error: 'Invite code has expired' })
    }

    const maxUses = inviteData.maxUses as number | undefined
    const usedCount = (inviteData.usedCount as number) || 0

    if (!validateInviteUsage(usedCount, maxUses)) {
      return reply.code(400).send({
        error: 'Invite code has reached maximum usage',
      })
    }

    const orgRef = db.doc(`${COLLECTIONS.ORGANIZATIONS}/${orgId}`)
    const orgSnap = await orgRef.get()

    if (!orgSnap.exists) {
      return reply.code(404).send({ error: 'Organization not found' })
    }

    const memberRef = db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${uid}`)
    const memberSnap = await memberRef.get()

    if (memberSnap.exists) {
      return { ok: true, orgId }
    }

    const now = new Date()
    await memberRef.set(buildMemberData(role, now))

    const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${uid}`)
    const specialistSnap = await specialistRef.get()

    if (specialistSnap.exists) {
      await specialistRef.update({
        orgId,
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      })
    } else {
      await specialistRef.set(buildSpecialistData(uid, email, orgId, now))
    }

    try {
      await inviteRef.update({ usedCount: usedCount + 1 })
    } catch {
      // Non-critical: ignore count update failure
    }

    return { ok: true, orgId }
  })
}
