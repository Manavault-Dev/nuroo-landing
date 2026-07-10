import { z } from 'zod'
import admin from 'firebase-admin'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import { COLLECTIONS, getChildIdsForParent, verifyGroupOwnership } from './groups.service.js'

const addParentToGroupSchema = z.object({
  parentUserId: z.string().min(1),
  childIds: z.array(z.string()).optional(),
})

function adminTimestamp(date: Date) {
  return admin.firestore.Timestamp.fromDate(date)
}

export const groupParentsRoute: import('fastify').FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Params: { orgId: string; groupId: string }
    Body: z.infer<typeof addParentToGroupSchema>
  }>('/orgs/:orgId/groups/:groupId/parents', async (request, reply) => {
    try {
      const { orgId, groupId } = request.params
      await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const body = addParentToGroupSchema.parse(request.body)
      const now = new Date()

      const db = getFirestore()

      const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(uid)}/${groupId}`)
      const groupSnap = await groupRef.get()

      if (!groupSnap.exists) {
        return reply.code(404).send({ error: 'Group not found' })
      }

      const groupData = groupSnap.data()!

      if (!verifyGroupOwnership(groupData, orgId)) {
        return reply.code(403).send({
          error: 'Group does not belong to this organization',
        })
      }

      const orgChildrenSnap = await db
        .collection(COLLECTIONS.ORG_CHILDREN(orgId))
        .where('parentUserId', '==', body.parentUserId)
        .limit(1)
        .get()

      if (orgChildrenSnap.empty) {
        return reply.code(404).send({
          error: 'Parent is not linked to this organization',
        })
      }

      let childIds = body.childIds || []
      if (childIds.length === 0) {
        childIds = await getChildIdsForParent(db, orgId, body.parentUserId)
      }

      const parentRef = db.doc(`${COLLECTIONS.GROUP_PARENTS(uid, groupId)}/${body.parentUserId}`)
      const parentSnap = await parentRef.get()

      const parentData = {
        childIds,
        updatedAt: adminTimestamp(now),
      }

      if (parentSnap.exists) {
        await parentRef.update(parentData)
      } else {
        await parentRef.set({
          ...parentData,
          addedAt: adminTimestamp(now),
        })
      }

      return {
        ok: true,
        message: 'Parent added to group successfully',
      }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({
        error: 'Failed to add parent to group',
        details: error.message,
      })
    }
  })

  fastify.delete<{ Params: { orgId: string; groupId: string; parentUserId: string } }>(
    '/orgs/:orgId/groups/:groupId/parents/:parentUserId',
    async (request, reply) => {
      try {
        const { orgId, groupId, parentUserId } = request.params
        await requireOrgMember(request, reply, orgId)
        const { uid } = request.user!

        const db = getFirestore()

        const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(uid)}/${groupId}`)
        const groupSnap = await groupRef.get()

        if (!groupSnap.exists) {
          return reply.code(404).send({ error: 'Group not found' })
        }

        const parentRef = db.doc(`${COLLECTIONS.GROUP_PARENTS(uid, groupId)}/${parentUserId}`)
        await parentRef.delete()

        return {
          ok: true,
          message: 'Parent removed from group successfully',
        }
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Route handler failed')
        return reply.code(500).send({
          error: 'Failed to remove parent from group',
          details: error.message,
        })
      }
    }
  )
}
