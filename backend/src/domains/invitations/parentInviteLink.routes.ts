import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { checkOrgCanAddChild } from '../../modules/payments/planLimits.js'
import { registeredChildDisplayName } from './invitations.helpers.js'

export const parentInviteLinkRoute: FastifyPluginAsync = async (fastify) => {
  const _validateInviteSchema = z.object({
    inviteCode: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(100).optional(),
  })

  fastify.post<{
    Body?: z.infer<typeof _validateInviteSchema>
    Querystring?: { inviteCode?: string; code?: string }
  }>('/api/org/parent-invites/validate', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()

      let inviteCode: string | undefined

      const body = request.body as any
      if (body) {
        inviteCode = body.inviteCode || body.code || body.invite_code
      }

      if (!inviteCode) {
        const query = request.query as any
        inviteCode = query?.inviteCode || query?.code || query?.invite_code
      }

      if (!inviteCode || typeof inviteCode !== 'string') {
        return reply.code(400).send({ error: 'Invite code is required' })
      }

      const normalizedCode = inviteCode.trim().toUpperCase()
      const inviteRef = db.doc(`parentInvites/${normalizedCode}`)
      const inviteSnap = await inviteRef.get()

      if (!inviteSnap.exists) {
        return reply.code(404).send({ error: 'Invalid invite code' })
      }

      const inviteData = inviteSnap.data()!

      if (inviteData.expiresAt) {
        const expiresAt = inviteData.expiresAt.toDate()
        if (new Date() > expiresAt) {
          return reply.code(400).send({ error: 'Invite code has expired' })
        }
      }

      const specialistRef = db.doc(`specialists/${inviteData.specialistId}`)
      const specialistSnap = await specialistRef.get()

      if (!specialistSnap.exists) {
        return reply.code(404).send({ error: 'Specialist not found' })
      }

      const specialistData = specialistSnap.data()!
      const orgRef = db.doc(`organizations/${inviteData.orgId}`)
      const orgSnap = await orgRef.get()

      return {
        ok: true,
        valid: true,
        specialistId: inviteData.specialistId,
        specialistName: specialistData.name || 'Specialist',
        orgId: inviteData.orgId,
        orgName: orgSnap.exists ? orgSnap.data()?.name : 'Organization',
      }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({ error: error.message || 'Failed to validate invite code' })
    }
  })

  const _useInviteSchema = z.object({
    inviteCode: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(100).optional(),
    childId: z.string().min(1),
  })

  fastify.post<{
    Body?: z.infer<typeof _useInviteSchema>
    Querystring?: { inviteCode?: string; code?: string; childId?: string }
  }>('/api/org/parent-invites/use', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()

      let inviteCode: string | undefined
      let childId: string | undefined

      const body = request.body as any
      if (body) {
        inviteCode = body.inviteCode || body.code || body.invite_code
        childId = body.childId || body.child_id
      }

      if (!inviteCode || !childId) {
        const query = request.query as any
        if (!inviteCode) {
          inviteCode = query?.inviteCode || query?.code || query?.invite_code
        }
        if (!childId) {
          childId = query?.childId || query?.child_id
        }
      }

      if (!inviteCode || typeof inviteCode !== 'string') {
        return reply.code(400).send({ error: 'Invite code is required' })
      }

      if (!childId || typeof childId !== 'string') {
        return reply.code(400).send({ error: 'Child ID is required' })
      }

      const normalizedCode = inviteCode.trim().toUpperCase()
      const inviteRef = db.doc(`parentInvites/${normalizedCode}`)
      const inviteSnap = await inviteRef.get()

      if (!inviteSnap.exists) {
        return reply.code(404).send({ error: 'Invalid invite code' })
      }

      const inviteData = inviteSnap.data()!

      if (inviteData.expiresAt) {
        const expiresAt = inviteData.expiresAt.toDate()
        if (new Date() > expiresAt) {
          return reply.code(400).send({ error: 'Invite code has expired' })
        }
      }

      const orgId = inviteData.orgId as string
      const callerUid = request.user.uid
      const childRef = db.doc(`children/${childId}`)
      const childSnap = await childRef.get()

      if (!childSnap.exists) {
        return reply.code(404).send({ error: 'Child not found' })
      }

      const childData = childSnap.data()
      if (childData?.parentUserId && childData.parentUserId !== callerUid) {
        return reply.code(403).send({ error: 'Child does not belong to this account' })
      }

      const orgChildrenRef = db.doc(`organizations/${orgId}/children/${childId}`)
      const orgChildrenSnap = await orgChildrenRef.get()

      const now = new Date()

      const linkBase = {
        assigned: true,
        assignedAt: admin.firestore.Timestamp.fromDate(now),
      }
      const registeredName = registeredChildDisplayName(childData)
      const linkPayload = registeredName ? { ...linkBase, childName: registeredName } : linkBase

      if (!orgChildrenSnap.exists) {
        const canAdd = await checkOrgCanAddChild(orgId)
        if (!canAdd.ok) {
          return reply.code(403).send({ error: canAdd.error ?? 'Cannot add child.' })
        }
        await orgChildrenRef.set(linkPayload)
      } else {
        await orgChildrenRef.update(linkPayload)
      }

      await childRef.update({
        organizationId: orgId,
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      })

      try {
        await inviteRef.update({ usedCount: (inviteData.usedCount || 0) + 1 })
      } catch {}

      return {
        ok: true,
        orgId,
        childId,
        message: 'Child successfully connected to specialist',
      }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({ error: error.message || 'Failed to use invite code' })
    }
  })

  fastify.post<{
    Body?: z.infer<typeof _useInviteSchema>
    Querystring?: { inviteCode?: string; code?: string; childId?: string }
  }>('/api/org/parent-invites/accept', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()

      let inviteCode: string | undefined
      let childId: string | undefined

      const body = request.body as any
      if (body) {
        inviteCode = body.inviteCode || body.code || body.invite_code
        childId = body.childId || body.child_id
      }

      if (!inviteCode || !childId) {
        const query = request.query as any
        if (!inviteCode) inviteCode = query?.inviteCode || query?.code || query?.invite_code
        if (!childId) childId = query?.childId || query?.child_id
      }

      if (!inviteCode || typeof inviteCode !== 'string') {
        return reply.code(400).send({ error: 'Invite code is required' })
      }
      if (!childId || typeof childId !== 'string') {
        return reply.code(400).send({ error: 'Child ID is required' })
      }

      const normalizedCode = inviteCode.trim().toUpperCase()
      const inviteRef = db.doc(`parentInvites/${normalizedCode}`)
      const inviteSnap = await inviteRef.get()

      if (!inviteSnap.exists) {
        return reply.code(404).send({ error: 'Invalid invite code' })
      }

      const inviteData = inviteSnap.data()!

      if (inviteData.expiresAt) {
        const expiresAt = inviteData.expiresAt.toDate()
        if (new Date() > expiresAt) {
          return reply.code(400).send({ error: 'Invite code has expired' })
        }
      }

      const orgId = inviteData.orgId as string
      const specialistId = inviteData.specialistId as string | undefined
      const childRef = db.doc(`children/${childId}`)
      const childSnap = await childRef.get()
      const now = new Date()

      const parentUid = request.user.uid

      const childData = childSnap.exists ? childSnap.data() : null
      if (childData?.parentUserId && childData.parentUserId !== parentUid) {
        return reply.code(403).send({ error: 'Child does not belong to this account' })
      }

      const orgParentRef = db.doc(`orgParents/${orgId}/parents/${parentUid}`)
      const orgParentSnap = await orgParentRef.get()

      if (!orgParentSnap.exists) {
        await orgParentRef.set({
          linkedSpecialistUid: specialistId || null,
          joinedAt: admin.firestore.Timestamp.fromDate(now),
        })
      } else {
        await orgParentRef.update({ linkedSpecialistUid: specialistId || null })
      }

      const orgChildrenRef = db.doc(`organizations/${orgId}/children/${childId}`)
      const orgChildrenSnap = await orgChildrenRef.get()

      const userSnapForName = await db.doc(`users/${childId}`).get()
      const userDataForName = userSnapForName.exists ? userSnapForName.data() : null
      const registeredName = registeredChildDisplayName(childData, userDataForName)

      const childLinkData: any = {
        assigned: true,
        assignedAt: admin.firestore.Timestamp.fromDate(now),
        childId,
        parentUserId: parentUid,
      }

      if (registeredName) {
        childLinkData.childName = registeredName
      }

      if (specialistId) {
        childLinkData.assignedSpecialistId = specialistId
      }

      if (!orgChildrenSnap.exists) {
        const canAdd = await checkOrgCanAddChild(orgId)
        if (!canAdd.ok) {
          return reply.code(403).send({ error: canAdd.error ?? 'Cannot add child.' })
        }
        await orgChildrenRef.set(childLinkData)
      } else {
        await orgChildrenRef.update(childLinkData)
      }

      if (childSnap.exists) {
        await childRef.update({
          organizationId: orgId,
          updatedAt: admin.firestore.Timestamp.fromDate(now),
        })
      }

      try {
        await inviteRef.update({ usedCount: (inviteData.usedCount || 0) + 1 })
      } catch {}

      return { ok: true, orgId, childId, message: 'Child successfully connected to specialist' }
    } catch (error: any) {
      fastify.log.error(error, '[ACCEPT] Error accepting parent invite')
      return reply.code(500).send({ error: 'Failed to accept invite code' })
    }
  })
}
