/**
 * Waitlist routes for full cohorts.
 *
 * POST /orgs/:orgId/cohorts/:cohortId/waitlist           → parent joins waitlist
 * GET  /orgs/:orgId/cohorts/:cohortId/waitlist           → admin views waitlist
 * DELETE /orgs/:orgId/cohorts/:cohortId/waitlist/:entryId → admin removes entry
 * POST /orgs/:orgId/cohorts/:cohortId/waitlist/:entryId/notify → admin notifies a waiting parent
 *
 * Also:
 * GET /marketplace/orgs/:orgId/cohorts/:cohortId/waitlist/check → is current user on waitlist?
 * DELETE /marketplace/orgs/:orgId/cohorts/:cohortId/waitlist/leave → leave waitlist
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import type { WaitlistDoc } from '../booking/types.js'
import { dispatch as pushDispatch } from '../../modules/notifications/notification.service.js'

const RATE = { max: 30, timeWindow: '1 minute' }
const RATE_READ = { max: 120, timeWindow: '1 minute' }

const joinSchema = z.object({
  parentName: z.string().trim().max(200).default(''),
  childName: z.string().trim().max(200),
  phone: z.string().trim().max(30).nullable().optional(),
})

function col(orgId: string, cohortId: string) {
  return `organizations/${orgId}/cohorts/${cohortId}/waitlist`
}

export const cohortsWaitlistRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  /**
   * POST /marketplace/orgs/:orgId/cohorts/:cohortId/waitlist/join
   * Authenticated parent joins the waitlist for a full cohort.
   */
  fastify.post<{ Params: { orgId: string; cohortId: string } }>(
    '/marketplace/orgs/:orgId/cohorts/:cohortId/waitlist/join',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, cohortId } = request.params
      const parentId = request.user.uid

      // Idempotent — check if already on waitlist
      const existing = await db
        .collection(col(orgId, cohortId))
        .where('parentId', '==', parentId)
        .where('status', 'in', ['waiting', 'notified'])
        .limit(1)
        .get()

      if (!existing.empty) {
        return reply
          .code(200)
          .send({ ok: true, alreadyWaiting: true, entryId: existing.docs[0].id })
      }

      const parse = joinSchema.safeParse(request.body)
      if (!parse.success)
        return reply.code(400).send({ error: 'Invalid input', issues: parse.error.issues })

      const id = randomUUID()
      const doc: WaitlistDoc = {
        cohortId,
        orgId,
        parentId,
        parentName: parse.data.parentName,
        childName: parse.data.childName,
        phone: parse.data.phone ?? null,
        addedAt: new Date().toISOString(),
        notifiedAt: null,
        status: 'waiting',
      }

      await db.doc(`${col(orgId, cohortId)}/${id}`).set(doc)

      // Also mirror in userWaitlist for fast parent-facing queries
      await db.doc(`userWaitlist/${parentId}/entries/${cohortId}`).set({ ...doc, entryId: id })

      return reply.code(201).send({ ok: true, entryId: id })
    }
  )

  /**
   * GET /marketplace/orgs/:orgId/cohorts/:cohortId/waitlist/check
   * Returns whether the current user is on the waitlist.
   */
  fastify.get<{ Params: { orgId: string; cohortId: string } }>(
    '/marketplace/orgs/:orgId/cohorts/:cohortId/waitlist/check',
    { config: { rateLimit: RATE_READ } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { cohortId } = request.params
      const parentId = request.user.uid

      const snap = await db.doc(`userWaitlist/${parentId}/entries/${cohortId}`).get()
      return {
        ok: true,
        waiting: snap.exists && (snap.data() as WaitlistDoc)?.status === 'waiting',
      }
    }
  )

  /**
   * DELETE /marketplace/orgs/:orgId/cohorts/:cohortId/waitlist/leave
   * Parent leaves the waitlist.
   */
  fastify.delete<{ Params: { orgId: string; cohortId: string } }>(
    '/marketplace/orgs/:orgId/cohorts/:cohortId/waitlist/leave',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, cohortId } = request.params
      const parentId = request.user.uid

      const snap = await db
        .collection(col(orgId, cohortId))
        .where('parentId', '==', parentId)
        .limit(1)
        .get()

      if (!snap.empty) {
        await db.doc(`${col(orgId, cohortId)}/${snap.docs[0].id}`).update({ status: 'expired' })
      }
      await db.doc(`userWaitlist/${parentId}/entries/${cohortId}`).delete()

      return { ok: true }
    }
  )

  /**
   * GET /orgs/:orgId/cohorts/:cohortId/waitlist — org admin views full waitlist
   */
  fastify.get<{ Params: { orgId: string; cohortId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/waitlist',
    { config: { rateLimit: RATE_READ } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, cohortId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })

      const snap = await db
        .collection(col(orgId, cohortId))
        .where('status', 'in', ['waiting', 'notified'])
        .orderBy('addedAt', 'asc')
        .get()

      const entries = snap.docs.map((d) => ({ id: d.id, ...(d.data() as WaitlistDoc) }))
      return { ok: true, entries, count: entries.length }
    }
  )

  /**
   * POST /orgs/:orgId/cohorts/:cohortId/waitlist/:entryId/notify
   * Admin notifies a waiting parent that a spot is available.
   */
  fastify.post<{ Params: { orgId: string; cohortId: string; entryId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/waitlist/:entryId/notify',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, cohortId, entryId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })

      const ref = db.doc(`${col(orgId, cohortId)}/${entryId}`)
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Waitlist entry not found' })

      const entry = snap.data() as WaitlistDoc
      const now = new Date().toISOString()

      await ref.update({ status: 'notified', notifiedAt: now })

      // Send push notification to parent
      await pushDispatch({
        userId: entry.parentId,
        orgId,
        role: 'parent',
        type: 'cohort_enrollment_confirmed', // closest type — "spot opened"
        category: 'reminders',
        title: '🎉 Место освободилось!',
        body: `В группе появилось свободное место. Запишитесь, пока оно доступно.`,
        metadata: { orgId, deepLink: `/marketplace/${orgId}/courses/${cohortId}` },
        channel: 'both',
        dedupKey: `waitlist_notify:${cohortId}:${entry.parentId}:${now.slice(0, 10)}`,
      })

      return { ok: true }
    }
  )

  /**
   * DELETE /orgs/:orgId/cohorts/:cohortId/waitlist/:entryId — admin removes entry
   */
  fastify.delete<{ Params: { orgId: string; cohortId: string; entryId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/waitlist/:entryId',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, cohortId, entryId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })

      const snap = await db.doc(`${col(orgId, cohortId)}/${entryId}`).get()
      if (!snap.exists) return reply.code(404).send({ error: 'Waitlist entry not found' })

      await db.doc(`${col(orgId, cohortId)}/${entryId}`).update({ status: 'expired' })
      return { ok: true }
    }
  )
}
