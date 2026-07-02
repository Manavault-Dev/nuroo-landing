import type { FastifyPluginAsync } from 'fastify'
import multipart from '@fastify/multipart'
import { z } from 'zod'
import { getFirestore, getStorageBucket } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../plugins/rbac.js'
import type { CourseDoc, ModuleDoc, LessonDoc } from './courses.types.js'
import {
  normalizeAccessPolicy,
  normalizeCourseStatus,
  normalizeCourseVisibility,
  nowIso,
  publicCoursePayload,
} from './courseAccess.service.js'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  coverImageUrl: z.string().url().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  targetAudience: z.string().max(500).optional().nullable(),
  ageRange: z.string().max(50).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  visibility: z
    .enum(['PRIVATE', 'PUBLIC', 'org_only', 'marketplace'])
    .default('PRIVATE')
    .transform((value) =>
      value === 'marketplace' ? 'PUBLIC' : value === 'org_only' ? 'PRIVATE' : value
    ),
  accessPolicy: z.enum(['FREE', 'PAID', 'VERIFIED_SPECIAL_NEEDS', 'INVITATION_ONLY']).optional(),
  price: z.number().min(0).default(0),
  currency: z.string().default('KGS'),
})

const updateCourseSchema = createCourseSchema.partial().extend({
  status: z
    .enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'draft', 'published', 'archived'])
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : value === 'published'
          ? 'PUBLISHED'
          : value === 'archived'
            ? 'ARCHIVED'
            : value === 'draft'
              ? 'DRAFT'
              : value
    ),
})

const createModuleSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  order: z.number().int().min(0),
})

const updateModuleSchema = createModuleSchema.partial()

const createLessonSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(['text', 'video', 'task', 'pdf']),
  order: z.number().int().min(0),
  body: z.string().max(50000).optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
  videoDurationMin: z.number().min(0).optional().nullable(),
  taskDescription: z.string().max(5000).optional().nullable(),
  taskExample: z.string().max(2000).optional().nullable(),
  pdfUrl: z.string().url().optional().nullable(),
  pdfName: z.string().max(200).optional().nullable(),
})

const updateLessonSchema = createLessonSchema.partial()
const COURSE_MEDIA_RATE_LIMIT = {
  max: 20,
  timeWindow: '1 minute',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return nowIso()
}

function newId(db: ReturnType<typeof getFirestore>, path: string): string {
  return db.collection(path).doc().id
}

async function uploadCourseCoverImage(
  orgId: string,
  mediaBuffer: Buffer,
  mediaMimetype: string,
  mediaFilename: string
) {
  const bucket = await getStorageBucket()
  const safeName = mediaFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `orgs/${orgId}/courses/covers/${Date.now()}-${safeName}`
  const file = bucket.file(storagePath)

  await file.save(mediaBuffer, {
    contentType: mediaMimetype || undefined,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  })
  await file.makePublic()

  return {
    url: `https://storage.googleapis.com/${bucket.name}/${storagePath}`,
    path: storagePath,
  }
}

function resolveAccessPolicy(input: { accessPolicy?: CourseDoc['accessPolicy']; price?: number }) {
  return input.accessPolicy || (Number(input.price || 0) > 0 ? 'PAID' : 'FREE')
}

function validatePublishableCourse(course: CourseDoc): string | null {
  if (normalizeCourseStatus(course.status) !== 'PUBLISHED') return null
  if (normalizeCourseVisibility(course.visibility) !== 'PUBLIC') return null
  if (!course.title?.trim()) return 'Published courses require a title'
  if (!course.description?.trim()) return 'Published courses require a description'
  if (!course.coverUrl && !course.coverImageUrl) return 'Published courses require a cover image'
  if (normalizeAccessPolicy(course) !== 'FREE' && Number(course.price || 0) <= 0) {
    return 'Paid access policies require a positive price'
  }
  return null
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const coursesRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()
  await fastify.register(multipart, { limits: { fileSize: 8 * 1024 * 1024 } })

  // ── Courses ────────────────────────────────────────────────────────────────

  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/courses/media',
    { config: { rateLimit: COURSE_MEDIA_RATE_LIMIT } },
    async (request, reply) => {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return

      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only admins can upload course media' })
      }

      try {
        const parts = request.parts()
        let mediaBuffer: Buffer | null = null
        let mediaMimetype = ''
        let mediaFilename = 'course-cover'

        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'media') {
            const chunks: Buffer[] = []
            for await (const chunk of part.file) chunks.push(chunk)
            mediaBuffer = Buffer.concat(chunks)
            mediaMimetype = part.mimetype || ''
            mediaFilename = part.filename || 'course-cover'
          }
        }

        if (!mediaBuffer || mediaBuffer.length === 0) {
          return reply.code(400).send({ error: 'Image file is required' })
        }

        if (!mediaMimetype.startsWith('image/')) {
          return reply.code(400).send({ error: 'Only image uploads are allowed' })
        }

        const uploaded = await uploadCourseCoverImage(
          orgId,
          mediaBuffer,
          mediaMimetype,
          mediaFilename
        )
        return reply.code(201).send({ ok: true, ...uploaded })
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'FST_FILES_LIMIT'
        ) {
          return reply.code(413).send({ error: 'Image file is too large' })
        }
        request.log.error(error, '[COURSE_MEDIA_UPLOAD] Failed to upload course cover image')
        return reply.code(500).send({ error: 'Failed to upload image' })
      }
    }
  )

  // List org courses
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/courses', async (request, reply) => {
    await requireOrgMember(request, reply, request.params.orgId)
    const snap = await db
      .collection(`organizations/${request.params.orgId}/courses`)
      .orderBy('createdAt', 'desc')
      .get()
    return {
      ok: true,
      courses: snap.docs.map((d) => publicCoursePayload({ id: d.id, ...d.data() } as CourseDoc)),
    }
  })

  // Get single course
  fastify.get<{ Params: { orgId: string; courseId: string } }>(
    '/orgs/:orgId/courses/:courseId',
    async (request, reply) => {
      const { orgId, courseId } = request.params
      await requireOrgMember(request, reply, orgId)
      const snap = await db.doc(`organizations/${orgId}/courses/${courseId}`).get()
      if (!snap.exists) return reply.code(404).send({ error: 'Course not found' })
      return { ok: true, course: publicCoursePayload({ id: snap.id, ...snap.data() } as CourseDoc) }
    }
  )

  // Create course
  fastify.post<{ Params: { orgId: string } }>('/orgs/:orgId/courses', async (request, reply) => {
    const { orgId } = request.params
    const member = await requireOrgMember(request, reply, orgId)
    if (member.role !== 'org_admin') {
      return reply.code(403).send({ error: 'Only admins can create courses' })
    }

    const parse = createCourseSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parse.error.issues })
    }

    const id = newId(db, `organizations/${orgId}/courses`)
    const ts = now()
    const orgSnap = await db.doc(`organizations/${orgId}`).get()
    const orgData = orgSnap.exists ? orgSnap.data() : null
    const accessPolicy = resolveAccessPolicy(parse.data)
    const price = accessPolicy === 'FREE' ? 0 : parse.data.price
    const course = {
      id,
      orgId,
      ownerOrgId: orgId,
      ownerOrgName: orgData?.name || orgData?.displayName || orgData?.title || undefined,
      ...parse.data,
      coverUrl: parse.data.coverUrl || parse.data.coverImageUrl || undefined,
      accessPolicy,
      price,
      status: 'DRAFT' as const,
      moduleCount: 0,
      lessonCount: 0,
      enrollmentCount: 0,
      createdBy: request.user!.uid,
      createdAt: ts,
      updatedAt: ts,
    } as CourseDoc

    await db.doc(`organizations/${orgId}/courses/${id}`).set(course)
    return reply.code(201).send({ ok: true, course })
  })

  // Update course
  fastify.patch<{ Params: { orgId: string; courseId: string } }>(
    '/orgs/:orgId/courses/:courseId',
    async (request, reply) => {
      const { orgId, courseId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only admins can update courses' })
      }

      const parse = updateCourseSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parse.error.issues })
      }

      const ref = db.doc(`organizations/${orgId}/courses/${courseId}`)
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Course not found' })

      const currentCourse = { id: snap.id, ...snap.data() } as CourseDoc
      const accessPolicy = resolveAccessPolicy({
        accessPolicy: parse.data.accessPolicy || currentCourse.accessPolicy,
        price: parse.data.price ?? currentCourse.price,
      })
      const updates: Partial<CourseDoc> = {
        ...parse.data,
        ...(parse.data.coverUrl || parse.data.coverImageUrl
          ? { coverUrl: parse.data.coverUrl || parse.data.coverImageUrl || undefined }
          : {}),
        accessPolicy,
        price: accessPolicy === 'FREE' ? 0 : (parse.data.price ?? currentCourse.price),
        updatedAt: now(),
      }

      const nextCourse = { ...currentCourse, ...updates } as CourseDoc
      const publishError = validatePublishableCourse(nextCourse)
      if (publishError) {
        return reply.code(400).send({ error: publishError })
      }

      if (normalizeCourseStatus(nextCourse.status) === 'PUBLISHED' && !currentCourse.publishedAt) {
        updates.publishedAt = now()
      }

      await ref.update(updates as Record<string, unknown>)
      return { ok: true }
    }
  )

  // Delete course
  fastify.delete<{ Params: { orgId: string; courseId: string } }>(
    '/orgs/:orgId/courses/:courseId',
    async (request, reply) => {
      const { orgId, courseId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only admins can delete courses' })
      }
      await db.doc(`organizations/${orgId}/courses/${courseId}`).delete()
      return { ok: true }
    }
  )

  // ── Modules ────────────────────────────────────────────────────────────────

  // List modules
  fastify.get<{ Params: { orgId: string; courseId: string } }>(
    '/orgs/:orgId/courses/:courseId/modules',
    async (request, reply) => {
      const { orgId, courseId } = request.params
      await requireOrgMember(request, reply, orgId)
      const snap = await db
        .collection(`organizations/${orgId}/courses/${courseId}/modules`)
        .orderBy('order')
        .get()
      return { ok: true, modules: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }
    }
  )

  // Create module
  fastify.post<{ Params: { orgId: string; courseId: string } }>(
    '/orgs/:orgId/courses/:courseId/modules',
    async (request, reply) => {
      const { orgId, courseId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only admins can create modules' })
      }

      const parse = createModuleSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parse.error.issues })
      }

      const courseRef = db.doc(`organizations/${orgId}/courses/${courseId}`)
      const courseSnap = await courseRef.get()
      if (!courseSnap.exists) return reply.code(404).send({ error: 'Course not found' })

      const id = newId(db, `organizations/${orgId}/courses/${courseId}/modules`)
      const ts = now()
      const module = {
        id,
        courseId,
        orgId,
        ...parse.data,
        lessonCount: 0,
        createdAt: ts,
        updatedAt: ts,
      } as ModuleDoc

      await db.doc(`organizations/${orgId}/courses/${courseId}/modules/${id}`).set(module)
      await courseRef.update({
        moduleCount: (courseSnap.data() as CourseDoc).moduleCount + 1,
        updatedAt: ts,
      })

      return reply.code(201).send({ ok: true, module })
    }
  )

  // Update module
  fastify.patch<{ Params: { orgId: string; courseId: string; moduleId: string } }>(
    '/orgs/:orgId/courses/:courseId/modules/:moduleId',
    async (request, reply) => {
      const { orgId, courseId, moduleId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only admins can update modules' })
      }

      const parse = updateModuleSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parse.error.issues })
      }

      const ref = db.doc(`organizations/${orgId}/courses/${courseId}/modules/${moduleId}`)
      if (!(await ref.get()).exists) return reply.code(404).send({ error: 'Module not found' })

      await ref.update({ ...parse.data, updatedAt: now() } as Record<string, unknown>)
      return { ok: true }
    }
  )

  // Delete module
  fastify.delete<{ Params: { orgId: string; courseId: string; moduleId: string } }>(
    '/orgs/:orgId/courses/:courseId/modules/:moduleId',
    async (request, reply) => {
      const { orgId, courseId, moduleId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only admins can delete modules' })
      }

      const courseRef = db.doc(`organizations/${orgId}/courses/${courseId}`)
      const courseSnap = await courseRef.get()
      if (!courseSnap.exists) return reply.code(404).send({ error: 'Course not found' })

      await db.doc(`organizations/${orgId}/courses/${courseId}/modules/${moduleId}`).delete()
      const current = (courseSnap.data() as CourseDoc).moduleCount
      await courseRef.update({ moduleCount: Math.max(0, current - 1), updatedAt: now() })
      return { ok: true }
    }
  )

  // Reorder modules
  fastify.patch<{ Params: { orgId: string; courseId: string } }>(
    '/orgs/:orgId/courses/:courseId/modules/reorder',
    async (request, reply) => {
      const { orgId, courseId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only admins can reorder modules' })
      }

      const parse = z.object({ order: z.array(z.string()) }).safeParse(request.body)
      if (!parse.success) return reply.code(400).send({ error: 'Invalid input' })

      const batch = db.batch()
      const ts = now()
      parse.data.order.forEach((moduleId, idx) => {
        batch.update(db.doc(`organizations/${orgId}/courses/${courseId}/modules/${moduleId}`), {
          order: idx,
          updatedAt: ts,
        })
      })
      await batch.commit()
      return { ok: true }
    }
  )

  // ── Lessons ────────────────────────────────────────────────────────────────

  // List lessons in module
  fastify.get<{ Params: { orgId: string; courseId: string; moduleId: string } }>(
    '/orgs/:orgId/courses/:courseId/modules/:moduleId/lessons',
    async (request, reply) => {
      const { orgId, courseId, moduleId } = request.params
      await requireOrgMember(request, reply, orgId)
      const snap = await db
        .collection(`organizations/${orgId}/courses/${courseId}/modules/${moduleId}/lessons`)
        .orderBy('order')
        .get()
      return { ok: true, lessons: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }
    }
  )

  // Create lesson
  fastify.post<{ Params: { orgId: string; courseId: string; moduleId: string } }>(
    '/orgs/:orgId/courses/:courseId/modules/:moduleId/lessons',
    async (request, reply) => {
      const { orgId, courseId, moduleId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only admins can create lessons' })
      }

      const parse = createLessonSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parse.error.issues })
      }

      const moduleRef = db.doc(`organizations/${orgId}/courses/${courseId}/modules/${moduleId}`)
      const moduleSnap = await moduleRef.get()
      if (!moduleSnap.exists) return reply.code(404).send({ error: 'Module not found' })

      const id = newId(db, `organizations/${orgId}/courses/${courseId}/modules/${moduleId}/lessons`)
      const ts = now()
      const lesson = {
        id,
        moduleId,
        courseId,
        orgId,
        ...parse.data,
        createdAt: ts,
        updatedAt: ts,
      } as LessonDoc

      const courseRef = db.doc(`organizations/${orgId}/courses/${courseId}`)
      const courseSnap = await courseRef.get()

      await Promise.all([
        db
          .doc(`organizations/${orgId}/courses/${courseId}/modules/${moduleId}/lessons/${id}`)
          .set(lesson),
        moduleRef.update({
          lessonCount: (moduleSnap.data() as ModuleDoc).lessonCount + 1,
          updatedAt: ts,
        }),
        courseSnap.exists
          ? courseRef.update({
              lessonCount: (courseSnap.data() as CourseDoc).lessonCount + 1,
              updatedAt: ts,
            })
          : Promise.resolve(),
      ])

      return reply.code(201).send({ ok: true, lesson })
    }
  )

  // Update lesson
  fastify.patch<{
    Params: { orgId: string; courseId: string; moduleId: string; lessonId: string }
  }>(
    '/orgs/:orgId/courses/:courseId/modules/:moduleId/lessons/:lessonId',
    async (request, reply) => {
      const { orgId, courseId, moduleId, lessonId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only admins can update lessons' })
      }

      const parse = updateLessonSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parse.error.issues })
      }

      const ref = db.doc(
        `organizations/${orgId}/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`
      )
      if (!(await ref.get()).exists) return reply.code(404).send({ error: 'Lesson not found' })

      await ref.update({ ...parse.data, updatedAt: now() } as Record<string, unknown>)
      return { ok: true }
    }
  )

  // Delete lesson
  fastify.delete<{
    Params: { orgId: string; courseId: string; moduleId: string; lessonId: string }
  }>(
    '/orgs/:orgId/courses/:courseId/modules/:moduleId/lessons/:lessonId',
    async (request, reply) => {
      const { orgId, courseId, moduleId, lessonId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only admins can delete lessons' })
      }

      const moduleRef = db.doc(`organizations/${orgId}/courses/${courseId}/modules/${moduleId}`)
      const moduleSnap = await moduleRef.get()
      const courseRef = db.doc(`organizations/${orgId}/courses/${courseId}`)
      const courseSnap = await courseRef.get()

      await db
        .doc(`organizations/${orgId}/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`)
        .delete()

      const updates: Promise<unknown>[] = []
      if (moduleSnap.exists) {
        updates.push(
          moduleRef.update({
            lessonCount: Math.max(0, (moduleSnap.data() as ModuleDoc).lessonCount - 1),
            updatedAt: now(),
          })
        )
      }
      if (courseSnap.exists) {
        updates.push(
          courseRef.update({
            lessonCount: Math.max(0, (courseSnap.data() as CourseDoc).lessonCount - 1),
            updatedAt: now(),
          })
        )
      }
      await Promise.all(updates)
      return { ok: true }
    }
  )

  // Reorder lessons
  fastify.patch<{ Params: { orgId: string; courseId: string; moduleId: string } }>(
    '/orgs/:orgId/courses/:courseId/modules/:moduleId/lessons/reorder',
    async (request, reply) => {
      const { orgId, courseId, moduleId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only admins can reorder lessons' })
      }

      const parse = z.object({ order: z.array(z.string()) }).safeParse(request.body)
      if (!parse.success) return reply.code(400).send({ error: 'Invalid input' })

      const batch = db.batch()
      const ts = now()
      parse.data.order.forEach((lessonId, idx) => {
        batch.update(
          db.doc(
            `organizations/${orgId}/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`
          ),
          { order: idx, updatedAt: ts }
        )
      })
      await batch.commit()
      return { ok: true }
    }
  )

  // ── Enrollments (for org to see who enrolled) ──────────────────────────────

  fastify.get<{ Params: { orgId: string; courseId: string } }>(
    '/orgs/:orgId/courses/:courseId/enrollments',
    async (request, reply) => {
      const { orgId, courseId } = request.params
      await requireOrgMember(request, reply, orgId)
      const snap = await db
        .collection(`organizations/${orgId}/courses/${courseId}/enrollments`)
        .orderBy('enrolledAt', 'desc')
        .get()
      return {
        ok: true,
        enrollments: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        total: snap.size,
      }
    }
  )
}
