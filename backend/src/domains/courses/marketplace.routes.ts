import admin from 'firebase-admin'
import { Readable } from 'node:stream'
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { FinikPaymentProvider } from '../payments/providers/FinikPaymentProvider.js'
import { getOrgPaymentProvider } from '../payments/providers/registry.js'
import { config } from '../../config/index.js'
import type { CourseDoc } from './courses.types.js'
import {
  createEnrollmentFromEntitlement,
  decideCourseAccess,
  grantCourseEntitlement,
  isPublishedPublicCourse,
  nowIso,
  publicCoursePayload,
} from './courseAccess.service.js'

function now(): string {
  return nowIso()
}

const MARKETPLACE_READ_RATE_LIMIT = {
  max: 120,
  timeWindow: '1 minute',
}

const MARKETPLACE_WRITE_RATE_LIMIT = {
  max: 30,
  timeWindow: '1 minute',
}

// Some clients send `Content-Type: application/json` with an empty body for
// /complete. Fastify rejects that before the handler, so normalize it to `{}`.
async function completeNoBodyPreParsing(
  request: FastifyRequest,
  _reply: FastifyReply,
  _payload: NodeJS.ReadableStream
): Promise<NodeJS.ReadableStream> {
  request.headers['content-length'] = '2'
  const stream = Readable.from(['{}'])
  ;(stream as Readable & { receivedEncodedLength?: number }).receivedEncodedLength = 2
  return stream
}

export const marketplaceRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  // Public marketplace listing — reads from root courseIndex (no Firestore index needed).
  fastify.get(
    '/marketplace/courses',
    { config: { rateLimit: MARKETPLACE_READ_RATE_LIMIT } },
    async (request) => {
      const {
        tag,
        free,
        accessPolicy,
        orgId: filterOrgId,
      } = request.query as Record<string, string>

      // collectionGroup without .where() needs no Firestore index; filter in JS
      const snap = await db.collectionGroup('courses').limit(500).get()

      let courses = snap.docs
        .map((d) => publicCoursePayload({ id: d.id, ...d.data() } as CourseDoc))
        .filter(isPublishedPublicCourse)
        .sort((a, b) => {
          const ta = (a as any).publishedAt || (a as any).createdAt || ''
          const tb = (b as any).publishedAt || (b as any).createdAt || ''
          return tb.localeCompare(ta)
        })

      // Post-filter (Firestore doesn't support array-contains + orderBy on inequality fields well)
      if (tag) {
        courses = courses.filter((c) => c.tags?.includes(tag))
      }
      if (free === 'true') {
        courses = courses.filter((c) => c.accessPolicy === 'FREE' || c.price === 0)
      }
      if (accessPolicy) {
        courses = courses.filter((c) => c.accessPolicy === accessPolicy)
      }
      if (filterOrgId) {
        courses = courses.filter((c) => c.orgId === filterOrgId)
      }

      // Back-fill ownerOrgLogo for courses that were created before logo sync was added.
      // Batch-fetch only the orgs that are missing logo data (deduplicated).
      const missingLogoOrgIds = [
        ...new Set(
          courses
            .filter((c) => !(c as any).ownerOrgLogo)
            .map((c) => (c as any).orgId as string)
            .filter(Boolean)
        ),
      ]
      if (missingLogoOrgIds.length > 0) {
        const orgSnaps = await Promise.all(
          missingLogoOrgIds.map((id) => db.doc(`organizations/${id}`).get())
        )
        const orgLogoMap: Record<string, string> = {}
        const orgNameMap: Record<string, string> = {}
        for (const s of orgSnaps) {
          if (s.exists) {
            const d = s.data()!
            const logo = d.logo || d.logoUrl || d.logoImage || ''
            const name = d.name || d.displayName || d.title || ''
            if (logo) orgLogoMap[s.id] = logo
            if (name) orgNameMap[s.id] = name
          }
        }
        courses = courses.map((c) => {
          const orgId = (c as any).orgId as string
          return {
            ...c,
            ownerOrgLogo: (c as any).ownerOrgLogo || orgLogoMap[orgId] || undefined,
            ownerOrgName: (c as any).ownerOrgName || orgNameMap[orgId] || undefined,
          }
        })
      }

      return { ok: true, courses, total: courses.length }
    }
  )

  // Get a single public course with its modules (no lesson bodies — must enroll)
  fastify.get<{ Params: { orgId: string; courseId: string } }>(
    '/marketplace/orgs/:orgId/courses/:courseId',
    async (request, reply) => {
      const { orgId, courseId } = request.params
      const courseRef = db.doc(`organizations/${orgId}/courses/${courseId}`)
      const courseSnap = await courseRef.get()

      if (!courseSnap.exists) return reply.code(404).send({ error: 'Course not found' })

      const course = publicCoursePayload({
        id: courseSnap.id,
        ...courseSnap.data(),
      } as CourseDoc) as CourseDoc
      if (!isPublishedPublicCourse(course)) {
        return reply.code(404).send({ error: 'Course not found' })
      }

      const modulesSnap = await db
        .collection(`organizations/${orgId}/courses/${courseId}/modules`)
        .orderBy('order')
        .get()

      // Fetch lessons for each module in parallel (titles + metadata, no bodies)
      const modules = await Promise.all(
        modulesSnap.docs.map(async (modDoc) => {
          const lessonsSnap = await db
            .collection(`organizations/${orgId}/courses/${courseId}/modules/${modDoc.id}/lessons`)
            .orderBy('order')
            .get()
          const lessons = lessonsSnap.docs.map((l) => {
            const data = l.data()
            return {
              id: l.id,
              title: data.title,
              type: data.type,
              order: data.order,
              videoDurationMin: data.videoDurationMin ?? null,
            }
          })
          return { id: modDoc.id, ...modDoc.data(), lessons }
        })
      )

      const access = request.user
        ? await decideCourseAccess(
            db,
            course,
            request.user.uid,
            (request.query as Record<string, string>).childId
          )
        : null

      return { ok: true, course, modules, access }
    }
  )

  fastify.get<{ Params: { orgId: string; courseId: string } }>(
    '/marketplace/orgs/:orgId/courses/:courseId/access',
    { config: { rateLimit: MARKETPLACE_READ_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId, courseId } = request.params
      const { childId } = request.query as Record<string, string>
      const courseSnap = await db.doc(`organizations/${orgId}/courses/${courseId}`).get()
      if (!courseSnap.exists) return reply.code(404).send({ error: 'Course not found' })

      const course = publicCoursePayload({
        id: courseSnap.id,
        ...courseSnap.data(),
      } as CourseDoc) as CourseDoc
      if (!isPublishedPublicCourse(course)) {
        return reply.code(404).send({ error: 'Course not found' })
      }

      const access = await decideCourseAccess(db, course, request.user.uid, childId)

      // If approved special needs, persist an entitlement so future access checks are instant
      // (avoids querying childVerifications collection every time).
      if (
        access.canAccess &&
        access.freeReason === 'APPROVED_SPECIAL_NEEDS' &&
        !access.entitlement
      ) {
        grantCourseEntitlement(
          db,
          course,
          request.user.uid,
          'APPROVED_SPECIAL_NEEDS',
          childId
        ).catch(() => {})
      }

      return { ok: true, access }
    }
  )

  // Enroll in a course (parent must be authenticated)
  fastify.post<{ Params: { orgId: string; courseId: string } }>(
    '/marketplace/orgs/:orgId/courses/:courseId/enroll',
    { config: { rateLimit: MARKETPLACE_WRITE_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId, courseId } = request.params
      const userId = request.user.uid

      const courseRef = db.doc(`organizations/${orgId}/courses/${courseId}`)
      const courseSnap = await courseRef.get()
      if (!courseSnap.exists) return reply.code(404).send({ error: 'Course not found' })

      const course = publicCoursePayload({
        id: courseSnap.id,
        ...courseSnap.data(),
      } as CourseDoc) as CourseDoc
      if (!isPublishedPublicCourse(course)) {
        return reply.code(400).send({ error: 'Course is not published' })
      }

      // Check for existing enrollment
      const enrollRef = db.doc(`organizations/${orgId}/courses/${courseId}/enrollments/${userId}`)
      const enrollSnap = await enrollRef.get()
      if (enrollSnap.exists) {
        return { ok: true, enrollment: { id: enrollSnap.id, ...enrollSnap.data() } }
      }

      const parse = z.object({ childId: z.string().min(1).optional() }).safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parse.error.issues })
      }

      const access = await decideCourseAccess(db, course, userId, parse.data.childId)
      if (!access.canAccess) {
        return reply.code(access.requiresPayment ? 402 : 403).send({
          error: access.blockedReason || 'Course access denied',
          access,
        })
      }

      const entitlement = await grantCourseEntitlement(
        db,
        course,
        userId,
        access.freeReason || 'FREE_POLICY',
        parse.data.childId,
        0
      )
      const enrollment = await createEnrollmentFromEntitlement(db, course, entitlement)
      await courseRef.update({
        enrollmentCount: admin.firestore.FieldValue.increment(1),
        updatedAt: now(),
      })

      return reply.code(201).send({ ok: true, enrollment, entitlement, access })
    }
  )

  // Create payment checkout for a PAID course
  fastify.post<{ Params: { orgId: string; courseId: string } }>(
    '/marketplace/orgs/:orgId/courses/:courseId/checkout',
    { config: { rateLimit: MARKETPLACE_WRITE_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId, courseId } = request.params
      const userId = request.user.uid

      const courseSnap = await db.doc(`organizations/${orgId}/courses/${courseId}`).get()
      if (!courseSnap.exists) return reply.code(404).send({ error: 'Course not found' })

      const course = publicCoursePayload({
        id: courseSnap.id,
        ...courseSnap.data(),
      } as CourseDoc) as CourseDoc
      if (!isPublishedPublicCourse(course))
        return reply.code(404).send({ error: 'Course not found' })

      if (course.accessPolicy === 'FREE' || course.price === 0) {
        return reply.code(400).send({ error: 'Course is free — use /enroll instead' })
      }

      // Check already enrolled
      const enrollSnap = await db
        .doc(`organizations/${orgId}/courses/${courseId}/enrollments/${userId}`)
        .get()
      if (enrollSnap.exists) {
        return reply.code(400).send({ error: 'Already enrolled', code: 'ALREADY_ENROLLED' })
      }

      const parse = z
        .object({ childId: z.string().min(1).optional(), returnUrl: z.string().url().optional() })
        .safeParse(request.body)
      if (!parse.success) return reply.code(400).send({ error: 'Invalid input' })

      // For VERIFIED_SPECIAL_NEEDS, check verification before charging
      const access = await decideCourseAccess(db, course, userId, parse.data.childId)
      if (access.canAccess) {
        // Already has access (e.g. VERIFIED_SPECIAL_NEEDS approved) — just enroll
        const entitlement = await grantCourseEntitlement(
          db,
          course,
          userId,
          access.freeReason || 'FREE_POLICY',
          parse.data.childId,
          0
        )
        const enrollment = await createEnrollmentFromEntitlement(db, course, entitlement)
        await courseSnap.ref.update({
          enrollmentCount: admin.firestore.FieldValue.increment(1),
          updatedAt: now(),
        })
        return reply.code(201).send({ ok: true, enrollment, entitlement, requiresPayment: false })
      }

      if (access.blockedReason === 'INVITATION_REQUIRED') {
        return reply
          .code(403)
          .send({ error: 'This course requires an invitation', code: 'INVITATION_REQUIRED' })
      }

      // VERIFIED_SPECIAL_NEEDS but not approved — allow payment at full price (льгота not earned yet)
      // Fall through to normal payment flow below.

      // Use org's own Finik merchant account (with platform-level credentials as fallback)
      const paymentProvider =
        (await getOrgPaymentProvider(db, orgId, 'finik')) ?? new FinikPaymentProvider()

      const paymentRef = db.collection('coursePayments').doc()
      const paymentId = paymentRef.id
      // Reference format recognised by webhook: course__orgId__courseId__userId
      const reference = `course__${orgId}__${courseId}__${userId}`
      const backendUrl = (config.BACKEND_PUBLIC_URL ?? 'http://localhost:3101').replace(/\/$/, '')
      const returnUrl =
        parse.data.returnUrl ||
        `${config.NEXT_PUBLIC_B2B_URL || 'https://nuroo.app'}/courses/${orgId}/${courseId}?payment=done`

      let invoiceResult
      try {
        invoiceResult = await paymentProvider.createInvoice({
          invoiceId: paymentId,
          orgId,
          parentId: userId,
          childId: parse.data.childId || userId,
          amount: course.price,
          currency: 'KGS',
          description: `Оплата за курс: ${course.title}`,
          dueDate: new Date().toISOString().slice(0, 10),
          reference,
          callbackUrl: `${backendUrl}/webhooks/finik`,
          returnUrl,
        })
      } catch (err) {
        fastify.log.error({
          event: 'course_checkout_finik_error',
          orgId,
          courseId,
          err: String(err),
        })
        return reply
          .code(502)
          .send({ error: 'Платёжная система временно недоступна. Попробуйте позже.' })
      }

      await paymentRef.set({
        paymentId,
        orgId,
        courseId,
        userId,
        childId: parse.data.childId || null,
        amount: course.price,
        currency: course.currency || 'KGS',
        status: 'pending',
        paymentUrl: invoiceResult.paymentUrl,
        reference,
        provider: 'finik',
        description: `Оплата за курс: ${course.title}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      return reply.code(201).send({
        ok: true,
        paymentId,
        paymentUrl: invoiceResult.paymentUrl,
        amount: course.price,
        currency: course.currency || 'KGS',
        requiresPayment: true,
      })
    }
  )

  // Get single lesson by lessonId (searches across modules)
  fastify.get<{ Params: { orgId: string; courseId: string; lessonId: string } }>(
    '/marketplace/orgs/:orgId/courses/:courseId/lessons/:lessonId',
    { config: { rateLimit: MARKETPLACE_READ_RATE_LIMIT } },
    async (request, reply) => {
      const { orgId, courseId, lessonId } = request.params

      const courseSnap = await db.doc(`organizations/${orgId}/courses/${courseId}`).get()
      if (!courseSnap.exists) return reply.code(404).send({ error: 'Course not found' })
      const course = publicCoursePayload({
        id: courseSnap.id,
        ...courseSnap.data(),
      } as CourseDoc) as CourseDoc
      if (!isPublishedPublicCourse(course))
        return reply.code(404).send({ error: 'Course not found' })

      // Search lesson across all modules of this course
      const modulesSnap = await db
        .collection(`organizations/${orgId}/courses/${courseId}/modules`)
        .get()

      const lessonSnaps = await Promise.all(
        modulesSnap.docs.map((modDoc) =>
          db
            .doc(
              `organizations/${orgId}/courses/${courseId}/modules/${modDoc.id}/lessons/${lessonId}`
            )
            .get()
        )
      )
      const found = lessonSnaps.find((s) => s.exists)
      if (found) return { ok: true, lesson: { id: found.id, ...found.data() } }

      return reply.code(404).send({ error: 'Lesson not found' })
    }
  )

  // Get enrolled course content (lessons) — only if enrolled
  fastify.get<{ Params: { orgId: string; courseId: string; moduleId: string } }>(
    '/marketplace/orgs/:orgId/courses/:courseId/modules/:moduleId/lessons',
    { config: { rateLimit: MARKETPLACE_READ_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId, courseId, moduleId } = request.params
      const userId = request.user.uid
      const courseSnap = await db.doc(`organizations/${orgId}/courses/${courseId}`).get()
      if (!courseSnap.exists) return reply.code(404).send({ error: 'Course not found' })

      const course = publicCoursePayload({
        id: courseSnap.id,
        ...courseSnap.data(),
      } as CourseDoc) as CourseDoc
      if (!isPublishedPublicCourse(course)) {
        return reply.code(404).send({ error: 'Course not found' })
      }

      const access = await decideCourseAccess(db, course, userId)
      if (!access.canAccess) {
        return reply.code(403).send({ error: 'Not enrolled in this course' })
      }

      const snap = await db
        .collection(`organizations/${orgId}/courses/${courseId}/modules/${moduleId}/lessons`)
        .orderBy('order')
        .get()

      return { ok: true, lessons: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }
    }
  )

  // Mark lesson complete (with or without moduleId in path)
  const markLessonCompleteHandler = async (
    request: FastifyRequest<{ Params: { orgId: string; courseId: string; lessonId: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

    const { orgId, courseId, lessonId } = request.params
    const userId = request.user.uid

    // Write progress — fire-and-forget so slow Firestore never blocks the response.
    db.doc(`users/${userId}/lessonProgress/${courseId}_${lessonId}`)
      .set({ userId, courseId, orgId, lessonId, completedAt: now() }, { merge: true })
      .catch((err) => console.error('[lessonProgress] write failed:', err))

    return { ok: true }
  }

  fastify.post<{
    Params: { orgId: string; courseId: string; moduleId: string; lessonId: string }
  }>(
    '/marketplace/orgs/:orgId/courses/:courseId/modules/:moduleId/lessons/:lessonId/complete',
    { config: { rateLimit: MARKETPLACE_WRITE_RATE_LIMIT }, preParsing: completeNoBodyPreParsing },
    markLessonCompleteHandler as any
  )

  // Mobile app calls this path (no moduleId)
  fastify.post<{
    Params: { orgId: string; courseId: string; lessonId: string }
  }>(
    '/marketplace/orgs/:orgId/courses/:courseId/lessons/:lessonId/complete',
    { config: { rateLimit: MARKETPLACE_WRITE_RATE_LIMIT }, preParsing: completeNoBodyPreParsing },
    markLessonCompleteHandler as any
  )

  // Course progress for the current user
  fastify.get<{ Params: { orgId: string; courseId: string } }>(
    '/marketplace/orgs/:orgId/courses/:courseId/progress',
    { config: { rateLimit: MARKETPLACE_READ_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId, courseId } = request.params
      const userId = request.user.uid

      // Fetch completed lesson docs for this course
      const progressSnap = await db
        .collection(`users/${userId}/lessonProgress`)
        .where('courseId', '==', courseId)
        .get()

      const completedLessonIds = progressSnap.docs.map((d) => d.data().lessonId as string)

      // Total lessons from the course doc (lessonCount field)
      const courseSnap = await db.doc(`organizations/${orgId}/courses/${courseId}`).get()
      const totalLessons: number = courseSnap.exists ? (courseSnap.data()?.lessonCount ?? 0) : 0

      const completedLessons = completedLessonIds.length
      const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

      return {
        ok: true,
        progress: {
          enrollmentId: `${userId}_${courseId}`,
          totalLessons,
          completedLessons,
          progressPct,
          completedLessonIds,
        },
      }
    }
  )

  // Get my enrollments
  fastify.get(
    '/marketplace/my/enrollments',
    { config: { rateLimit: MARKETPLACE_READ_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const userId = request.user.uid
      // Read from user-scoped entitlements — no collectionGroup index needed
      const snap = await db
        .collection(`users/${userId}/courseEntitlements`)
        .where('status', '==', 'ACTIVE')
        .get()

      const enrollments = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))

      return { ok: true, enrollments }
    }
  )
}
