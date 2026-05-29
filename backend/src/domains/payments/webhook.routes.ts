import crypto from 'crypto'
import admin from 'firebase-admin'
import type { FastifyPluginAsync } from 'fastify'
import * as Sentry from '@sentry/node'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { config } from '../../config/index.js'
import { updateInvoiceStatus } from './invoice.service.js'
import type { PaymentStatus } from './providers/PaymentProvider.interface.js'

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /webhooks/finik — NO Firebase auth, called by Finik servers
  fastify.post(
    '/webhooks/finik',
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody
      const bodyStr = rawBody
        ? rawBody.toString('utf8')
        : typeof request.body === 'string'
          ? request.body
          : JSON.stringify(request.body)

      const headers = request.headers as Record<string, string>
      const receivedSig = headers['x-signature'] || headers['x-webhook-signature'] || ''
      const secret = config.FINIK_WEBHOOK_SECRET || ''

      // Verify HMAC-SHA256 signature
      if (secret) {
        const expectedSig = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex')
        let sigValid = false
        try {
          const receivedBuf = Buffer.from(receivedSig, 'hex')
          const expectedBuf = Buffer.from(expectedSig, 'hex')
          sigValid =
            receivedBuf.length === expectedBuf.length &&
            crypto.timingSafeEqual(receivedBuf, expectedBuf)
        } catch {
          sigValid = false
        }

        if (!sigValid) {
          fastify.log.warn({ event: 'finik_webhook_invalid_signature' })
          Sentry.captureMessage('finik_webhook_invalid_signature', {
            level: 'warning',
            extra: { ip: request.ip },
          })
          return reply
            .code(400)
            .send({ error: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' })
        }
      }

      let payload: Record<string, unknown>
      try {
        payload =
          typeof request.body === 'object' && request.body !== null
            ? (request.body as Record<string, unknown>)
            : JSON.parse(bodyStr)
      } catch {
        return reply.code(400).send({ error: 'Invalid JSON payload', code: 'INVALID_PAYLOAD' })
      }

      const rawRef = (payload.reference as string | undefined) || ''
      const rawPaymentId =
        (payload.PaymentId as string | undefined) || (payload.paymentId as string | undefined) || ''

      // Reference is encoded as `${orgId}__${invoiceId}` by FinikPaymentProvider
      let invoiceId = rawPaymentId
      let orgId = (payload.orgId as string | undefined) || ''
      if (rawRef.includes('__')) {
        const sep = rawRef.indexOf('__')
        orgId = rawRef.slice(0, sep)
        invoiceId = rawRef.slice(sep + 2)
      } else if (rawRef) {
        invoiceId = rawRef
      }

      const transactionId =
        (payload.transactionId as string | undefined) || rawPaymentId || invoiceId
      const rawStatus =
        (payload.status as string | undefined) || (payload.Status as string | undefined) || ''

      fastify.log.info({ event: 'finik_webhook_received', invoiceId, orgId })

      if (!invoiceId) {
        return reply.code(200).send({ ok: true, skipped: 'no invoiceId' })
      }

      const db = getFirestore()

      // Idempotency check — prevent double-processing
      const eventDocRef = db.doc(`finikWebhookEvents/${transactionId}`)
      const eventSnap = await eventDocRef.get()
      if (eventSnap.exists) {
        return reply.code(200).send({ ok: true, idempotent: true })
      }

      // Mark as processing before updating invoice
      await eventDocRef.set({
        transactionId,
        invoiceId,
        orgId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Determine status
      const status = mapStatus(rawStatus)
      const paidAt = status === 'paid' ? new Date() : undefined

      // If orgId is present, update via full service; else try to find org from invoice
      if (orgId) {
        try {
          await updateInvoiceStatus(db, orgId, invoiceId, status, paidAt)
        } catch {
          // Invoice might not exist in this org — log and continue
          fastify.log.warn({ event: 'finik_webhook_invoice_update_failed', invoiceId, orgId })
        }
      } else {
        // Try to find orgId by querying invoice by providerPaymentId (best-effort)
        fastify.log.warn({ event: 'finik_webhook_no_orgid', invoiceId })
      }

      return reply.code(200).send({ ok: true })
    }
  )
}

function mapStatus(raw: string): PaymentStatus {
  const s = raw.toLowerCase()
  if (s === 'completed' || s === 'success' || s === 'paid') return 'paid'
  if (s === 'failed' || s === 'error' || s === 'declined') return 'failed'
  if (s === 'expired') return 'expired'
  if (s === 'canceled' || s === 'cancelled') return 'canceled'
  return 'pending'
}
