import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import multipart from '@fastify/multipart'
import { z } from 'zod'
import { getFirestore, getStorageBucket } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
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

const DOCUMENT_UPLOAD_RATE_LIMIT = {
  max: 20,
  timeWindow: '1 minute',
}

const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024

const ALLOWED_DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

const submitVerificationSchema = z.object({
  childId: z.string().min(1),
  courseId: z.string().min(1),
  orgId: z.string().min(1),
  documentRefs: z.array(z.string().min(1)).min(1).max(10),
  note: z.string().max(2000).optional(),
})

const reviewVerificationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().max(2000).optional(),
})

// Returns the orgId the caller is authorized to review for.
// superAdmin: can review any org (returns orgId from query or undefined for all).
// org_admin:  can only review their own org (orgId must be provided).
async function resolveReviewerOrgId(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string | undefined
): Promise<string | null> {
  if (!request.user) {
    reply.code(401).send({ error: 'Unauthorized' })
    return null
  }
  if (request.user.claims?.superAdmin === true) {
    return orgId ?? null
  }
  if (!orgId) {
    reply.code(400).send({ error: 'orgId is required' })
    return null
  }
  try {
    const member = await requireOrgMember(request, reply, orgId)
    if (!member || member.role !== 'org_admin') {
      if (!reply.sent)
        reply.code(403).send({ error: 'Only organization admins can review verifications' })
      return null
    }
    return orgId
  } catch {
    if (!reply.sent) reply.code(403).send({ error: 'Forbidden' })
    return null
  }
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document'
}

async function uploadVerificationDocument(
  parentUid: string,
  fileBuffer: Buffer,
  mimetype: string,
  filename: string
) {
  const bucket = await getStorageBucket()
  const safeName = sanitizeFilename(filename)
  const storagePath = `child-verifications/${parentUid}/${Date.now()}-${safeName}`
  const file = bucket.file(storagePath)

  await file.save(fileBuffer, {
    contentType: mimetype || undefined,
    metadata: {
      cacheControl: 'private, max-age=0, no-cache',
      metadata: {
        ownerUid: parentUid,
        uploadedFor: 'child-verification',
      },
    },
  })

  return {
    documentRef: storagePath,
    path: storagePath,
    filename: safeName,
    contentType: mimetype,
    size: fileBuffer.length,
  }
}

export const childVerificationsRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, { limits: { fileSize: MAX_DOCUMENT_SIZE, files: 1 } })

  const db = getFirestore()

  fastify.get(
    '/verifications/children/mine',
    { config: { rateLimit: SUBMIT_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const snap = await db
        .collection('childVerifications')
        .where('parentUserId', '==', request.user.uid)
        .limit(50)
        .get()

      return {
        ok: true,
        verifications: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      }
    }
  )

  fastify.post(
    '/verifications/children/documents',
    { config: { rateLimit: DOCUMENT_UPLOAD_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const part = await request.file()
      if (!part) return reply.code(400).send({ error: 'Document file is required' })

      if (!ALLOWED_DOCUMENT_TYPES.has(part.mimetype)) {
        return reply.code(400).send({
          error: 'Only PDF, JPG, PNG, and WebP documents are allowed',
          code: 'INVALID_DOCUMENT_TYPE',
        })
      }

      const buffer = await part.toBuffer()
      if (!buffer.length) {
        return reply.code(400).send({ error: 'Document file is empty', code: 'EMPTY_DOCUMENT' })
      }

      const uploaded = await uploadVerificationDocument(
        request.user.uid,
        buffer,
        part.mimetype,
        part.filename
      )

      return reply.code(201).send({ ok: true, ...uploaded })
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

      const { childId, courseId, orgId, documentRefs, note } = parse.data
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
        .where('courseId', '==', courseId)
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
        courseId,
        orgId,
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
      const {
        status = 'PENDING',
        courseId,
        orgId,
      } = request.query as {
        status?: ChildVerificationStatus
        courseId?: string
        orgId?: string
      }

      const reviewerOrgId = await resolveReviewerOrgId(request, reply, orgId)
      if (reply.sent) return

      if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
        return reply.code(400).send({ error: 'Invalid verification status' })
      }

      // Single-field queries avoid composite index requirements.
      // Secondary filter applied in memory; sort done in memory too.
      let baseQuery = db.collection('childVerifications').where('status', '==', status)
      if (courseId) baseQuery = baseQuery.where('courseId', '==', courseId) as typeof baseQuery
      else if (reviewerOrgId)
        baseQuery = baseQuery.where('orgId', '==', reviewerOrgId) as typeof baseQuery
      const snap = await baseQuery.limit(200).get()

      const bucket = await getStorageBucket()
      const expires = Date.now() + 60 * 60 * 1000 // 1 hour

      const verifications = await Promise.all(
        snap.docs.map(async (doc) => {
          const data = doc.data()
          const documentUrls: string[] = await Promise.all(
            ((data.documentRefs as string[]) ?? []).map(async (ref: string) => {
              try {
                const [url] = await bucket.file(ref).getSignedUrl({ action: 'read', expires })
                return url
              } catch {
                return ''
              }
            })
          )
          return { id: doc.id, ...data, documentUrls }
        })
      )

      const sorted = verifications.sort((a, b) =>
        ((b as any).updatedAt ?? '').localeCompare((a as any).updatedAt ?? '')
      )

      return { ok: true, verifications: sorted }
    }
  )

  fastify.patch<{ Params: { verificationId: string } }>(
    '/admin/verifications/children/:verificationId',
    { config: { rateLimit: REVIEW_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

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

      // org_admin can only review verifications belonging to their org
      if (request.user!.claims?.superAdmin !== true) {
        const docOrgId = snap.data()?.orgId
        if (!docOrgId) return reply.code(403).send({ error: 'Forbidden' })
        try {
          const member = await requireOrgMember(request, reply, docOrgId)
          if (!member || member.role !== 'org_admin') {
            if (!reply.sent) reply.code(403).send({ error: 'Forbidden' })
            return
          }
        } catch {
          if (!reply.sent) reply.code(403).send({ error: 'Forbidden' })
          return
        }
      }

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
