import type { FastifyPluginAsync } from 'fastify'
import multipart from '@fastify/multipart'
import { z } from 'zod'
import { getFirestore, getStorageBucket } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
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
  imageUrl: z.string().url().optional().nullable(),
  imageName: z.string().max(200).optional().nullable(),
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

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)])
    ) as T
  }

  return value
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

function courseMediaFolder(kind: string, mediaMimetype: string) {
  if (kind === 'cover') return 'covers'
  if (kind === 'lesson-video') return 'lesson-videos'
  if (kind === 'lesson-image') return 'lesson-images'
  if (kind === 'lesson-pdf') return 'lesson-pdfs'
  if (mediaMimetype.startsWith('video/')) return 'lesson-videos'
  if (mediaMimetype.startsWith('image/')) return 'lesson-images'
  return 'lesson-files'
}

function validateCourseMedia(kind: string, mediaMimetype: string): string | null {
  if (kind === 'cover' || kind === 'lesson-image') {
    return mediaMimetype.startsWith('image/') ? null : 'Only image uploads are allowed'
  }
  if (kind === 'lesson-video') {
    return mediaMimetype.startsWith('video/') ? null : 'Only video uploads are allowed'
  }
  if (kind === 'lesson-pdf') {
    return mediaMimetype === 'application/pdf' ? null : 'Only PDF uploads are allowed'
  }
  if (
    mediaMimetype.startsWith('image/') ||
    mediaMimetype.startsWith('video/') ||
    mediaMimetype === 'application/pdf'
  ) {
    return null
  }
  return 'Only image, video, and PDF uploads are allowed'
}

async function uploadCourseMedia(
  orgId: string,
  kind: string,
  mediaBuffer: Buffer,
  mediaMimetype: string,
  mediaFilename: string
) {
  const bucket = await getStorageBucket()
  const safeName = mediaFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const folder = courseMediaFolder(kind, mediaMimetype)
  const storagePath = `orgs/${orgId}/courses/${folder}/${Date.now()}-${safeName}`
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
    mediaType: mediaMimetype,
    filename: mediaFilename,
    kind,
  }
}

function resolveAccessPolicy(input: { accessPolicy?: CourseDoc['accessPolicy']; price?: number }) {
  return input.accessPolicy || (Number(input.price || 0) > 0 ? 'PAID' : 'FREE')
}

function validatePublishableCourse(course: CourseDoc): string | null {
  if (normalizeCourseStatus(course.status) !== 'PUBLISHED') return null
  if (!course.title?.trim()) return 'Published courses require a title'
  if (!course.description?.trim()) return 'Published courses require a description'
  if (normalizeAccessPolicy(course) !== 'FREE' && Number(course.price || 0) <= 0) {
    return 'Paid access policies require a positive price'
  }
  return null
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const coursesRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()
  await fastify.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } })

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
        let kind = 'cover'

        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'media') {
            const chunks: Buffer[] = []
            for await (const chunk of part.file) chunks.push(chunk)
            mediaBuffer = Buffer.concat(chunks)
            mediaMimetype = part.mimetype || ''
            mediaFilename = part.filename || 'course-cover'
          } else if (part.type === 'field' && part.fieldname === 'kind') {
            kind = String(part.value || 'cover')
          }
        }

        if (!mediaBuffer || mediaBuffer.length === 0) {
          return reply.code(400).send({ error: 'Media file is required' })
        }

        const mediaError = validateCourseMedia(kind, mediaMimetype)
        if (mediaError) {
          return reply.code(400).send({ error: mediaError })
        }

        const uploaded =
          kind === 'cover'
            ? await uploadCourseCoverImage(orgId, mediaBuffer, mediaMimetype, mediaFilename)
            : await uploadCourseMedia(orgId, kind, mediaBuffer, mediaMimetype, mediaFilename)
        return reply.code(201).send({ ok: true, ...uploaded })
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'FST_FILES_LIMIT'
        ) {
          return reply.code(413).send({ error: 'Media file is too large' })
        }
        request.log.error(error, '[COURSE_MEDIA_UPLOAD] Failed to upload course media')
        return reply.code(500).send({ error: 'Failed to upload media' })
      }
    }
  )

  // List org courses
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/courses', async (request, reply) => {
    await requireOrgMember(request, reply, request.params.orgId)
    if (reply.sent) return
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
      if (reply.sent) return
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
      ownerOrgLogo: orgData?.logo || orgData?.logoUrl || undefined,
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

    const courseData = stripUndefined(course)
    await db.doc(`organizations/${orgId}/courses/${id}`).set(courseData)
    return reply.code(201).send({ ok: true, course: courseData })
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
      const [snap, orgSnap] = await Promise.all([ref.get(), db.doc(`organizations/${orgId}`).get()])
      if (!snap.exists) return reply.code(404).send({ error: 'Course not found' })

      const currentCourse = { id: snap.id, ...snap.data() } as CourseDoc
      const orgData = orgSnap.exists ? orgSnap.data() : null
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
        ownerOrgName:
          orgData?.name || orgData?.displayName || orgData?.title || currentCourse.ownerOrgName,
        ownerOrgLogo:
          orgData?.logo ||
          orgData?.logoUrl ||
          orgData?.logoImage ||
          currentCourse.ownerOrgLogo ||
          undefined,
        updatedAt: now(),
      }

      const nextCourse = { ...currentCourse, ...updates } as CourseDoc
      const isPublishing =
        parse.data.status !== undefined &&
        normalizeCourseStatus(parse.data.status) === 'PUBLISHED' &&
        normalizeCourseStatus(currentCourse.status) !== 'PUBLISHED'
      if (isPublishing) {
        const publishError = validatePublishableCourse(nextCourse)
        if (publishError) {
          return reply.code(400).send({ error: publishError })
        }
      }

      if (normalizeCourseStatus(nextCourse.status) === 'PUBLISHED' && !currentCourse.publishedAt) {
        updates.publishedAt = now()
      }

      // Sync courseIndex atomically with the course update
      const finalStatus = normalizeCourseStatus(nextCourse.status)
      const finalVisibility = normalizeCourseVisibility(nextCourse.visibility)
      const indexRef = db.doc(`courseIndex/${orgId}_${courseId}`)
      const cleanUpdates = stripUndefined(updates as Record<string, unknown>)
      const cleanIndexCourse = stripUndefined({ ...nextCourse, id: courseId, courseId, orgId })

      if (finalStatus === 'PUBLISHED' && finalVisibility === 'PUBLIC') {
        const batch = db.batch()
        batch.update(ref, cleanUpdates)
        batch.set(indexRef, cleanIndexCourse, { merge: true })
        await batch.commit()
      } else {
        const batch = db.batch()
        batch.update(ref, cleanUpdates)
        batch.delete(indexRef)
        await batch.commit()
      }

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
      await Promise.all([
        db.doc(`organizations/${orgId}/courses/${courseId}`).delete(),
        db.doc(`courseIndex/${orgId}_${courseId}`).delete(),
      ])
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
      if (reply.sent) return
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
      if (reply.sent) return
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
      if (reply.sent) return
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
