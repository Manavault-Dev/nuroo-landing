import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../firebaseAdmin.js'

const COLLECTIONS = {
  INVITES: 'invites',
  ORGANIZATIONS: 'organizations',
  ORG_MEMBERS: (orgId: string) => `organizations/${orgId}/members`,
  SPECIALISTS: 'specialists',
} as const

const acceptInviteSchema = z.object({
  code: z.string().min(1).max(20),
})

function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase()
}

function validateInviteActive(isActive: boolean | undefined): boolean {
  return isActive !== false
}

function validateInviteExpiration(expiresAt: admin.firestore.Timestamp | undefined): boolean {
  if (!expiresAt) return true
  return new Date() <= expiresAt.toDate()
}

function validateInviteUsage(usedCount: number, maxUses: number | undefined): boolean {
  if (!maxUses) return true
  return usedCount < maxUses
}

function normalizeRole(role: string): 'org_admin' | 'specialist' {
  return role === 'org_admin' ? 'org_admin' : 'specialist'
}

function buildMemberData(role: string, now: Date) {
  return {
    role: normalizeRole(role),
    status: 'active',
    joinedAt: admin.firestore.Timestamp.fromDate(now),
  }
}

function buildSpecialistData(
  uid: string,
  email: string | undefined,
  orgId: string,
  role: string,
  now: Date
) {
  return {
    uid,
    email: email || '',
    fullName: email?.split('@')[0] || 'Specialist',
    orgId,
    role: normalizeRole(role),
    createdAt: admin.firestore.Timestamp.fromDate(now),
    updatedAt: admin.firestore.Timestamp.fromDate(now),
  }
}

export const invitesAcceptRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof acceptInviteSchema> }>(
    '/invites/accept',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const db = getFirestore()
      const { uid, email } = request.user
      const body = acceptInviteSchema.parse(request.body)
      const code = normalizeInviteCode(body.code)
      const now = new Date()

      const inviteRef = db.doc(`${COLLECTIONS.INVITES}/${code}`)
      const inviteSnap = await inviteRef.get()

      if (!inviteSnap.exists) {
        return reply.code(404).send({ error: 'Invalid invite code' })
      }

      const inviteData = inviteSnap.data()!

      if (!validateInviteActive(inviteData.isActive)) {
        return reply.code(400).send({
          error: 'Invite code is no longer active',
        })
      }

      if (!validateInviteExpiration(inviteData.expiresAt)) {
        return reply.code(400).send({ error: 'Invite code has expired' })
      }

      if (!validateInviteUsage(inviteData.usedCount || 0, inviteData.maxUses)) {
        return reply.code(400).send({
          error: 'Invite code has reached maximum uses',
        })
      }

      const { orgId, role } = inviteData

      const orgRef = db.doc(`${COLLECTIONS.ORGANIZATIONS}/${orgId}`)
      const orgSnap = await orgRef.get()

      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found' })
      }

      const orgData = orgSnap.data()!

      if (!orgData.isActive) {
        return reply.code(400).send({ error: 'Organization is not active' })
      }

      const memberRef = db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${uid}`)
      const memberSnap = await memberRef.get()

      if (memberSnap.exists) {
        const memberData = memberSnap.data()!
        if (memberData.status === 'active') {
          return {
            ok: true,
            orgId,
            role: memberData.role,
            message: 'Already a member of this organization',
          }
        }
      }

      if (role === 'org_admin' || role === 'specialist') {
        await memberRef.set(buildMemberData(role, now))

        const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${uid}`)
        const specialistSnap = await specialistRef.get()

        if (specialistSnap.exists) {
          await specialistRef.update({
            orgId,
            role: normalizeRole(role),
            updatedAt: admin.firestore.Timestamp.fromDate(now),
          })
        } else {
          await specialistRef.set(buildSpecialistData(uid, email, orgId, role, now))
        }
      } else if (role === 'parent') {
        return reply.code(400).send({
          error:
            'Parent invites cannot be accepted through this endpoint. Parents are contact-only and do not authenticate. Please contact your organization admin to add parent contacts.',
        })
      } else {
        return reply.code(400).send({ error: 'Invalid role in invite' })
      }

      await inviteRef.update({
        usedCount: admin.firestore.FieldValue.increment(1),
      })

      return {
        ok: true,
        orgId,
        role,
        orgName: orgData.name,
      }
    }
  )
}
