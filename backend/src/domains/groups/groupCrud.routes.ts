import { z } from 'zod'
import admin from 'firebase-admin'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../plugins/rbac.js'
import {
  DEFAULT_GROUP_COLOR,
  COLLECTIONS,
  fetchAllOrgGroups,
  fetchGroupsWithFallback,
  countGroupParents,
  getSpecialistDisplayName,
  transformGroup,
  resolveUserName,
  fetchChildData,
  verifyGroupOwnership,
  buildGroupData,
  fetchGroupAssignmentSummaries,
} from './groups.service.js'

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
})

function adminTimestamp(date: Date) {
  return admin.firestore.Timestamp.fromDate(date)
}

export const groupCrudRoute: import('fastify').FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/groups', async (request, reply) => {
    try {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const db = getFirestore()

      // Fetch live assignment summaries once for the whole org — single query,
      // avoids N+1 and ensures group cards show accurate task titles without
      // depending on the potentially-stale `lastAssignedTaskTitles` doc field.
      const assignmentSummaries = await fetchGroupAssignmentSummaries(db, orgId)

      const applyLiveSummary = (group: Record<string, any>) => {
        if (!assignmentSummaries) return group

        const summary = assignmentSummaries.get(group.id) ?? null
        return {
          ...group,
          lastAssignedAt: summary?.lastAssignedAt ?? null,
          lastAssignedTaskTitles: summary?.titles ?? null,
        }
      }

      if (member.role === 'org_admin') {
        const allGroupsWithOwner = await fetchAllOrgGroups(db, orgId)
        const groups = await Promise.all(
          allGroupsWithOwner.map(async ({ doc, ownerId }) => {
            const parentCount = await countGroupParents(db, ownerId, doc.id)
            const ownerName = await getSpecialistDisplayName(db, ownerId)
            return applyLiveSummary(transformGroup(doc, parentCount, { ownerId, ownerName }))
          })
        )
        return { ok: true, groups, count: groups.length }
      }

      const groupsSnapshot = await fetchGroupsWithFallback(db, uid, orgId)
      const groups = await Promise.all(
        groupsSnapshot.docs.map(async (doc) => {
          const parentCount = await countGroupParents(db, uid, doc.id)
          return applyLiveSummary(transformGroup(doc, parentCount))
        })
      )

      return {
        ok: true,
        groups,
        count: groups.length,
      }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({
        error: 'Failed to list groups',
        details: error.message,
      })
    }
  })

  fastify.post<{
    Params: { orgId: string }
    Body: z.infer<typeof createGroupSchema>
  }>('/orgs/:orgId/groups', async (request, reply) => {
    try {
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const body = createGroupSchema.parse(request.body)
      const now = new Date()

      const db = getFirestore()

      const existingGroups = await db
        .collection(COLLECTIONS.SPECIALIST_GROUPS(uid))
        .where('orgId', '==', orgId)
        .where('name', '==', body.name)
        .limit(1)
        .get()

      if (!existingGroups.empty) {
        return reply.code(400).send({
          error: 'Group with this name already exists',
        })
      }

      const groupRef = db.collection(COLLECTIONS.SPECIALIST_GROUPS(uid)).doc()
      const groupId = groupRef.id
      const groupData = buildGroupData(
        { name: body.name!, description: body.description, color: body.color },
        orgId,
        now
      )

      await groupRef.set(groupData)

      return {
        ok: true,
        group: {
          id: groupId,
          ...groupData,
          parentCount: 0,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({
        error: 'Failed to create group',
        details: error.message,
      })
    }
  })

  fastify.get<{
    Params: { orgId: string; groupId: string }
    Querystring: { ownerId?: string }
  }>('/orgs/:orgId/groups/:groupId', async (request, reply) => {
    try {
      const { orgId, groupId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const ownerId =
        member.role === 'org_admin' && request.query?.ownerId
          ? (request.query as { ownerId: string }).ownerId
          : uid

      const db = getFirestore()
      const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(ownerId)}/${groupId}`)
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

      if (member.role === 'specialist' && ownerId !== uid) {
        return reply.code(403).send({ error: 'You can only view your own groups' })
      }

      const parentsSnapshot = await db.collection(COLLECTIONS.GROUP_PARENTS(ownerId, groupId)).get()

      const parents = await Promise.all(
        parentsSnapshot.docs.map(async (doc) => {
          const data = doc.data()
          const parentUid = doc.id
          const { name, email } = await resolveUserName(db, parentUid)
          const childIds = data.childIds || []
          const children = await Promise.all(
            childIds.map((childId: string) => fetchChildData(db, childId, parentUid))
          )

          return {
            parentUserId: parentUid,
            name,
            email,
            children,
            addedAt: data.addedAt?.toDate?.()?.toISOString() || null,
          }
        })
      )

      const groupPayload: Record<string, unknown> = {
        id: groupId,
        name: groupData.name,
        description: groupData.description || null,
        color: groupData.color || DEFAULT_GROUP_COLOR,
        orgId: groupData.orgId,
        parents,
        parentCount: parents.length,
        createdAt: groupData.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: groupData.updatedAt?.toDate?.()?.toISOString() || null,
      }
      if (member.role === 'org_admin' && ownerId !== uid) {
        groupPayload.ownerId = ownerId
        groupPayload.ownerName = await getSpecialistDisplayName(db, ownerId)
      }
      return { ok: true, group: groupPayload }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({
        error: 'Failed to get group',
        details: error.message,
      })
    }
  })
  fastify.patch<{
    Params: { orgId: string; groupId: string }
    Body: Partial<z.infer<typeof createGroupSchema>>
  }>('/orgs/:orgId/groups/:groupId', async (request, reply) => {
    try {
      const { orgId, groupId } = request.params
      await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const body = request.body as any
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

      if (body.name && body.name !== groupData.name) {
        const existingGroups = await db
          .collection(COLLECTIONS.SPECIALIST_GROUPS(uid))
          .where('orgId', '==', orgId)
          .where('name', '==', body.name)
          .limit(1)
          .get()

        if (!existingGroups.empty) {
          return reply.code(400).send({
            error: 'Group with this name already exists',
          })
        }
      }

      const updateData: any = {
        updatedAt: adminTimestamp(now),
      }

      if (body.name) updateData.name = body.name
      if (body.description !== undefined) updateData.description = body.description || null
      if (body.color) updateData.color = body.color

      await groupRef.update(updateData)

      return {
        ok: true,
        message: 'Group updated successfully',
      }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({
        error: 'Failed to update group',
        details: error.message,
      })
    }
  })

  fastify.delete<{ Params: { orgId: string; groupId: string } }>(
    '/orgs/:orgId/groups/:groupId',
    async (request, reply) => {
      try {
        const { orgId, groupId } = request.params
        await requireOrgMember(request, reply, orgId)
        const { uid } = request.user!

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

        const parentsSnapshot = await db.collection(COLLECTIONS.GROUP_PARENTS(uid, groupId)).get()

        const deletePromises = parentsSnapshot.docs.map((doc) => doc.ref.delete())
        await Promise.all(deletePromises)

        await groupRef.delete()

        return {
          ok: true,
          message: 'Group deleted successfully',
        }
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Route handler failed')
        return reply.code(500).send({
          error: 'Failed to delete group',
          details: error.message,
        })
      }
    }
  )
}
