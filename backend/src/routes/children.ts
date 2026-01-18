import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { getFirestore } from '../firebaseAdmin.js'
import { requireOrgMember, requireChildAssigned } from '../plugins/rbac.js'
import type { ChildSummary, ChildDetail, ActivityDay, TimelineResponse } from '../types.js'

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
      
      console.log('🔍 [CHILDREN] Organization:', orgId)
      console.log('🔍 [CHILDREN] Found childIds from organizations/{orgId}/children (parents connected via invite code):', childIds)
      
      if (childIds.length === 0) {
        console.log('⚠️  [CHILDREN] No children found')
        return []
      }

      const children: ChildSummary[] = []

      for (const childId of childIds) {
        console.log('🔍 [CHILDREN] Processing childId:', childId)
        const childRef = db.doc(`children/${childId}`)
        const childSnap = await childRef.get()
        
        console.log('🔍 [CHILDREN] Child exists in children/{childId}:', childSnap.exists)
        
        let name = 'Unknown'
        let age: number | undefined
        let speechStepId: string | undefined
        let speechStepNumber: number | undefined
        let lastActiveDate: Date | undefined
        let completedTasksCount = 0

        if (childSnap.exists) {
          const childData = childSnap.data()!
          name = childData.name || childData.childName || 'Unknown'
          age = childData.age || childData.childAge
          lastActiveDate = childData.lastActiveDate?.toDate() || childData.updatedAt?.toDate()
          
          console.log('✅ [CHILDREN] Child data from children/{childId}:', { 
            name, 
            age, 
            diagnosis: childData.diagnosis,
            organizationId: childData.organizationId,
            hasData: !!childData
          })

          const progressRef = db.doc(`children/${childId}/progress/speech`)
          const progressSnap = await progressRef.get()
          const progressData = progressSnap.exists ? progressSnap.data() : null
          
          speechStepId = progressData?.currentStepId
          speechStepNumber = progressData?.currentStepNumber

          const tasksRef = db.collection(`children/${childId}/tasks`)
          const tasksSnapshot = await tasksRef.where('status', '==', 'completed').get()
          completedTasksCount = tasksSnapshot.size
        } else {
          console.log('⚠️  [CHILDREN] Child not yet created in children/{childId}, will show as "Unknown"')
          console.log('ℹ️  [CHILDREN] Child will be visible when parent creates child profile in mobile app')
        }

        children.push({
          id: childId,
          name,
          age,
          speechStepId,
          speechStepNumber,
          lastActiveDate,
          completedTasksCount,
        })
      }

      console.log('✅ [CHILDREN] Returning', children.length, 'children')
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

  fastify.get<{ 
    Params: { orgId: string; childId: string }
    Querystring: { days?: string }
  }>(
    '/orgs/:orgId/children/:childId/timeline',
    async (request, reply) => {
      const { orgId, childId } = request.params
      const daysParam = parseInt(request.query.days || '30', 10)
      const days = Math.min(Math.max(daysParam, 7), 90)

      await requireOrgMember(request, reply, orgId)
      await requireChildAssigned(request, reply, orgId, childId)

      const db = getFirestore()
      const now = new Date()
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

      const tasksRef = db.collection(`children/${childId}/tasks`)
      const startTimestamp = admin.firestore.Timestamp.fromDate(startDate)
      const tasksSnapshot = await tasksRef
        .where('updatedAt', '>=', startTimestamp)
        .orderBy('updatedAt', 'desc')
        .get()

      const activityMap = new Map<string, { attempted: number; completed: number }>()

      tasksSnapshot.docs.forEach(doc => {
        const taskData = doc.data()
        const updatedAt = taskData.updatedAt?.toDate() || new Date()
        const dateKey = updatedAt.toISOString().split('T')[0]

        if (!activityMap.has(dateKey)) {
          activityMap.set(dateKey, { attempted: 0, completed: 0 })
        }

        const day = activityMap.get(dateKey)!
        day.attempted++

        if (taskData.status === 'completed') {
          day.completed++
        }
      })

      const feedbackRef = db.collection(`children/${childId}/feedback`)
      const feedbackSnapshot = await feedbackRef
        .where('timestamp', '>=', startTimestamp)
        .get()

      const feedbackMap = new Map<string, { mood: 'good' | 'ok' | 'hard'; comment?: string; timestamp: Date }>()

      feedbackSnapshot.docs.forEach(doc => {
        const feedbackData = doc.data()
        const timestamp = feedbackData.timestamp?.toDate() || new Date()
        const dateKey = timestamp.toISOString().split('T')[0]

        feedbackMap.set(dateKey, {
          mood: feedbackData.mood || 'ok',
          comment: feedbackData.comment,
          timestamp,
        })
      })

      const timelineDays: ActivityDay[] = []
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dateKey = date.toISOString().split('T')[0]
        const activity = activityMap.get(dateKey) || { attempted: 0, completed: 0 }
        const feedback = feedbackMap.get(dateKey)

        timelineDays.push({
          date: dateKey,
          tasksAttempted: activity.attempted,
          tasksCompleted: activity.completed,
          feedback: feedback ? {
            mood: feedback.mood,
            comment: feedback.comment,
            timestamp: feedback.timestamp,
          } : undefined,
        })
      }

      const response: TimelineResponse = { days: timelineDays }
      return response
    }
  )
}
