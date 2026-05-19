import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember, requireChildAccess } from '../../plugins/rbac.js'
import { dispatch } from '../../modules/notifications/index.js'
import {
  listFeedItems,
  createFeedItem,
  getFeedItem,
  updateFeedItem,
  deleteFeedItem,
  listComments,
  createComment,
  markItemsRead,
  migrateSpecialistNotes,
  getAuthorName,
  type ActivityAuthorRole,
  type ActivityVisibility,
  type ActivityFeedItemType,
} from './activity.service.js'

// ── Validation schemas ────────────────────────────────────────────────────────

const FEED_ITEM_TYPES: [ActivityFeedItemType, ...ActivityFeedItemType[]] = [
  'specialist_note',
  'parent_comment',
  'assignment_created',
  'assignment_completed',
  'assignment_reviewed',
  'progress_update',
  'intake_form_completed',
  'system_event',
]

const VISIBILITY_VALUES: [ActivityVisibility, ...ActivityVisibility[]] = [
  'internal',
  'parent_visible',
]

const createFeedItemSchema = z.object({
  type: z.enum(FEED_ITEM_TYPES),
  body: z.string().min(1).max(10000),
  title: z.string().max(500).optional(),
  visibility: z.enum(VISIBILITY_VALUES),
  relatedEntityType: z.enum(['assignment', 'progress', 'note', 'intake_form', 'child']).optional(),
  relatedEntityId: z.string().max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateFeedItemSchema = z.object({
  body: z.string().min(1).max(10000).optional(),
  title: z.string().max(500).optional(),
  visibility: z.enum(VISIBILITY_VALUES).optional(),
})

const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  visibility: z.enum(VISIBILITY_VALUES),
})

const markReadSchema = z.object({
  feedItemIds: z.array(z.string()).min(1).max(100),
})

// ── Route plugin ──────────────────────────────────────────────────────────────

export const activityRoute: FastifyPluginAsync = async (fastify) => {
  // ── GET /orgs/:orgId/children/:childId/feed ─────────────────────────────────
  fastify.get<{
    Params: { orgId: string; childId: string }
    Querystring: { type?: string; visibility?: string; limit?: string; cursor?: string }
  }>('/orgs/:orgId/children/:childId/feed', async (request, reply) => {
    try {
      const { orgId, childId } = request.params

      if (!request.user)
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })

      const member = await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const db = getFirestore()
      void member

      // Check if caller is actually a parent (parent members won't be in org members unless
      // we also allow parent access via child assignment lookup)
      const memberDoc = await db.doc(`organizations/${orgId}/members/${request.user.uid}`).get()
      const memberRole: string = memberDoc.exists
        ? (memberDoc.data()?.role ?? 'specialist')
        : 'parent'

      const effectiveRole: ActivityAuthorRole | 'parent' =
        memberRole === 'org_admin' ? 'admin' : memberRole === 'specialist' ? 'specialist' : 'parent'

      const { type, visibility, limit: limitStr, cursor } = request.query
      const limit = limitStr ? parseInt(limitStr, 10) : 50

      if (isNaN(limit) || limit < 1) {
        return reply.code(400).send({ error: 'Invalid limit parameter', code: 'INVALID_PARAM' })
      }

      const result = await listFeedItems(db, resolvedChildId, orgId, effectiveRole, {
        type: type as ActivityFeedItemType | undefined,
        visibility: visibility as ActivityVisibility | undefined,
        limit,
        cursor,
      })

      return reply.send(result)
    } catch (err: unknown) {
      fastify.log.error({ err }, '[FEED] listFeedItems failed')
      return reply.code(500).send({ error: 'Failed to list feed items', code: 'INTERNAL_ERROR' })
    }
  })

  // ── POST /orgs/:orgId/children/:childId/feed ────────────────────────────────
  fastify.post<{
    Params: { orgId: string; childId: string }
    Body: z.infer<typeof createFeedItemSchema>
  }>('/orgs/:orgId/children/:childId/feed', async (request, reply) => {
    try {
      const { orgId, childId } = request.params

      if (!request.user)
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })

      const member = await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      // Only specialists and admins can create feed items
      if (member.role !== 'org_admin' && member.role !== 'specialist') {
        return reply
          .code(403)
          .send({ error: 'Only specialists and admins can create feed items', code: 'FORBIDDEN' })
      }

      let parsedBody: {
        type: ActivityFeedItemType
        body: string
        title?: string
        visibility: ActivityVisibility
        relatedEntityType?: 'assignment' | 'progress' | 'note' | 'intake_form' | 'child'
        relatedEntityId?: string
        metadata?: Record<string, unknown>
      }
      try {
        parsedBody = createFeedItemSchema.parse(request.body) as typeof parsedBody
      } catch (parseErr: unknown) {
        const msg = parseErr instanceof z.ZodError ? parseErr.message : 'Invalid request body'
        return reply.code(400).send({ error: msg, code: 'VALIDATION_ERROR' })
      }

      const db = getFirestore()
      const { uid, email } = request.user
      const authorRole: ActivityAuthorRole = member.role === 'org_admin' ? 'admin' : 'specialist'
      const authorName = await getAuthorName(db, uid, email, authorRole)

      const item = await createFeedItem(
        db,
        orgId,
        resolvedChildId,
        uid,
        authorRole,
        authorName,
        parsedBody
      )

      // Notify parent when visibility is parent_visible
      if (parsedBody.visibility === 'parent_visible') {
        const orgChildSnap = await db
          .doc(`organizations/${orgId}/children/${resolvedChildId}`)
          .get()
        const parentUserId = orgChildSnap.data()?.parentUserId as string | undefined
        const childName: string = orgChildSnap.data()?.name ?? 'your child'

        if (parentUserId) {
          dispatch({
            userId: parentUserId,
            orgId,
            role: 'parent',
            type: 'progress_update',
            category: 'progressUpdates',
            title: `New update for ${childName}`,
            body: parsedBody.title
              ? `${parsedBody.title}: ${parsedBody.body.slice(0, 80)}`
              : parsedBody.body.slice(0, 120),
            metadata: { childId: resolvedChildId, orgId, specialistId: uid },
            dedupKey: `feed_item_created:${item.id}`,
            channel: 'both',
          }).catch(() => undefined)
        }
      }

      return reply.code(201).send(item)
    } catch (err: unknown) {
      fastify.log.error({ err }, '[FEED] createFeedItem failed')
      return reply.code(500).send({ error: 'Failed to create feed item', code: 'INTERNAL_ERROR' })
    }
  })

  // ── GET /orgs/:orgId/children/:childId/feed/:feedItemId ─────────────────────
  fastify.get<{
    Params: { orgId: string; childId: string; feedItemId: string }
  }>('/orgs/:orgId/children/:childId/feed/:feedItemId', async (request, reply) => {
    try {
      const { orgId, childId, feedItemId } = request.params

      if (!request.user)
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })

      const member = await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const db = getFirestore()
      const item = await getFeedItem(db, resolvedChildId, feedItemId)

      if (!item || item.organizationId !== orgId) {
        return reply.code(404).send({ error: 'Feed item not found', code: 'NOT_FOUND' })
      }

      // Parents can only see parent_visible items
      if (member.role !== 'org_admin' && member.role !== 'specialist') {
        if (item.visibility !== 'parent_visible') {
          return reply.code(403).send({ error: 'Access denied', code: 'FORBIDDEN' })
        }
      }

      return reply.send(item)
    } catch (err: unknown) {
      fastify.log.error({ err }, '[FEED] getFeedItem failed')
      return reply.code(500).send({ error: 'Failed to get feed item', code: 'INTERNAL_ERROR' })
    }
  })

  // ── PATCH /orgs/:orgId/children/:childId/feed/:feedItemId ───────────────────
  fastify.patch<{
    Params: { orgId: string; childId: string; feedItemId: string }
    Body: z.infer<typeof updateFeedItemSchema>
  }>('/orgs/:orgId/children/:childId/feed/:feedItemId', async (request, reply) => {
    try {
      const { orgId, childId, feedItemId } = request.params

      if (!request.user)
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })

      await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const body = updateFeedItemSchema.safeParse(request.body)
      if (!body.success) {
        return reply.code(400).send({ error: body.error.message, code: 'VALIDATION_ERROR' })
      }

      const db = getFirestore()
      const existing = await getFeedItem(db, resolvedChildId, feedItemId)

      if (!existing || existing.organizationId !== orgId) {
        return reply.code(404).send({ error: 'Feed item not found', code: 'NOT_FOUND' })
      }

      // Only the author can edit
      if (existing.authorId !== request.user.uid) {
        return reply
          .code(403)
          .send({ error: 'Only the author can edit this item', code: 'FORBIDDEN' })
      }

      const updated = await updateFeedItem(db, resolvedChildId, feedItemId, body.data)
      return reply.send(updated)
    } catch (err: unknown) {
      fastify.log.error({ err }, '[FEED] updateFeedItem failed')
      return reply.code(500).send({ error: 'Failed to update feed item', code: 'INTERNAL_ERROR' })
    }
  })

  // ── DELETE /orgs/:orgId/children/:childId/feed/:feedItemId ──────────────────
  fastify.delete<{
    Params: { orgId: string; childId: string; feedItemId: string }
  }>('/orgs/:orgId/children/:childId/feed/:feedItemId', async (request, reply) => {
    try {
      const { orgId, childId, feedItemId } = request.params

      if (!request.user)
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })

      const member = await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const db = getFirestore()
      const existing = await getFeedItem(db, resolvedChildId, feedItemId)

      if (!existing || existing.organizationId !== orgId) {
        return reply.code(404).send({ error: 'Feed item not found', code: 'NOT_FOUND' })
      }

      // Author or admin can delete
      const isAdmin = member.role === 'org_admin'
      const isAuthor = existing.authorId === request.user.uid

      if (!isAdmin && !isAuthor) {
        return reply
          .code(403)
          .send({ error: 'Only the author or an admin can delete this item', code: 'FORBIDDEN' })
      }

      await deleteFeedItem(db, resolvedChildId, feedItemId)
      return reply.code(204).send()
    } catch (err: unknown) {
      fastify.log.error({ err }, '[FEED] deleteFeedItem failed')
      return reply.code(500).send({ error: 'Failed to delete feed item', code: 'INTERNAL_ERROR' })
    }
  })

  // ── GET /orgs/:orgId/children/:childId/feed/:feedItemId/comments ─────────────
  fastify.get<{
    Params: { orgId: string; childId: string; feedItemId: string }
  }>('/orgs/:orgId/children/:childId/feed/:feedItemId/comments', async (request, reply) => {
    try {
      const { orgId, childId, feedItemId } = request.params

      if (!request.user)
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })

      const member = await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const db = getFirestore()
      const feedItem = await getFeedItem(db, resolvedChildId, feedItemId)
      if (!feedItem || feedItem.organizationId !== orgId) {
        return reply.code(404).send({ error: 'Feed item not found', code: 'NOT_FOUND' })
      }

      const memberDoc = await db.doc(`organizations/${orgId}/members/${request.user.uid}`).get()
      const memberRole: string = memberDoc.exists
        ? (memberDoc.data()?.role ?? 'specialist')
        : 'parent'

      const effectiveRole: ActivityAuthorRole | 'parent' =
        memberRole === 'org_admin' ? 'admin' : memberRole === 'specialist' ? 'specialist' : 'parent'

      // Suppress unused variable warning — member is used for RBAC check above
      void member

      const comments = await listComments(db, resolvedChildId, feedItemId, effectiveRole)
      return reply.send(comments)
    } catch (err: unknown) {
      fastify.log.error({ err }, '[FEED] listComments failed')
      return reply.code(500).send({ error: 'Failed to list comments', code: 'INTERNAL_ERROR' })
    }
  })

  // ── POST /orgs/:orgId/children/:childId/feed/:feedItemId/comments ────────────
  fastify.post<{
    Params: { orgId: string; childId: string; feedItemId: string }
    Body: z.infer<typeof createCommentSchema>
  }>('/orgs/:orgId/children/:childId/feed/:feedItemId/comments', async (request, reply) => {
    try {
      const { orgId, childId, feedItemId } = request.params

      if (!request.user)
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })

      const member = await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const body = createCommentSchema.safeParse(request.body)
      if (!body.success) {
        return reply.code(400).send({ error: body.error.message, code: 'VALIDATION_ERROR' })
      }

      const db = getFirestore()
      const feedItem = await getFeedItem(db, resolvedChildId, feedItemId)
      if (!feedItem || feedItem.organizationId !== orgId) {
        return reply.code(404).send({ error: 'Feed item not found', code: 'NOT_FOUND' })
      }

      const { uid, email } = request.user
      const authorRole: 'parent' | 'specialist' | 'admin' =
        member.role === 'org_admin' ? 'admin' : 'specialist'

      const authorName = await getAuthorName(db, uid, email, authorRole)

      const comment = await createComment(
        db,
        resolvedChildId,
        feedItemId,
        orgId,
        uid,
        authorRole,
        authorName,
        body.data.body,
        body.data.visibility
      )

      // Notify relevant parties
      const orgChildSnap = await db.doc(`organizations/${orgId}/children/${resolvedChildId}`).get()
      const parentUserId = orgChildSnap.data()?.parentUserId as string | undefined
      const childName: string = orgChildSnap.data()?.name ?? 'your child'

      if (
        (authorRole === 'specialist' || authorRole === 'admin') &&
        body.data.visibility === 'parent_visible' &&
        parentUserId
      ) {
        // Specialist/admin commented, visible to parent — notify parent
        dispatch({
          userId: parentUserId,
          orgId,
          role: 'parent',
          type: 'progress_update',
          category: 'progressUpdates',
          title: `New comment about ${childName}`,
          body: body.data.body.slice(0, 120),
          metadata: { childId: resolvedChildId, orgId, specialistId: uid },
          dedupKey: `feed_comment_specialist:${comment.id}`,
          channel: 'both',
        }).catch(() => undefined)
      }

      return reply.code(201).send(comment)
    } catch (err: unknown) {
      fastify.log.error({ err }, '[FEED] createComment failed')
      return reply.code(500).send({ error: 'Failed to create comment', code: 'INTERNAL_ERROR' })
    }
  })

  // ── PATCH /orgs/:orgId/children/:childId/feed/read ──────────────────────────
  fastify.patch<{
    Params: { orgId: string; childId: string }
    Body: z.infer<typeof markReadSchema>
  }>('/orgs/:orgId/children/:childId/feed/read', async (request, reply) => {
    try {
      const { orgId, childId } = request.params

      if (!request.user)
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })

      await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const body = markReadSchema.safeParse(request.body)
      if (!body.success) {
        return reply.code(400).send({ error: body.error.message, code: 'VALIDATION_ERROR' })
      }

      const db = getFirestore()
      await markItemsRead(db, resolvedChildId, body.data.feedItemIds, request.user.uid)

      return reply.send({ marked: body.data.feedItemIds.length })
    } catch (err: unknown) {
      fastify.log.error({ err }, '[FEED] markItemsRead failed')
      return reply.code(500).send({ error: 'Failed to mark items as read', code: 'INTERNAL_ERROR' })
    }
  })

  // ── POST /orgs/:orgId/children/:childId/feed/migrate-notes ──────────────────
  fastify.post<{
    Params: { orgId: string; childId: string }
  }>('/orgs/:orgId/children/:childId/feed/migrate-notes', async (request, reply) => {
    try {
      const { orgId, childId } = request.params

      if (!request.user)
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })

      const member = await requireOrgMember(request, reply, orgId)

      // Only admins can trigger migrations
      if (member.role !== 'org_admin') {
        return reply
          .code(403)
          .send({ error: 'Only admins can trigger note migration', code: 'FORBIDDEN' })
      }

      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)
      const db = getFirestore()

      const migrated = await migrateSpecialistNotes(db, orgId, resolvedChildId)
      return reply.send({ migrated })
    } catch (err: unknown) {
      fastify.log.error({ err }, '[FEED] migrateSpecialistNotes failed')
      return reply.code(500).send({ error: 'Failed to migrate notes', code: 'INTERNAL_ERROR' })
    }
  })
}
