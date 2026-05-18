import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import admin from 'firebase-admin'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember, requireChildAccess } from '../../plugins/rbac.js'
import { checkOrgCanAddChild } from '../../modules/payments/planLimits.js'
import { dispatch } from '../../modules/notifications/index.js'
import type { ChildDetail, TimelineResponse } from '../../types.js'

import {
  fetchAssignedChildren,
  pickStoredProfileName,
  resolveChildNameFromData,
  resolveChildName,
  fetchChildProgress,
  countCompletedTasks,
  groupChildrenByParent,
  enrichChildrenWithDetails,
  buildParentConnection,
  parseTimelineDays,
  buildActivityMap,
  buildFeedbackMap,
  buildTimelineDays,
  createChildRecord,
  disconnectParentFromOrg,
  removeChildFromOrg,
  getChildProfile,
  updateChildProfile,
  getChildGuardians,
  addGuardian,
  updateGuardian,
  deleteGuardian,
  createChildTask,
  listChildTasks,
  COLLECTIONS,
} from './children.service.js'

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
})

const childProfileUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().max(100).optional(),
  fullName: z.string().min(1).max(200).optional(),
  photoUrl: z.string().optional(),
  dateOfBirth: z.string().optional(),
  age: z.number().int().min(0).max(30).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
  startDate: z.string().optional(),
  branchId: z.string().optional(),
  primaryConcern: z.string().max(500).optional(),
  diagnosis: z.string().max(500).optional(),
  developmentalNotes: z.string().max(2000).optional(),
  communicationLevel: z.string().max(200).optional(),
  therapyGoals: z.string().max(2000).optional(),
  contraindications: z.string().max(1000).optional(),
  importantNotes: z.string().max(2000).optional(),
  internalCode: z.string().max(100).optional(),
})

const guardianCreateSchema = z.object({
  fullName: z.string().min(1).max(200),
  relationship: z.enum(['mother', 'father', 'guardian', 'other']),
  phone: z.string().max(50).optional(),
  whatsapp: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  preferredContactMethod: z.enum(['phone', 'whatsapp', 'email']).optional(),
  isPrimaryContact: z.boolean().optional().default(false),
  isEmergencyContact: z.boolean().optional().default(false),
  appUserId: z.string().optional(),
})

const guardianUpdateSchema = guardianCreateSchema.partial()

export const childrenRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/connections', async (request, reply) => {
    try {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const role = member.role

      const db = getFirestore()
      const assignedChildrenSnap = await fetchAssignedChildren(db, orgId, role, uid)
      const { parentMap, orgLinkByChildId } = groupChildrenByParent(assignedChildrenSnap.docs)

      await enrichChildrenWithDetails(db, parentMap, orgLinkByChildId)

      const connections = await Promise.all(
        Array.from(parentMap.entries()).map(([parentUserId, children]) =>
          buildParentConnection(db, orgId, parentUserId, children)
        )
      )

      return {
        ok: true,
        connections,
        count: connections.length,
      }
    } catch (error: unknown) {
      console.error('[CONNECTIONS] Error fetching connections:', error)
      return reply.code(500).send({
        error: 'Failed to fetch connections',
        details: error instanceof Error ? error.message : '',
      })
    }
  })

  fastify.post<{
    Params: { orgId: string }
    Body: {
      firstName: string
      lastName?: string
      dateOfBirth?: string
      gender?: 'male' | 'female' | 'other'
      diagnosis?: string
      primaryConcern?: string
    }
  }>('/orgs/:orgId/children', async (request, reply) => {
    try {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return

      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only org admins can add children' })
      }

      const limitCheck = await checkOrgCanAddChild(orgId)
      if (!limitCheck.ok) {
        return reply.code(403).send({ error: limitCheck.error, upgradeRequired: true })
      }

      const body = request.body as {
        firstName: string
        lastName?: string
        dateOfBirth?: string
        gender?: string
        diagnosis?: string
        primaryConcern?: string
      }

      if (!body.firstName?.trim()) {
        return reply.code(400).send({ error: 'firstName is required' })
      }

      const db = getFirestore()
      const { id, childData, now } = await createChildRecord(db, orgId, request.user!.uid, body)

      return reply.code(201).send({
        ok: true,
        child: { id, ...childData, createdAt: now.toDate(), updatedAt: now.toDate() },
      })
    } catch (error: unknown) {
      console.error('[CHILDREN] Error creating child:', error)
      return reply.code(500).send({
        error: 'Failed to create child',
        details: error instanceof Error ? error.message : '',
      })
    }
  })

  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/children', async (request, reply) => {
    try {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const role = member.role

      console.log(`[CHILDREN] Fetching children for org=${orgId}, user=${uid}, role=${role}`)

      const db = getFirestore()
      const assignedChildrenSnap = await fetchAssignedChildren(db, orgId, role, uid)
      const childIds = assignedChildrenSnap.docs.map((doc) => doc.id)

      console.log(`[CHILDREN] Found ${childIds.length} assigned children for user ${uid}`)

      if (childIds.length === 0) {
        return []
      }

      const children = await Promise.all(
        childIds.map(async (childId) => {
          const linkDoc = assignedChildrenSnap.docs.find((d) => d.id === childId)
          const linkData = linkDoc?.data()
          const parentUserId = linkData?.parentUserId

          const [progressData, completedTasksCount, userSnap, childSnap] = await Promise.all([
            fetchChildProgress(db, childId),
            countCompletedTasks(db, childId),
            db.doc(`users/${childId}`).get(),
            db.doc(`${COLLECTIONS.CHILDREN}/${childId}`).get(),
          ])

          const userData = userSnap.exists ? userSnap.data() : null
          const childData = childSnap.exists ? childSnap.data() : null
          let childName =
            pickStoredProfileName(linkData) ||
            resolveChildNameFromData(childId, childData, userData)

          if (!childName || childName === childId) {
            childName = await resolveChildName(db, childId, parentUserId, linkData)
          }

          return {
            id: childId,
            name: childName,
            age: childData?.age || childData?.childAge || userData?.age || userData?.childAge,
            speechStepId: progressData?.currentStepId,
            speechStepNumber: progressData?.currentStepNumber,
            lastActiveDate:
              childData?.lastActiveDate?.toDate() ||
              childData?.updatedAt?.toDate() ||
              userData?.updatedAt?.toDate?.(),
            completedTasksCount,
          }
        })
      )

      return children
    } catch (error: unknown) {
      console.error('[CHILDREN] Error fetching children:', error)
      return reply.code(500).send({
        error: 'Failed to fetch children',
        details: error instanceof Error ? error.message : '',
      })
    }
  })

  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params

        await requireOrgMember(request, reply, orgId)
        const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

        const db = getFirestore()

        const linkSnap = await db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${resolvedChildId}`).get()
        const linkData = linkSnap.exists ? linkSnap.data() : null
        const parentUserId = linkData?.parentUserId

        const childRef = db.doc(`${COLLECTIONS.CHILDREN}/${resolvedChildId}`)
        const childSnap = await childRef.get()
        const childData = childSnap.exists ? childSnap.data() : null

        const userSnap = await db.doc(`users/${resolvedChildId}`).get()
        const userData = userSnap.exists ? userSnap.data() : null

        if (!childSnap.exists && !userSnap.exists) {
          return reply.code(404).send({ error: 'Child not found' })
        }

        const [childName, progressData, tasksSnapshot, completedTasksCount] = await Promise.all([
          resolveChildName(db, resolvedChildId, parentUserId, linkData),
          fetchChildProgress(db, resolvedChildId),
          db
            .collection(COLLECTIONS.CHILD_TASKS(resolvedChildId))
            .orderBy('updatedAt', 'desc')
            .limit(10)
            .get(),
          countCompletedTasks(db, resolvedChildId),
        ])

        const recentTasks = tasksSnapshot.docs.map((doc) => {
          const taskData = doc.data()
          return {
            id: doc.id,
            title: taskData.title || 'Untitled Task',
            status: taskData.status || 'pending',
            completedAt: taskData.completedAt?.toDate(),
          }
        })

        let parentInfo: import('../../types.js').ParentInfo | undefined
        if (parentUserId) {
          let orgParentData: admin.firestore.DocumentData | null = null
          try {
            const orgParentSnap = await db
              .doc(`${COLLECTIONS.ORG_PARENTS(orgId)}/${parentUserId}`)
              .get()
            orgParentData = orgParentSnap.exists ? (orgParentSnap.data() ?? null) : null
          } catch {
            /* ignore */
          }

          try {
            const parentAuthUser = await admin.auth().getUser(parentUserId)
            let linkedAt: Date | undefined
            if (linkData?.createdAt?.toDate) {
              linkedAt = linkData.createdAt.toDate()
            } else if (linkData?.assignedAt?.toDate) {
              linkedAt = linkData.assignedAt.toDate()
            } else {
              linkedAt =
                orgParentData?.joinedAt?.toDate?.() ||
                orgParentData?.createdAt?.toDate?.() ||
                undefined
            }
            parentInfo = {
              uid: parentUserId,
              displayName:
                orgParentData?.fullName ||
                parentAuthUser.displayName ||
                (childData?.parentName as string | undefined) ||
                (linkData?.parentName as string | undefined) ||
                undefined,
              email: parentAuthUser.email || undefined,
              linkedAt,
              phone: orgParentData?.phone || undefined,
              whatsapp: orgParentData?.whatsapp || undefined,
              address: orgParentData?.address || undefined,
              fullName: orgParentData?.fullName || undefined,
            }
          } catch {
            parentInfo = {
              uid: parentUserId,
              displayName: orgParentData?.fullName || undefined,
              phone: orgParentData?.phone || undefined,
              whatsapp: orgParentData?.whatsapp || undefined,
              address: orgParentData?.address || undefined,
              fullName: orgParentData?.fullName || undefined,
            }
          }
        }

        const detail: ChildDetail = {
          id: resolvedChildId,
          name: childName,
          age: childData?.age || userData?.age,
          organizationId: childData?.organizationId || orgId,
          speechStepId: progressData?.currentStepId,
          speechStepNumber: progressData?.currentStepNumber,
          lastActiveDate: childData?.lastActiveDate?.toDate() || userData?.updatedAt?.toDate?.(),
          completedTasksCount,
          recentTasks,
          parentInfo,
        }

        return detail
      } catch (error: unknown) {
        console.error('[CHILDREN] Error fetching child detail:', error)
        return reply.code(500).send({
          error: 'Failed to fetch child details',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )

  fastify.get<{
    Params: { orgId: string; childId: string }
    Querystring: { days?: string }
  }>('/orgs/:orgId/children/:childId/timeline', async (request, reply) => {
    try {
      const { orgId, childId } = request.params
      const days = parseTimelineDays(request.query.days)

      await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const db = getFirestore()
      const now = new Date()
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      const startTimestamp = admin.firestore.Timestamp.fromDate(startDate)

      const tasksRef = db.collection(COLLECTIONS.CHILD_TASKS(resolvedChildId))
      const tasksSnapshot = await tasksRef
        .where('updatedAt', '>=', startTimestamp)
        .orderBy('updatedAt', 'desc')
        .get()

      const feedbackRef = db.collection(COLLECTIONS.CHILD_FEEDBACK(resolvedChildId))
      const feedbackSnapshot = await feedbackRef.where('timestamp', '>=', startTimestamp).get()

      const activityMap = buildActivityMap(tasksSnapshot.docs)
      const feedbackMap = buildFeedbackMap(feedbackSnapshot.docs)
      const timelineDaysData = buildTimelineDays(days, activityMap, feedbackMap)

      const response: TimelineResponse = { days: timelineDaysData }
      return response
    } catch (error: unknown) {
      console.error('[CHILDREN] Error fetching timeline:', error)
      return reply.code(500).send({
        error: 'Failed to fetch timeline',
        details: error instanceof Error ? error.message : '',
      })
    }
  })

  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/tasks',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params
        await requireOrgMember(request, reply, orgId)
        const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

        const db = getFirestore()
        const tasks = await listChildTasks(db, resolvedChildId)
        return { tasks }
      } catch (error: unknown) {
        console.error('[CHILDREN] Error listing tasks:', error)
        return reply.code(500).send({
          error: 'Failed to list tasks',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )

  fastify.delete<{ Params: { orgId: string; parentUserId: string } }>(
    '/orgs/:orgId/connections/:parentUserId',
    async (request, reply) => {
      try {
        const { orgId, parentUserId } = request.params
        const member = await requireOrgMember(request, reply, orgId)
        if (member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only org admins can disconnect parents' })
        }

        const db = getFirestore()
        const result = await disconnectParentFromOrg(db, orgId, parentUserId)
        return { ok: true, ...result }
      } catch (error: unknown) {
        console.error('[CONNECTIONS] Error disconnecting parent:', error)
        return reply.code(500).send({
          error: 'Failed to disconnect parent',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )

  fastify.post<{
    Params: { orgId: string; childId: string }
    Body: z.infer<typeof createTaskSchema>
  }>('/orgs/:orgId/children/:childId/tasks', async (request, reply) => {
    try {
      const { orgId, childId } = request.params
      await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)
      if (!request.user) return

      const parse = createTaskSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid body: title required (1–500 chars), description optional',
        })
      }
      const { title, description } = parse.data

      const db = getFirestore()
      const { id: taskId, taskData, now } = await createChildTask(
        db,
        resolvedChildId,
        request.user.uid,
        title,
        description
      )

      const orgChildSnap = await db.doc(`organizations/${orgId}/children/${resolvedChildId}`).get()
      const parentUserId = orgChildSnap.data()?.parentUserId
      const childName: string = orgChildSnap.data()?.name || 'your child'
      if (parentUserId) {
        dispatch({
          userId: parentUserId,
          orgId,
          role: 'parent',
          type: 'task_assigned',
          category: 'assignments',
          title: 'New assignment',
          body: `You have a new assignment for ${childName}.`,
          metadata: { childId: resolvedChildId, taskId, orgId },
          dedupKey: `task_assigned:${resolvedChildId}:${taskId}`,
        }).catch(() => {})
      }

      return reply.code(201).send({
        id: taskId,
        ...taskData,
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
      })
    } catch (error: unknown) {
      console.error('[CHILDREN] Error creating task:', error)
      return reply.code(500).send({
        error: 'Failed to create task',
        details: error instanceof Error ? error.message : '',
      })
    }
  })

  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/profile',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params
        await requireOrgMember(request, reply, orgId)
        const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

        const db = getFirestore()
        const profile = await getChildProfile(db, orgId, resolvedChildId)
        return { ok: true, profile }
      } catch (error: unknown) {
        console.error('[CHILDREN] Error fetching profile:', error)
        return reply.code(500).send({
          error: 'Failed to fetch child profile',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )

  fastify.patch<{
    Params: { orgId: string; childId: string }
    Body: z.infer<typeof childProfileUpdateSchema>
  }>('/orgs/:orgId/children/:childId/profile', async (request, reply) => {
    try {
      const { orgId, childId } = request.params
      await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const parse = childProfileUpdateSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid profile data', details: parse.error.errors })
      }

      const db = getFirestore()
      const updatedData = await updateChildProfile(db, orgId, resolvedChildId, { ...parse.data })
      return { ok: true, profile: updatedData }
    } catch (error: unknown) {
      console.error('[CHILDREN] Error updating profile:', error)
      return reply.code(500).send({
        error: 'Failed to update child profile',
        details: error instanceof Error ? error.message : '',
      })
    }
  })

  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/guardians',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params
        await requireOrgMember(request, reply, orgId)
        const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

        const db = getFirestore()
        const guardians = await getChildGuardians(db, orgId, resolvedChildId)
        return { ok: true, guardians }
      } catch (error: unknown) {
        console.error('[CHILDREN] Error fetching guardians:', error)
        return reply.code(500).send({
          error: 'Failed to fetch guardians',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )

  fastify.post<{
    Params: { orgId: string; childId: string }
    Body: z.infer<typeof guardianCreateSchema>
  }>('/orgs/:orgId/children/:childId/guardians', async (request, reply) => {
    try {
      const { orgId, childId } = request.params
      await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const parse = guardianCreateSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid guardian data', details: parse.error.errors })
      }

      const db = getFirestore()
      const { id, now } = await addGuardian(db, resolvedChildId, parse.data)

      return reply.code(201).send({
        ok: true,
        guardian: {
          id,
          ...parse.data,
          createdAt: now.toDate().toISOString(),
          updatedAt: now.toDate().toISOString(),
        },
      })
    } catch (error: unknown) {
      console.error('[CHILDREN] Error creating guardian:', error)
      return reply.code(500).send({
        error: 'Failed to create guardian',
        details: error instanceof Error ? error.message : '',
      })
    }
  })

  fastify.patch<{
    Params: { orgId: string; childId: string; guardianId: string }
    Body: z.infer<typeof guardianUpdateSchema>
  }>('/orgs/:orgId/children/:childId/guardians/:guardianId', async (request, reply) => {
    try {
      const { orgId, childId, guardianId } = request.params
      await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const parse = guardianUpdateSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid guardian data', details: parse.error.errors })
      }

      const db = getFirestore()
      try {
        const { updated, now } = await updateGuardian(db, resolvedChildId, guardianId, parse.data)
        return {
          ok: true,
          guardian: {
            id: guardianId,
            ...updated,
            createdAt: updated?.createdAt?.toDate()?.toISOString() ?? null,
            updatedAt: now.toDate().toISOString(),
          },
        }
      } catch (err: unknown) {
        if (err instanceof Error && (err as any).statusCode === 404) {
          return reply.code(404).send({ error: 'Guardian not found' })
        }
        throw err
      }
    } catch (error: unknown) {
      console.error('[CHILDREN] Error updating guardian:', error)
      return reply.code(500).send({
        error: 'Failed to update guardian',
        details: error instanceof Error ? error.message : '',
      })
    }
  })

  fastify.delete<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params
        await requireOrgMember(request, reply, orgId)
        const { uid } = request.user!
        const db = getFirestore()

        const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

        try {
          const { groupsCleaned } = await removeChildFromOrg(db, orgId, resolvedChildId, uid)
          return { ok: true, childId: resolvedChildId, groupsCleaned }
        } catch (err: unknown) {
          if (err instanceof Error && (err as any).statusCode === 404) {
            return reply.code(404).send({ error: 'Child not found in this organization' })
          }
          throw err
        }
      } catch (error: unknown) {
        console.error('[CHILDREN] Error removing child:', error)
        return reply.code(500).send({
          error: 'Failed to remove child',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )

  fastify.delete<{ Params: { orgId: string; childId: string; guardianId: string } }>(
    '/orgs/:orgId/children/:childId/guardians/:guardianId',
    async (request, reply) => {
      try {
        const { orgId, childId, guardianId } = request.params
        await requireOrgMember(request, reply, orgId)
        const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

        const db = getFirestore()
        try {
          await deleteGuardian(db, resolvedChildId, guardianId)
          return { ok: true }
        } catch (err: unknown) {
          if (err instanceof Error && (err as any).statusCode === 404) {
            return reply.code(404).send({ error: 'Guardian not found' })
          }
          throw err
        }
      } catch (error: unknown) {
        console.error('[CHILDREN] Error deleting guardian:', error)
        return reply.code(500).send({
          error: 'Failed to delete guardian',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )
}
