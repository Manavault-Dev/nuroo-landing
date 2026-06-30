import { z } from 'zod'
import admin from 'firebase-admin'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../plugins/rbac.js'
import {
  COLLECTIONS,
  verifyGroupOwnership,
  fetchAllOrgGroups,
  fetchAssignmentHistory,
  assignTasksToGroup,
  getAssignmentDetail,
  deleteAssignment,
  getAssignmentComments,
  addComment,
  reviewSubmission,
} from './groups.service.js'

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

function adminTimestamp(date: Date) {
  return admin.firestore.Timestamp.fromDate(date)
}

async function resolveGroupForAssignment(
  db: admin.firestore.Firestore,
  orgId: string,
  groupId: string,
  ownerId: string,
  canSearchOrgGroups: boolean
) {
  const directSnap = await db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(ownerId)}/${groupId}`).get()
  if (directSnap.exists) return { ownerId, groupSnap: directSnap }

  if (!canSearchOrgGroups) return null

  const groups = await fetchAllOrgGroups(db, orgId)
  const match = groups.find(({ doc }) => doc.id === groupId)
  if (!match) return null

  return { ownerId: match.ownerId, groupSnap: match.doc }
}

export const groupAssignmentsRoute: import('fastify').FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { orgId: string; groupId: string }
    Querystring: { ownerId?: string }
  }>('/orgs/:orgId/groups/:groupId/assignments', async (request, reply) => {
    try {
      const { orgId, groupId } = request.params
      // Only verify org membership — any member can read all group assignments.
      // ownerId filtering was removed: it caused specialists to see zero
      // assignments when those assignments were created by an org admin.
      await requireOrgMember(request, reply, orgId)

      const db = getFirestore()
      const assignments = await fetchAssignmentHistory(db, orgId, groupId)
      return { ok: true, assignments, count: assignments.length }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Route handler failed')
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

      const resolvedGroup = await resolveGroupForAssignment(
        db,
        orgId,
        groupId,
        ownerId,
        member.role === 'org_admin'
      )
      if (!resolvedGroup) return reply.code(404).send({ error: 'Group not found' })

      const { ownerId: resolvedOwnerId, groupSnap } = resolvedGroup
      if (!verifyGroupOwnership(groupSnap.data()!, orgId)) {
        return reply.code(403).send({ error: 'Group does not belong to this organization' })
      }

      if (body.contentTaskIds.length === 0 && body.contentRoadmapIds.length === 0) {
        return reply.code(400).send({ error: 'At least one task or roadmap must be selected' })
      }

      try {
        const result = await assignTasksToGroup(db, orgId, groupId, resolvedOwnerId, uid, {
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
      fastify.log.error({ err: error }, 'Route handler failed')
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
            contentTaskIds: aData.contentTaskIds || [],
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
      fastify.log.error({ err: error }, 'Route handler failed')
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
        updatedAt: adminTimestamp(new Date()),
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
