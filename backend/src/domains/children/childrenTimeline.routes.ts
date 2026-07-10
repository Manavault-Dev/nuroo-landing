import admin from 'firebase-admin'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember, requireChildAccess } from '../../infrastructure/auth/rbac.js'
import type { TimelineResponse } from '../../shared/types/domain.js'
import {
  parseTimelineDays,
  buildActivityMap,
  buildFeedbackMap,
  buildTimelineDays,
  COLLECTIONS,
} from './children.service.js'

export const childrenTimelineRoute: import('fastify').FastifyPluginAsync = async (fastify) => {
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
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({
        error: 'Failed to fetch timeline',
        details: error instanceof Error ? error.message : '',
      })
    }
  })
}
