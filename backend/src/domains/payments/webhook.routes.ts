import crypto from 'crypto'
import admin from 'firebase-admin'
import type { FastifyPluginAsync } from 'fastify'
import * as Sentry from '@sentry/node'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { config } from '../../config/index.js'
import { updateInvoiceStatus } from './invoice.service.js'
import type { PaymentStatus } from './providers/PaymentProvider.interface.js'
import {
  grantCourseEntitlement,
  createEnrollmentFromEntitlement,
  publicCoursePayload,
} from '../../domains/courses/courseAccess.service.js'
import type { CourseDoc } from '../../domains/courses/courses.types.js'

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

      // Course payment: reference = course__orgId__courseId__userId
      if (rawRef.startsWith('course__')) {
        const parts = rawRef.split('__')
        if (parts.length === 4) {
          const [, courseOrgId, courseId, userId] = parts
          try {
            await handleCoursePayment(
              db,
              courseOrgId,
              courseId,
              userId,
              invoiceId,
              status,
              fastify.log
            )
          } catch (err) {
            fastify.log.error({ event: 'course_payment_webhook_error', err: String(err) })
          }
        }
        return reply.code(200).send({ ok: true })
      }

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

async function handleCoursePayment(
  db: ReturnType<typeof getFirestore>,
  orgId: string,
  courseId: string,
  userId: string,
  paymentId: string,
  status: PaymentStatus,
  log: { info: (o: object) => void; warn: (o: object) => void }
) {
  const paymentRef = db.collection('coursePayments').doc(paymentId)
  await paymentRef.set(
    {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(status === 'paid' ? { paidAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  )

  if (status !== 'paid') return

  // Check not already enrolled (idempotent)
  const enrollSnap = await db
    .doc(`organizations/${orgId}/courses/${courseId}/enrollments/${userId}`)
    .get()
  if (enrollSnap.exists) {
    log.info({ event: 'course_payment_already_enrolled', orgId, courseId, userId })
    return
  }

  const courseSnap = await db.doc(`organizations/${orgId}/courses/${courseId}`).get()
  if (!courseSnap.exists) {
    log.warn({ event: 'course_payment_course_not_found', orgId, courseId })
    return
  }

  const paymentSnap = await paymentRef.get()
  const paymentData = paymentSnap.data() || {}

  const course = publicCoursePayload({
    id: courseSnap.id,
    ...courseSnap.data(),
  } as CourseDoc) as CourseDoc
  const entitlement = await grantCourseEntitlement(
    db,
    course,
    userId,
    'PURCHASE',
    paymentData.childId || undefined,
    paymentData.amount || course.price
  )
  await createEnrollmentFromEntitlement(db, course, entitlement)
  await courseSnap.ref.update({
    enrollmentCount: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  log.info({ event: 'course_payment_enrollment_granted', orgId, courseId, userId })
}

function mapStatus(raw: string): PaymentStatus {
  const s = raw.toLowerCase()
  if (s === 'completed' || s === 'success' || s === 'paid') return 'paid'
  if (s === 'failed' || s === 'error' || s === 'declined') return 'failed'
  if (s === 'expired') return 'expired'
  if (s === 'canceled' || s === 'cancelled') return 'canceled'
  return 'pending'
}
