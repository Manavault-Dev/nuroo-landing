import admin from 'firebase-admin'
import type { FastifyPluginAsync } from 'fastify'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgAdmin, requireOrgMember } from '../../shared/guards/index.js'
import { FinikPaymentProvider } from './providers/FinikPaymentProvider.js'

export const providerConfigRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /orgs/:orgId/payment-providers/finik
  fastify.post<{
    Params: { orgId: string }
    Body: { merchantId: string }
  }>(
    '/orgs/:orgId/payment-providers/finik',
    {
      schema: {
        body: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { orgId } = request.params
      await requireOrgAdmin(request, reply, orgId)

      const { merchantId } = request.body

      const provider = new FinikPaymentProvider()
      const validation = await provider.validateConfig({ merchantId })
      if (!validation.valid) {
        return reply.code(400).send({ error: validation.error, code: 'INVALID_CONFIG' })
      }

      const db = getFirestore()
      const now = admin.firestore.FieldValue.serverTimestamp()

      await db.doc(`organizations/${orgId}/paymentProviders/finik`).set({
        enabled: true,
        merchantId,
        updatedAt: now,
        createdBy: request.user!.uid,
      })

      // Log without secrets
      fastify.log.info({
        event: 'payment_provider_configured',
        orgId,
        provider: 'finik',
        configuredBy: request.user!.uid,
      })

      return {
        ok: true,
        provider: { name: 'finik', enabled: true, merchantId },
      }
    }
  )

  // GET /orgs/:orgId/payment-providers
  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/payment-providers',
    async (request, reply) => {
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)

      const db = getFirestore()
      const snap = await db.doc(`organizations/${orgId}/paymentProviders/finik`).get()

      if (!snap.exists) {
        return { ok: true, providers: { finik: { enabled: false } } }
      }

      const data = snap.data()!
      return {
        ok: true,
        providers: {
          finik: {
            enabled: data.enabled === true,
            merchantId: data.merchantId ?? null,
            secretKeySet: data.secretKeySet === true,
            configuredAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
          },
        },
      }
    }
  )
}
