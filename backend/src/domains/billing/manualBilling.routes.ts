import type { FastifyPluginAsync } from 'fastify'
import * as Sentry from '@sentry/node'
import admin from 'firebase-admin'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requirePlatformAdmin } from '../../shared/guards/index.js'
import { PLAN_IDS, type PlanId } from '../../modules/payments/planLimits.js'

function parseActiveUntil(dateStr: string): Date | null {
  const d = new Date(dateStr + 'T23:59:59Z')
  return isNaN(d.getTime()) ? null : d
}

export const manualBillingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Params: { orgId: string }
    Body: { plan: PlanId; activeUntil: string; note?: string }
  }>(
    '/orgs/:orgId/billing/manual-activate',
    {
      schema: {
        body: {
          type: 'object',
          required: ['plan', 'activeUntil'],
          properties: {
            plan: { type: 'string', enum: [...PLAN_IDS] },
            activeUntil: { type: 'string', format: 'date' },
            note: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      await requirePlatformAdmin(request, reply)

      const { orgId } = request.params
      const { plan, activeUntil, note } = request.body

      const activeUntilDate = parseActiveUntil(activeUntil)
      if (!activeUntilDate) {
        return reply.code(400).send({ error: 'Invalid activeUntil date', code: 'INVALID_DATE' })
      }
      if (activeUntilDate <= new Date()) {
        return reply.code(400).send({ error: 'activeUntil must be a future date', code: 'PAST_DATE' })
      }

      const db = getFirestore()
      const orgSnap = await db.collection('organizations').doc(orgId).get()
      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found', code: 'ORG_NOT_FOUND' })
      }

      const now = admin.firestore.Timestamp.now()
      const currentPeriodEnd = admin.firestore.Timestamp.fromDate(activeUntilDate)

      await db.collection('organizations').doc(orgId).set(
        { billing: { status: 'manual_active', provider: 'manual', plan, currentPeriodEnd, updatedAt: now } },
        { merge: true },
      )

      await db.collection('organizations').doc(orgId).collection('billingAuditLog').add({
        event: 'billing_manual_activated',
        plan,
        activeUntil: currentPeriodEnd,
        note: note ?? null,
        activatedBy: request.user?.uid ?? 'platform_admin',
        createdAt: now,
      })

      fastify.log.info({ event: 'billing_manual_activated', orgId, plan, activeUntil })
      Sentry.addBreadcrumb({ category: 'billing', message: 'billing_manual_activated', level: 'info', data: { orgId, plan, activeUntil } })

      return reply.code(200).send({ ok: true, status: 'manual_active', plan, currentPeriodEnd })
    },
  )

  fastify.post<{
    Params: { orgId: string }
    Body: { activeUntil: string; note?: string }
  }>(
    '/orgs/:orgId/billing/manual-extend',
    {
      schema: {
        body: {
          type: 'object',
          required: ['activeUntil'],
          properties: {
            activeUntil: { type: 'string', format: 'date' },
            note: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      await requirePlatformAdmin(request, reply)

      const { orgId } = request.params
      const { activeUntil, note } = request.body

      const activeUntilDate = parseActiveUntil(activeUntil)
      if (!activeUntilDate) {
        return reply.code(400).send({ error: 'Invalid activeUntil date', code: 'INVALID_DATE' })
      }
      if (activeUntilDate <= new Date()) {
        return reply.code(400).send({ error: 'activeUntil must be a future date', code: 'PAST_DATE' })
      }

      const db = getFirestore()
      const orgSnap = await db.collection('organizations').doc(orgId).get()
      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found', code: 'ORG_NOT_FOUND' })
      }

      const now = admin.firestore.Timestamp.now()
      const currentPeriodEnd = admin.firestore.Timestamp.fromDate(activeUntilDate)

      await db.collection('organizations').doc(orgId).set(
        { billing: { status: 'manual_active', currentPeriodEnd, updatedAt: now } },
        { merge: true },
      )

      await db.collection('organizations').doc(orgId).collection('billingAuditLog').add({
        event: 'billing_manual_extended',
        activeUntil: currentPeriodEnd,
        note: note ?? null,
        extendedBy: request.user?.uid ?? 'platform_admin',
        createdAt: now,
      })

      fastify.log.info({ event: 'billing_manual_extended', orgId, activeUntil })
      Sentry.addBreadcrumb({ category: 'billing', message: 'billing_manual_extended', level: 'info', data: { orgId, activeUntil } })

      return reply.code(200).send({ ok: true, status: 'manual_active', currentPeriodEnd })
    },
  )
}
