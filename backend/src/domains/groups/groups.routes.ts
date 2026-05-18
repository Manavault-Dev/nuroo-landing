import { FastifyPluginAsync } from 'fastify'
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
  getChildIdsForParent,
  verifyGroupOwnership,
  buildGroupData,
  fetchAssignmentHistory,
  assignTasksToGroup,
  getAssignmentDetail,
  deleteAssignment,
  getAssignmentComments,
  addComment,
  reviewSubmission,
} from './groups.service.js'

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
})

const addParentToGroupSchema = z.object({
  parentUserId: z.string().min(1),
  childIds: z.array(z.string()).optional(),
})

const addCommentSchema = z.object({
  text: z.string().min(1).max(2000),
})

const reviewSubmissionSchema = z.object({
  grade: z.enum(['approved', 'needs_revision']),
  feedback: z.string().max(2000).optional(),
})

const updateAssignmentSchema = z.object({
  status: z.enum(['active', 'closed']).optional(),
  dueDate: z.string().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
})

const assignGroupTasksSchema = z.object({
  contentTaskIds: z.array(z.string().min(1)).max(50).default([]),
  contentRoadmapIds: z.array(z.string().min(1)).max(20).default([]),
  dueDate: z.string().nullable().optional(),
})

export const groupsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/groups', async (request, reply) => {
    try {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const db = getFirestore()

      if (member.role === 'org_admin') {
        const allGroupsWithOwner = await fetchAllOrgGroups(db, orgId)
        const groups = await Promise.all(
          allGroupsWithOwner.map(async ({ doc, ownerId }) => {
            const parentCount = await countGroupParents(db, ownerId, doc.id)
            const ownerName = await getSpecialistDisplayName(db, ownerId)
            return transformGroup(doc, parentCount, { ownerId, ownerName })
          })
        )
        return { ok: true, groups, count: groups.length }
      }

      const groupsSnapshot = await fetchGroupsWithFallback(db, uid, orgId)
      const groups = await Promise.all(
        groupsSnapshot.docs.map(async (doc) => {
          const parentCount = await countGroupParents(db, uid, doc.id)
          return transformGroup(doc, parentCount)
        })
      )

      return {
        ok: true,
        groups,
        count: groups.length,
      }
    } catch (error: any) {
      console.error('[GROUPS] Error listing groups:', error)
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
      const groupData = buildGroupData({ name: body.name!, description: body.description, color: body.color }, orgId, now)

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
      console.error('[GROUPS] Error creating group:', error)
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
      console.error('[GROUPS] Error getting group:', error)
      return reply.code(500).send({
        error: 'Failed to get group',
        details: error.message,
      })
    }
  })

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
        updatedAt: admin_timestamp(now),
      }

      if (parentSnap.exists) {
        await parentRef.update(parentData)
      } else {
        await parentRef.set({
          ...parentData,
          addedAt: admin_timestamp(now),
        })
      }

      return {
        ok: true,
        message: 'Parent added to group successfully',
      }
    } catch (error: any) {
      console.error('[GROUPS] Error adding parent to group:', error)
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
        console.error('[GROUPS] Error removing parent from group:', error)
        return reply.code(500).send({
          error: 'Failed to remove parent from group',
          details: error.message,
        })
      }
    }
  )

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
        updatedAt: admin_timestamp(now),
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
      console.error('[GROUPS] Error updating group:', error)
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
        console.error('[GROUPS] Error deleting group:', error)
        return reply.code(500).send({
          error: 'Failed to delete group',
          details: error.message,
        })
      }
    }
  )

  fastify.get<{
    Params: { orgId: string; groupId: string }
    Querystring: { ownerId?: string }
  }>('/orgs/:orgId/groups/:groupId/assignments', async (request, reply) => {
    try {
      const { orgId, groupId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!

      const ownerId =
        member.role === 'org_admin' && (request.query as { ownerId?: string })?.ownerId
          ? (request.query as { ownerId: string }).ownerId
          : uid

      const db = getFirestore()
      const assignments = await fetchAssignmentHistory(db, orgId, groupId, ownerId)
      return { ok: true, assignments, count: assignments.length }
    } catch (error: any) {
      console.error('[GROUPS] Error fetching assignment history:', error)
      return reply
        .code(500)
        .send({ error: 'Failed to fetch assignment history', details: error.message })
    }
  })

  fastify.post<{
    Params: { orgId: string; groupId: string }
    Querystring: { ownerId?: string }
    Body: z.infer<typeof assignGroupTasksSchema>
  }>('/orgs/:orgId/groups/:groupId/assign', async (request, reply) => {
    try {
      const { orgId, groupId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const ownerId =
        member.role === 'org_admin' && (request.query as any)?.ownerId
          ? (request.query as any).ownerId
          : uid
      const body = assignGroupTasksSchema.parse(request.body)

      const db = getFirestore()

      const groupSnap = await db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(ownerId)}/${groupId}`).get()
      if (!groupSnap.exists) return reply.code(404).send({ error: 'Group not found' })
      if (!verifyGroupOwnership(groupSnap.data()!, orgId)) {
        return reply.code(403).send({ error: 'Group does not belong to this organization' })
      }

      if (body.contentTaskIds.length === 0 && body.contentRoadmapIds.length === 0) {
        return reply.code(400).send({ error: 'At least one task or roadmap must be selected' })
      }

      try {
        const result = await assignTasksToGroup(db, orgId, groupId, ownerId, uid, {
          contentTaskIds: body.contentTaskIds,
          contentRoadmapIds: body.contentRoadmapIds,
          dueDate: body.dueDate,
        })
        return {
          ok: true,
          ...result,
          message: `${result.taskCount} task(s) assigned to ${result.childCount} children`,
        }
      } catch (err: any) {
        if (err.statusCode === 400) {
          return reply.code(400).send({ error: err.message })
        }
        throw err
      }
    } catch (error: any) {
      console.error('[GROUPS] Error assigning group tasks:', error)
      return reply.code(500).send({ error: 'Failed to assign group tasks', details: error.message })
    }
  })

  fastify.get<{
    Params: { orgId: string; groupId: string; assignmentId: string }
    Querystring: { ownerId?: string }
  }>('/orgs/:orgId/groups/:groupId/assignments/:assignmentId', async (request, reply) => {
    try {
      const { orgId, assignmentId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const db = getFirestore()

      try {
        const { aData, childIds, submissions, contentRoadmapIds, roadmaps } =
          await getAssignmentDetail(db, orgId, assignmentId)

        if (member.role === 'specialist' && aData.ownerId !== uid) {
          return reply.code(403).send({ error: 'You can only view your own assignments' })
        }

        return {
          ok: true,
          assignment: {
            id: assignmentId,
            groupId: aData.groupId,
            groupName: aData.groupName,
            ownerId: aData.ownerId,
            title: aData.title || (aData.taskTitles?.[0] ?? 'Задание'),
            description: aData.description ?? null,
            dueDate: aData.dueDate ?? null,
            taskTitles: aData.taskTitles || [],
            contentRoadmapIds,
            roadmapNames: aData.roadmapNames || [],
            roadmaps,
            childCount: aData.childCount || childIds.length,
            status: aData.status || 'active',
            assignedAt: aData.assignedAt?.toDate?.()?.toISOString() ?? null,
            submissions,
          },
        }
      } catch (err: any) {
        if (err.statusCode === 404) {
          return reply.code(404).send({ error: 'Assignment not found' })
        }
        throw err
      }
    } catch (error: any) {
      console.error('[GROUPS] Error fetching assignment detail:', error)
      return reply
        .code(500)
        .send({ error: 'Failed to fetch assignment detail', details: error.message })
    }
  })

  fastify.patch<{
    Params: { orgId: string; groupId: string; assignmentId: string }
    Body: z.infer<typeof updateAssignmentSchema>
  }>('/orgs/:orgId/groups/:groupId/assignments/:assignmentId', async (request, reply) => {
    try {
      const { orgId, assignmentId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const body = updateAssignmentSchema.parse(request.body)
      const db = getFirestore()

      const assignmentRef = db.doc(`organizations/${orgId}/groupAssignments/${assignmentId}`)
      const assignmentSnap = await assignmentRef.get()
      if (!assignmentSnap.exists) return reply.code(404).send({ error: 'Assignment not found' })

      const aData = assignmentSnap.data()!
      if (member.role === 'specialist' && aData.ownerId !== uid) {
        return reply.code(403).send({ error: 'You can only update your own assignments' })
      }

      const updates: Record<string, any> = {
        updatedAt: admin_timestamp(new Date()),
      }
      if (body.status) updates.status = body.status
      if (body.dueDate !== undefined) updates.dueDate = body.dueDate
      if (body.title) updates.title = body.title
      if (body.description !== undefined) updates.description = body.description

      await assignmentRef.update(updates)
      return { ok: true }
    } catch (error: any) {
      return reply.code(500).send({ error: 'Failed to update assignment', details: error.message })
    }
  })

  fastify.delete<{ Params: { orgId: string; groupId: string; assignmentId: string } }>(
    '/orgs/:orgId/groups/:groupId/assignments/:assignmentId',
    async (request, reply) => {
      try {
        const { orgId, assignmentId } = request.params
        const member = await requireOrgMember(request, reply, orgId)
        const { uid } = request.user!
        const db = getFirestore()

        const assignmentRef = db.doc(`organizations/${orgId}/groupAssignments/${assignmentId}`)
        const assignmentSnap = await assignmentRef.get()
        if (!assignmentSnap.exists) return reply.code(404).send({ error: 'Assignment not found' })

        const aData = assignmentSnap.data()!
        if (member.role === 'specialist' && aData.ownerId !== uid) {
          return reply.code(403).send({ error: 'You can only delete your own assignments' })
        }

        await deleteAssignment(db, orgId, assignmentId, aData.childIds || [])
        return { ok: true }
      } catch (error: any) {
        return reply
          .code(500)
          .send({ error: 'Failed to delete assignment', details: error.message })
      }
    }
  )

  fastify.get<{ Params: { orgId: string; groupId: string; assignmentId: string } }>(
    '/orgs/:orgId/groups/:groupId/assignments/:assignmentId/comments',
    async (request, reply) => {
      try {
        const { orgId, assignmentId } = request.params
        await requireOrgMember(request, reply, orgId)
        const db = getFirestore()
        const comments = await getAssignmentComments(db, orgId, assignmentId)
        return { ok: true, comments }
      } catch (error: any) {
        return reply.code(500).send({ error: 'Failed to fetch comments', details: error.message })
      }
    }
  )

  fastify.post<{
    Params: { orgId: string; groupId: string; assignmentId: string }
    Body: z.infer<typeof addCommentSchema>
  }>('/orgs/:orgId/groups/:groupId/assignments/:assignmentId/comments', async (request, reply) => {
    try {
      const { orgId, assignmentId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const body = addCommentSchema.parse(request.body)
      const db = getFirestore()

      const { id, authorName, now } = await addComment(
        db,
        orgId,
        assignmentId,
        uid,
        member.role,
        body.text
      )

      return {
        ok: true,
        comment: {
          id,
          authorId: uid,
          authorName,
          authorRole: member.role,
          text: body.text,
          createdAt: now.toDate().toISOString(),
        },
      }
    } catch (error: any) {
      return reply.code(500).send({ error: 'Failed to add comment', details: error.message })
    }
  })

  fastify.patch<{
    Params: { orgId: string; groupId: string; assignmentId: string; childId: string }
    Body: z.infer<typeof reviewSubmissionSchema>
  }>(
    '/orgs/:orgId/groups/:groupId/assignments/:assignmentId/submissions/:childId',
    async (request, reply) => {
      try {
        const { orgId, assignmentId, childId } = request.params
        const member = await requireOrgMember(request, reply, orgId)
        const { uid } = request.user!
        const body = reviewSubmissionSchema.parse(request.body)
        const db = getFirestore()

        const assignmentSnap = await db
          .doc(`organizations/${orgId}/groupAssignments/${assignmentId}`)
          .get()
        if (!assignmentSnap.exists) return reply.code(404).send({ error: 'Assignment not found' })
        const aData = assignmentSnap.data()!
        if (member.role === 'specialist' && aData.ownerId !== uid) {
          return reply
            .code(403)
            .send({ error: 'You can only review submissions for your own assignments' })
        }

        try {
          await reviewSubmission(db, orgId, assignmentId, childId, uid, body.grade, body.feedback)
          return { ok: true, childId, grade: body.grade }
        } catch (err: any) {
          if (err.statusCode === 404) {
            return reply.code(404).send({ error: err.message })
          }
          throw err
        }
      } catch (error: any) {
        return reply
          .code(500)
          .send({ error: 'Failed to review submission', details: error.message })
      }
    }
  )
}

function admin_timestamp(date: Date) {
  return admin.firestore.Timestamp.fromDate(date)
}
