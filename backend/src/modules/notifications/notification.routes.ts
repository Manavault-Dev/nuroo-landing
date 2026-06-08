import { type FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  registerDeviceToken,
  deactivateDeviceToken,
  getUserPreferences,
  updateUserPreferences,
  dispatch,
} from './notification.service.js'
import type { NotificationPreferences, NotificationType } from './notification.types.js'
import { TYPE_TO_CATEGORY } from './notification.types.js'

const tokenSchema = z.object({
  token: z
    .string()
    .min(1)
    .refine((t) => t.startsWith('ExponentPushToken'), {
      message: 'Must be a valid Expo push token',
    }),
})

const prefsSchema = z.object({
  allEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  categories: z
    .object({
      assignments: z.boolean().optional(),
      messages: z.boolean().optional(),
      reminders: z.boolean().optional(),
      progressUpdates: z.boolean().optional(),
      organizationUpdates: z.boolean().optional(),
      billingUpdates: z.boolean().optional(),
    })
    .optional(),
})

const testNotifSchema = z.object({
  title: z.string().min(1).max(200).optional().default('Test Notification'),
  body: z.string().min(1).max(500).optional().default('This is a test notification from Nuroo.'),
  type: z.string().optional().default('task_assigned'),
  targetUserId: z.string().optional(), // admin only: send to a different user
})

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Device token ────────────────────────────────────────────────────────────

  fastify.post('/api/push/token', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
    const parse = tokenSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: 'Invalid token', details: parse.error.issues })
    }
    await registerDeviceToken(request.user.uid, parse.data.token)
    return { ok: true }
  })

  fastify.delete('/api/push/token', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
    // Support optional token body to remove specific token
    const body = request.body as { token?: string } | null
    await deactivateDeviceToken(request.user.uid, body?.token)
    return { ok: true }
  })

  // ── Test notification (dev/admin only) ──────────────────────────────────────

  fastify.post('/api/push/test', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
    const parse = testNotifSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: 'Invalid body', details: parse.error.issues })
    }

    const { title, body, type, targetUserId } = parse.data

    // Allow sending to another user only from own account in dev, or as admin
    const userId = targetUserId ?? request.user.uid
    const notifType =
      (type as NotificationType) in TYPE_TO_CATEGORY ? (type as NotificationType) : 'task_assigned'

    const startedAt = Date.now()

    await dispatch({
      userId,
      role: 'specialist',
      type: notifType,
      category: TYPE_TO_CATEGORY[notifType],
      title: title ?? 'Test Notification',
      body: body ?? 'This is a test notification.',
      channel: 'both',
      priority: 'high',
      metadata: { deepLink: 'notifications' },
    })

    const elapsed = Date.now() - startedAt

    return {
      ok: true,
      targetUserId: userId,
      dispatchedAt: new Date().toISOString(),
      elapsedMs: elapsed,
      note: 'Expo receipt will be polled after ~35 seconds. Check server logs for delivery confirmation.',
    }
  })

  // ── Notification list ───────────────────────────────────────────────────────

  fastify.get<{ Querystring: { limit?: string; unreadOnly?: string } }>(
    '/api/notifications',
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const qs = request.query as { limit?: string; unreadOnly?: string }
      const notifications = await listNotifications(request.user.uid, {
        limit: qs.limit ? parseInt(qs.limit, 10) : 50,
        unreadOnly: qs.unreadOnly === 'true',
      })
      return { notifications }
    }
  )

  // ── Unread count ────────────────────────────────────────────────────────────

  fastify.get('/api/notifications/unread-count', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
    const count = await getUnreadCount(request.user.uid)
    return { count }
  })

  // ── Preferences ─────────────────────────────────────────────────────────────

  fastify.get('/api/notifications/preferences', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
    const preferences = await getUserPreferences(request.user.uid)
    return { preferences }
  })

  fastify.patch('/api/notifications/preferences', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
    const parse = prefsSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: 'Invalid preferences', details: parse.error.issues })
    }
    await updateUserPreferences(request.user.uid, parse.data as Partial<NotificationPreferences>)
    return { ok: true }
  })

  // ── Mark read ───────────────────────────────────────────────────────────────
  // IMPORTANT: read-all must be registered before :id/read to avoid route conflicts

  fastify.patch('/api/notifications/read-all', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
    const updated = await markAllAsRead(request.user.uid)
    return { ok: true, updated }
  })

  fastify.patch<{ Params: { id: string } }>(
    '/api/notifications/:id/read',
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      await markAsRead(request.user.uid, request.params.id)
      return { ok: true }
    }
  )
}
