import admin from 'firebase-admin'
import type { FastifyPluginAsync } from 'fastify'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgAdmin } from '../../shared/guards/index.js'
import { checkOrgHasFeature } from '../../modules/payments/planLimits.js'
import {
  createBillingProfile,
  getBillingProfile,
  listBillingProfiles,
  updateBillingProfile,
} from './billingProfile.service.js'
import {
  generateMonthlyInvoicesForOrg,
  markOverdueInvoicesForOrg,
} from './invoiceGeneration.service.js'

export const billingProfileRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /orgs/:orgId/billing/profiles
  fastify.get<{ Params: { orgId: string }; Querystring: { childId?: string; status?: string } }>(
    '/orgs/:orgId/billing/profiles',
    async (request, reply) => {
      await requireOrgAdmin(request, reply, request.params.orgId)
      const db = getFirestore()
      const { childId, status } = request.query
      const profiles = await listBillingProfiles(db, request.params.orgId, {
        childId,
        status: status as 'active' | 'paused' | 'canceled' | undefined,
      })
      return { profiles }
    }
  )

  // POST /orgs/:orgId/billing/profiles
  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/billing/profiles',
    {
      schema: {
        body: {
          type: 'object',
          required: ['childId', 'parentId', 'amount', 'currency', 'billingCycle', 'dueDayOfMonth'],
          properties: {
            childId: { type: 'string', minLength: 1 },
            parentId: { type: 'string', minLength: 1 },
            amount: { type: 'number', exclusiveMinimum: 0 },
            currency: { type: 'string', enum: ['KGS'] },
            billingCycle: { type: 'string', enum: ['monthly'] },
            dueDayOfMonth: { type: 'integer', minimum: 1, maximum: 28 },
            note: { type: 'string', maxLength: 500 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      await requireOrgAdmin(request, reply, request.params.orgId)
      const db = getFirestore()
      const body = request.body as {
        childId: string
        parentId: string
        amount: number
        currency: 'KGS'
        billingCycle: 'monthly'
        dueDayOfMonth: number
        note?: string
      }
      const user = (request as unknown as { user: { uid: string } }).user
      const orgId = request.params.orgId
      let profile
      try {
        profile = await createBillingProfile(db, orgId, body, user.uid)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg === 'DUPLICATE_BILLING_PROFILE') {
          return reply.status(409).send({
            error: 'An active or paused billing plan already exists for this child',
            code: 'DUPLICATE_BILLING_PROFILE',
          })
        }
        return reply.status(500).send({ error: msg, code: 'INTERNAL_ERROR' })
      }
      fastify.log.info({ event: 'child_billing_profile_created', orgId, profileId: profile.id })

      // Auto-create an upcoming invoice so the parent sees it immediately in the app.
      // The invoice will be upgraded to 'pending' (with Finik paymentUrl) when
      // generate-monthly-invoices runs on or after the due date.
      try {
        const nextDate = profile.nextInvoiceDate
        const periodStart = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1)
        const periodEnd = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0)
        const periodStartISO = periodStart.toISOString().split('T')[0]
        const periodEndISO = periodEnd.toISOString().split('T')[0]
        const dueDateISO = nextDate.toISOString().split('T')[0]
        const monthLabel = nextDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
        const invoiceRef = db.collection(`organizations/${orgId}/invoices`).doc()
        const nowTs = admin.firestore.FieldValue.serverTimestamp()
        await invoiceRef.set({
          orgId,
          parentId: body.parentId,
          childId: body.childId,
          amount: body.amount,
          currency: body.currency,
          description: `Ежемесячный платёж — ${monthLabel}`,
          dueDate: dueDateISO,
          status: 'upcoming',
          billingProfileId: profile.id,
          periodStart: periodStartISO,
          periodEnd: periodEndISO,
          provider: 'finik',
          createdBy: user.uid,
          createdAt: nowTs,
          updatedAt: nowTs,
        })
      } catch (err) {
        fastify.log.warn({
          event: 'auto_upcoming_invoice_failed',
          profileId: profile.id,
          err: String(err),
        })
      }

      return reply.status(201).send({ profile })
    }
  )

  // GET /orgs/:orgId/billing/profiles/:profileId
  fastify.get<{ Params: { orgId: string; profileId: string } }>(
    '/orgs/:orgId/billing/profiles/:profileId',
    async (request, reply) => {
      await requireOrgAdmin(request, reply, request.params.orgId)
      const db = getFirestore()
      const profile = await getBillingProfile(db, request.params.orgId, request.params.profileId)
      if (!profile) {
        return reply
          .status(404)
          .send({ error: 'Billing profile not found', code: 'PROFILE_NOT_FOUND' })
      }
      return { profile }
    }
  )

  // PATCH /orgs/:orgId/billing/profiles/:profileId
  fastify.patch<{ Params: { orgId: string; profileId: string } }>(
    '/orgs/:orgId/billing/profiles/:profileId',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            amount: { type: 'number', exclusiveMinimum: 0 },
            dueDayOfMonth: { type: 'integer', minimum: 1, maximum: 28 },
            status: { type: 'string', enum: ['active', 'paused', 'canceled'] },
            note: { type: 'string', maxLength: 500 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      await requireOrgAdmin(request, reply, request.params.orgId)
      const db = getFirestore()
      const body = request.body as {
        amount?: number
        dueDayOfMonth?: number
        status?: 'active' | 'paused' | 'canceled'
        note?: string
      }
      try {
        const profile = await updateBillingProfile(
          db,
          request.params.orgId,
          request.params.profileId,
          body
        )
        fastify.log.info({
          event: 'child_billing_profile_updated',
          orgId: request.params.orgId,
          profileId: profile.id,
        })
        return { profile }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg === 'Billing profile not found') {
          return reply.status(404).send({ error: msg, code: 'PROFILE_NOT_FOUND' })
        }
        return reply.status(500).send({ error: msg, code: 'INTERNAL_ERROR' })
      }
    }
  )

  // POST /orgs/:orgId/billing/generate-monthly-invoices
  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/billing/generate-monthly-invoices',
    async (request, reply) => {
      await requireOrgAdmin(request, reply, request.params.orgId)
      const featureCheck = await checkOrgHasFeature(request.params.orgId, 'finance')
      if (!featureCheck.ok) {
        return reply.status(403).send({ error: featureCheck.error, code: 'PLAN_UPGRADE_REQUIRED' })
      }
      const db = getFirestore()
      try {
        const result = await generateMonthlyInvoicesForOrg(db, request.params.orgId)
        return { ok: true, result }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ error: msg, code: 'INTERNAL_ERROR' })
      }
    }
  )

  // POST /orgs/:orgId/billing/mark-overdue
  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/billing/mark-overdue',
    async (request, reply) => {
      await requireOrgAdmin(request, reply, request.params.orgId)
      const featureCheck = await checkOrgHasFeature(request.params.orgId, 'finance')
      if (!featureCheck.ok) {
        return reply.status(403).send({ error: featureCheck.error, code: 'PLAN_UPGRADE_REQUIRED' })
      }
      const db = getFirestore()
      try {
        const result = await markOverdueInvoicesForOrg(db, request.params.orgId)
        return { ok: true, result }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ error: msg, code: 'INTERNAL_ERROR' })
      }
    }
  )
}
