import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { nowIso } from '../courses/courseAccess.service.js'
import type { ChildVerificationDoc, ChildVerificationStatus } from '../courses/courses.types.js'

const REVIEW_RATE_LIMIT = {
  max: 20,
  timeWindow: '1 minute',
}

const SUBMIT_RATE_LIMIT = {
  max: 10,
  timeWindow: '1 minute',
}

const submitVerificationSchema = z.object({
  childId: z.string().min(1),
  documentRefs: z.array(z.string().min(1)).min(1).max(10),
  note: z.string().max(2000).optional(),
})

const reviewVerificationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().max(2000).optional(),
})

function requireNurooAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' }) as never
  }
  if (request.user.claims?.superAdmin !== true) {
    return reply
      .code(403)
      .send({ error: 'Only Nuroo administrators can review documents' }) as never
  }
}

export const childVerificationsRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  fastify.get(
    '/verifications/children/mine',
    { config: { rateLimit: SUBMIT_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const snap = await db
        .collection('childVerifications')
        .where('parentUserId', '==', request.user.uid)
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get()

      return {
        ok: true,
        verifications: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      }
    }
  )

  fastify.post(
    '/verifications/children',
    { config: { rateLimit: SUBMIT_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const parse = submitVerificationSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parse.error.issues })
      }

      const { childId, documentRefs, note } = parse.data
      const childSnap = await db.doc(`children/${childId}`).get()
      if (childSnap.exists) {
        const child = childSnap.data()
        const parentId = child?.parentUserId || child?.parentId || child?.parentUid
        if (parentId && parentId !== request.user.uid) {
          return reply.code(403).send({ error: 'Child does not belong to this parent' })
        }
      }

      const existingSnap = await db
        .collection('childVerifications')
        .where('parentUserId', '==', request.user.uid)
        .where('childId', '==', childId)
        .where('status', 'in', ['PENDING', 'APPROVED'])
        .limit(1)
        .get()

      if (!existingSnap.empty) {
        return reply.code(409).send({
          error: 'Verification already exists for this child',
          verification: { id: existingSnap.docs[0].id, ...existingSnap.docs[0].data() },
        })
      }

      const id = db.collection('childVerifications').doc().id
      const ts = nowIso()
      const verification: ChildVerificationDoc = {
        id,
        childId,
        parentUserId: request.user.uid,
        status: 'PENDING',
        documentRefs,
        note,
        createdAt: ts,
        updatedAt: ts,
      }

      await db.doc(`childVerifications/${id}`).set(verification)
      return reply.code(201).send({ ok: true, verification })
    }
  )

  fastify.get(
    '/admin/verifications/children',
    { config: { rateLimit: REVIEW_RATE_LIMIT } },
    async (request, reply) => {
      requireNurooAdmin(request, reply)

      const { status = 'PENDING' } = request.query as { status?: ChildVerificationStatus }
      if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
        return reply.code(400).send({ error: 'Invalid verification status' })
      }

      const snap = await db
        .collection('childVerifications')
        .where('status', '==', status)
        .orderBy('updatedAt', 'desc')
        .limit(100)
        .get()

      return {
        ok: true,
        verifications: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      }
    }
  )

  fastify.patch<{ Params: { verificationId: string } }>(
    '/admin/verifications/children/:verificationId',
    { config: { rateLimit: REVIEW_RATE_LIMIT } },
    async (request, reply) => {
      requireNurooAdmin(request, reply)

      const parse = reviewVerificationSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parse.error.issues })
      }

      if (parse.data.status === 'REJECTED' && !parse.data.rejectionReason?.trim()) {
        return reply.code(400).send({ error: 'Rejection reason is required' })
      }

      const ref = db.doc(`childVerifications/${request.params.verificationId}`)
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Verification not found' })

      const ts = nowIso()
      const updates: Record<string, unknown> = {
        status: parse.data.status,
        reviewedBy: request.user!.uid,
        reviewedAt: ts,
        updatedAt: ts,
      }
      if (parse.data.status === 'REJECTED') {
        updates.rejectionReason = parse.data.rejectionReason
      }

      await ref.update(updates)
      return { ok: true }
    }
  )
}
