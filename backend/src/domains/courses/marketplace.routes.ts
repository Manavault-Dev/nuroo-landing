import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
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

export const marketplaceRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  // Public marketplace listing — only published public courses.
  fastify.get('/marketplace/courses', async (request) => {
    const { tag, free, accessPolicy } = request.query as Record<string, string>

    const publicSnapPromise = db
      .collectionGroup('courses')
      .where('status', '==', 'PUBLISHED')
      .where('visibility', '==', 'PUBLIC')
      .orderBy('publishedAt', 'desc')
      .limit(50)
      .get()

    const legacySnapPromise = db
      .collectionGroup('courses')
      .where('status', '==', 'published')
      .where('visibility', '==', 'marketplace')
      .orderBy('publishedAt', 'desc')
      .limit(50)
      .get()

    const [publicSnap, legacySnap] = await Promise.all([publicSnapPromise, legacySnapPromise])
    const courseMap = new Map<string, CourseDoc>()
    for (const doc of [...publicSnap.docs, ...legacySnap.docs]) {
      const course = publicCoursePayload({ id: doc.id, ...doc.data() } as CourseDoc) as CourseDoc
      courseMap.set(`${course.orgId}:${course.id}`, course)
    }
    let courses = Array.from(courseMap.values()).filter(isPublishedPublicCourse)

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

    return { ok: true, courses, total: courses.length }
  })

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

      const modules = modulesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

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
        enrollmentCount: (course.enrollmentCount || 0) + 1,
        updatedAt: now(),
      })

      return reply.code(201).send({ ok: true, enrollment, entitlement, access })
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

  // Mark lesson complete
  fastify.post<{
    Params: { orgId: string; courseId: string; moduleId: string; lessonId: string }
  }>(
    '/marketplace/orgs/:orgId/courses/:courseId/modules/:moduleId/lessons/:lessonId/complete',
    { config: { rateLimit: MARKETPLACE_WRITE_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId, courseId, lessonId } = request.params
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

      await db
        .doc(`users/${userId}/lessonProgress/${courseId}_${lessonId}`)
        .set({ userId, courseId, lessonId, completedAt: now() }, { merge: true })

      // Update enrollment lastAccessedAt
      await db
        .doc(`organizations/${orgId}/courses/${courseId}/enrollments/${userId}`)
        .update({ lastAccessedAt: now() })

      return { ok: true }
    }
  )

  // Get my enrollments
  fastify.get(
    '/marketplace/my-enrollments',
    { config: { rateLimit: MARKETPLACE_READ_RATE_LIMIT } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const userId = request.user.uid
      const snap = await db
        .collectionGroup('enrollments')
        .where('userId', '==', userId)
        .orderBy('enrolledAt', 'desc')
        .get()

      return {
        ok: true,
        enrollments: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      }
    }
  )
}
