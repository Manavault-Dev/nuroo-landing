import admin from 'firebase-admin'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember, requireChildAccess } from '../../plugins/rbac.js'
import { checkOrgCanAddChild } from '../../modules/payments/planLimits.js'
import type { ChildDetail } from '../../types.js'
import {
  fetchAssignedChildren,
  pickStoredProfileName,
  resolveChildNameFromData,
  resolveChildName,
  fetchChildProgress,
  countCompletedTasks,
  createChildRecord,
  removeChildFromOrg,
  COLLECTIONS,
} from './children.service.js'

export const childrenRecordsRoute: import('fastify').FastifyPluginAsync = async (fastify) => {
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
      fastify.log.error({ err: error }, 'Route handler failed')
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

      fastify.log.info(`[CHILDREN] Fetching children for org=${orgId}, user=${uid}, role=${role}`)

      const db = getFirestore()
      const assignedChildrenSnap = await fetchAssignedChildren(db, orgId, role, uid)
      const childIds = assignedChildrenSnap.docs.map((doc) => doc.id)

      fastify.log.info(`[CHILDREN] Found ${childIds.length} assigned children for user ${uid}`)

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
      fastify.log.error({ err: error }, 'Route handler failed')
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
        fastify.log.error({ err: error }, 'Route handler failed')
        return reply.code(500).send({
          error: 'Failed to fetch child details',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )

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
        fastify.log.error({ err: error }, 'Route handler failed')
        return reply.code(500).send({
          error: 'Failed to remove child',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )
}
