import type { FastifyPluginAsync } from 'fastify'
import multipart from '@fastify/multipart'
import { getFirestore, getStorageBucket } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import { canManageCohort, denyNotInstructor } from './cohorts.auth.js'
import type { CohortDoc, AttendanceDoc } from './cohorts.types.js'
import { RATE, COL, attendanceSchema, nowIso } from './cohorts.helpers.js'

export const cohortsAttendanceRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  // ── POST /orgs/:orgId/cohorts/:cohortId/sessions/:sessionId/attendance ────

  fastify.post<{ Params: { orgId: string; cohortId: string; sessionId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/sessions/:sessionId/attendance',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const member = await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId, sessionId } = request.params
      const cohortSnap = await db.doc(COL.cohort(orgId, cohortId)).get()
      if (!cohortSnap.exists) return reply.code(404).send({ error: 'Cohort not found' })
      if (!canManageCohort(member, cohortSnap.data() as CohortDoc)) return denyNotInstructor(reply)

      const body = attendanceSchema.parse(request.body)
      const now = nowIso()

      const batch = db.batch()
      for (const record of body.records) {
        const doc: AttendanceDoc = {
          childId: record.childId,
          sessionId,
          cohortId,
          status: record.status,
          markedAt: now,
          markedBy: request.user.uid,
        }
        batch.set(db.doc(`${COL.attendance(orgId, cohortId, sessionId)}/${record.childId}`), doc)
      }
      await db
        .doc(COL.session(orgId, cohortId, sessionId))
        .update({ status: 'completed', updatedAt: now })
      await batch.commit()

      return { ok: true, count: body.records.length }
    }
  )

  // ── GET /orgs/:orgId/cohorts/:cohortId/sessions/:sessionId/attendance ─────

  fastify.get<{ Params: { orgId: string; cohortId: string; sessionId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/sessions/:sessionId/attendance',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId, sessionId } = request.params
      const snap = await db.collection(COL.attendance(orgId, cohortId, sessionId)).get()
      const attendance = snap.docs.map((d) => d.data()) as AttendanceDoc[]
      return { ok: true, attendance }
    }
  )

  // ── POST /orgs/:orgId/cohorts/:cohortId/cover ─────────────────────────────

  await fastify.register(multipart, { limits: { fileSize: 8 * 1024 * 1024, files: 1 } })

  fastify.post<{ Params: { orgId: string; cohortId: string } }>(
    '/orgs/:orgId/cohorts/:cohortId/cover',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const member = await requireOrgMember(request, reply, request.params.orgId)
      if (reply.sent) return

      const { orgId, cohortId } = request.params
      const ref = db.doc(COL.cohort(orgId, cohortId))
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Cohort not found' })
      if (!canManageCohort(member, snap.data() as CohortDoc)) return denyNotInstructor(reply)

      let imageBuffer: Buffer | null = null
      let imageMimetype = ''
      let imageFilename = 'cover'

      const parts = request.parts()
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'cover') {
          const chunks: Buffer[] = []
          for await (const chunk of part.file) chunks.push(chunk)
          imageBuffer = Buffer.concat(chunks)
          imageMimetype = part.mimetype || ''
          imageFilename = part.filename || 'cover'
        }
      }

      if (!imageBuffer || imageBuffer.length === 0)
        return reply.code(400).send({ error: 'Image file is required' })
      if (!imageMimetype.startsWith('image/'))
        return reply.code(400).send({ error: 'Only image uploads are allowed' })

      const bucket = await getStorageBucket()
      const safeName = imageFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `orgs/${orgId}/cohorts/${cohortId}/cover/${Date.now()}-${safeName}`
      const file = bucket.file(storagePath)

      await file.save(imageBuffer, {
        contentType: imageMimetype,
        metadata: { cacheControl: 'public, max-age=31536000' },
      })
      await file.makePublic()

      const coverUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`
      await ref.update({ coverUrl, updatedAt: new Date().toISOString() })

      return reply.code(200).send({ ok: true, coverUrl })
    }
  )
}
