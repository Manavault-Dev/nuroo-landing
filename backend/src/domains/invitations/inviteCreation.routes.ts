import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { randomInt } from 'crypto'
import { z } from 'zod'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../plugins/rbac.js'

const createInviteSchema = z.object({
  role: z.enum(['specialist', 'org_admin', 'admin']).default('specialist'),
  maxUses: z.number().min(1).max(1000).optional(),
  expiresInDays: z.number().min(1).max(365).default(30),
})

export const inviteCreationRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof createInviteSchema> }>(
    '/orgs/:orgId/invites',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const db = getFirestore()
      const { orgId } = request.params
      const { uid } = request.user

      const member = await requireOrgMember(request, reply, orgId)

      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only organization admins can create invite codes' })
      }

      const body = createInviteSchema.parse(request.body)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let inviteCode = ''
      for (let i = 0; i < 8; i++) {
        inviteCode += chars.charAt(randomInt(0, chars.length))
      }

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + body.expiresInDays)

      const normalizedRole = body.role === 'admin' ? 'org_admin' : body.role

      const inviteRef = db.doc(`invites/${inviteCode}`)
      await inviteRef.set({
        orgId,
        role: normalizedRole,
        isActive: true,
        maxUses: body.maxUses || null,
        usedCount: 0,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdBy: uid,
        createdAt: admin.firestore.Timestamp.fromDate(new Date()),
      })

      return {
        ok: true,
        inviteCode,
        expiresAt: expiresAt.toISOString(),
        role: normalizedRole,
        maxUses: body.maxUses || null,
      }
    }
  )

  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/parent-invites',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      try {
        const db = getFirestore()
        const { orgId } = request.params
        const { uid } = request.user

        const member = await requireOrgMember(request, reply, orgId)

        if (member.role !== 'specialist' && member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only specialists can create parent invite codes' })
        }

        const now = new Date()

        const parentInviteChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let inviteCode = ''
        for (let i = 0; i < 8; i++) {
          inviteCode += parentInviteChars.charAt(randomInt(0, parentInviteChars.length))
        }
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 365)

        const inviteRef = db.doc(`parentInvites/${inviteCode}`)
        await inviteRef.set({
          specialistId: uid,
          orgId,
          maxUses: null,
          usedCount: 0,
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          createdAt: admin.firestore.Timestamp.fromDate(now),
        })

        return {
          ok: true,
          inviteCode,
          expiresAt: expiresAt.toISOString(),
          orgId,
        }
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Route handler failed')
        return reply.code(500).send({ error: error.message || 'Failed to create invite code' })
      }
    }
  )

  fastify.post('/specialists/invites', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()
      const { uid, email } = request.user

      const specialistRef = db.doc(`specialists/${uid}`)
      const specialistSnap = await specialistRef.get()

      const now = new Date()
      let specialistName = email?.split('@')[0] || 'Specialist'
      if (specialistSnap.exists) {
        specialistName = specialistSnap.data()?.name || specialistName
      } else {
        await specialistRef.set({
          uid,
          email: email || '',
          name: specialistName,
          createdAt: admin.firestore.Timestamp.fromDate(now),
          updatedAt: admin.firestore.Timestamp.fromDate(now),
        })
      }
      const orgsSnapshot = await db
        .collection('organizations')
        .where('ownerId', '==', uid)
        .limit(1)
        .get()

      let personalOrgId: string
      if (orgsSnapshot.empty) {
        const personalOrgName = `${specialistName}'s Practice`
        const orgRef = db.collection('organizations').doc()
        personalOrgId = orgRef.id

        await orgRef.set({
          name: personalOrgName,
          type: 'personal',
          ownerId: uid,
          createdAt: admin.firestore.Timestamp.fromDate(now),
          updatedAt: admin.firestore.Timestamp.fromDate(now),
        })

        const memberRef = orgRef.collection('members').doc(uid)
        await memberRef.set({
          uid,
          role: 'org_admin',
          status: 'active',
          joinedAt: admin.firestore.Timestamp.fromDate(now),
        })

        await specialistRef
          .collection('organizations')
          .doc(personalOrgId)
          .set({
            orgId: personalOrgId,
            orgName: personalOrgName,
            country: null,
            role: 'org_admin',
            status: 'active',
            updatedAt: admin.firestore.Timestamp.fromDate(now),
          })
      } else {
        personalOrgId = orgsSnapshot.docs[0].id
        await specialistRef
          .collection('organizations')
          .doc(personalOrgId)
          .set(
            {
              orgId: personalOrgId,
              orgName: orgsSnapshot.docs[0].data().name || personalOrgId,
              country: orgsSnapshot.docs[0].data().country ?? null,
              role: 'org_admin',
              status: 'active',
              updatedAt: admin.firestore.Timestamp.fromDate(now),
            },
            { merge: true }
          )
      }

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let inviteCode = ''
      for (let i = 0; i < 8; i++) {
        inviteCode += chars.charAt(randomInt(0, chars.length))
      }
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 365)

      const inviteRef = db.doc(`parentInvites/${inviteCode}`)
      await inviteRef.set({
        specialistId: uid,
        orgId: personalOrgId,
        maxUses: null,
        usedCount: 0,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: admin.firestore.Timestamp.fromDate(now),
      })

      return {
        ok: true,
        inviteCode,
        expiresAt: expiresAt.toISOString(),
        orgId: personalOrgId,
      }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({ error: error.message || 'Failed to create invite code' })
    }
  })
}
