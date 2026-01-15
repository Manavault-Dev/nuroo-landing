import { FastifyPluginAsync } from 'fastify'
import { getFirestore } from '../firebaseAdmin.js'
import { requireOrgMember, requireChildAssigned } from '../plugins/rbac.js'
import type { ChildSummary, ChildDetail } from '../types.js'

export const childrenRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/children',
    async (request, reply) => {
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)

      const db = getFirestore()
      const orgChildrenRef = db.collection(`organizations/${orgId}/children`)
      const assignedChildrenSnap = await orgChildrenRef.where('assigned', '==', true).get()
      const childIds = assignedChildrenSnap.docs.map(doc => doc.id)
      
      if (childIds.length === 0) return []

      const children: ChildSummary[] = []

      for (const childId of childIds) {
        const childRef = db.doc(`children/${childId}`)
        const childSnap = await childRef.get()
        if (!childSnap.exists) continue

        const childData = childSnap.data()!
        const progressRef = db.doc(`children/${childSnap.id}/progress/speech`)
        const progressSnap = await progressRef.get()
        const progressData = progressSnap.exists ? progressSnap.data() : null

        const tasksRef = db.collection(`children/${childSnap.id}/tasks`)
        const tasksSnapshot = await tasksRef.where('status', '==', 'completed').get()

        children.push({
          id: childSnap.id,
          name: childData.name || 'Unknown',
          age: childData.age,
          speechStepId: progressData?.currentStepId,
          speechStepNumber: progressData?.currentStepNumber,
          lastActiveDate: childData.lastActiveDate?.toDate(),
          completedTasksCount: tasksSnapshot.size,
        })
      }

      return children
    }
  )

  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId',
    async (request, reply) => {
      const { orgId, childId } = request.params

      await requireOrgMember(request, reply, orgId)
      await requireChildAssigned(request, reply, orgId, childId)

      const db = getFirestore()
      const childRef = db.doc(`children/${childId}`)
      const childSnap = await childRef.get()

      if (!childSnap.exists) {
        return reply.code(404).send({ error: 'Child not found' })
      }

      const childData = childSnap.data()!
      const progressRef = db.doc(`children/${childId}/progress/speech`)
      const progressSnap = await progressRef.get()
      const progressData = progressSnap.exists ? progressSnap.data() : null

      const tasksRef = db.collection(`children/${childId}/tasks`)
      const tasksSnapshot = await tasksRef.orderBy('updatedAt', 'desc').limit(10).get()

      const recentTasks = tasksSnapshot.docs.map(doc => {
        const taskData = doc.data()
        return {
          id: doc.id,
          title: taskData.title || 'Untitled Task',
          status: taskData.status || 'pending',
          completedAt: taskData.completedAt?.toDate(),
        }
      })

      const completedTasksSnapshot = await tasksRef.where('status', '==', 'completed').get()

      const detail: ChildDetail = {
        id: childSnap.id,
        name: childData.name || 'Unknown',
        age: childData.age,
        organizationId: childData.organizationId || orgId,
        speechStepId: progressData?.currentStepId,
        speechStepNumber: progressData?.currentStepNumber,
        lastActiveDate: childData.lastActiveDate?.toDate(),
        completedTasksCount: completedTasksSnapshot.size,
        recentTasks,
      }

      return detail
    }
  )
}
