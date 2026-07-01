import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import type { CourseDoc, EnrollmentDoc } from './courses.types.js'

function now(): string {
  return new Date().toISOString()
}

export const marketplaceRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  // Public marketplace listing — published courses with visibility=marketplace
  fastify.get('/marketplace/courses', async (request) => {
    const { tag, minAge, maxAge, free } = request.query as Record<string, string>

    let query = db
      .collectionGroup('courses')
      .where('status', '==', 'published')
      .where('visibility', '==', 'marketplace')
      .orderBy('publishedAt', 'desc')
      .limit(50)

    const snap = await query.get()
    let courses = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (CourseDoc & {
      id: string
    })[]

    // Post-filter (Firestore doesn't support array-contains + orderBy on inequality fields well)
    if (tag) {
      courses = courses.filter((c) => c.tags?.includes(tag))
    }
    if (free === 'true') {
      courses = courses.filter((c) => c.price === 0)
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

      const course = courseSnap.data() as CourseDoc
      if (course.status !== 'published' || course.visibility !== 'marketplace') {
        return reply.code(404).send({ error: 'Course not found' })
      }

      const modulesSnap = await db
        .collection(`organizations/${orgId}/courses/${courseId}/modules`)
        .orderBy('order')
        .get()

      const modules = modulesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      return { ok: true, course: { id: courseSnap.id, ...course }, modules }
    }
  )

  // Enroll in a course (parent must be authenticated)
  fastify.post<{ Params: { orgId: string; courseId: string } }>(
    '/marketplace/orgs/:orgId/courses/:courseId/enroll',
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId, courseId } = request.params
      const userId = request.user.uid

      const courseRef = db.doc(`organizations/${orgId}/courses/${courseId}`)
      const courseSnap = await courseRef.get()
      if (!courseSnap.exists) return reply.code(404).send({ error: 'Course not found' })

      const course = courseSnap.data() as CourseDoc
      if (course.status !== 'published') {
        return reply.code(400).send({ error: 'Course is not published' })
      }

      // Check for existing enrollment
      const enrollRef = db.doc(
        `organizations/${orgId}/courses/${courseId}/enrollments/${userId}`
      )
      const enrollSnap = await enrollRef.get()
      if (enrollSnap.exists) {
        return reply.code(409).send({ error: 'Already enrolled' })
      }

      const parse = z
        .object({ pricePaid: z.number().min(0).default(0) })
        .safeParse(request.body)
      const pricePaid = parse.success ? parse.data.pricePaid : 0

      const ts = now()
      const enrollment: EnrollmentDoc = {
        id: userId,
        courseId,
        orgId,
        userId,
        status: 'active',
        pricePaid,
        currency: course.currency || 'KGS',
        enrolledAt: ts,
      }

      await enrollRef.set(enrollment)
      await courseRef.update({
        enrollmentCount: (course.enrollmentCount || 0) + 1,
        updatedAt: ts,
      })

      return reply.code(201).send({ ok: true, enrollment })
    }
  )

  // Get enrolled course content (lessons) — only if enrolled
  fastify.get<{ Params: { orgId: string; courseId: string; moduleId: string } }>(
    '/marketplace/orgs/:orgId/courses/:courseId/modules/:moduleId/lessons',
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId, courseId, moduleId } = request.params
      const userId = request.user.uid

      const enrollSnap = await db
        .doc(`organizations/${orgId}/courses/${courseId}/enrollments/${userId}`)
        .get()
      if (!enrollSnap.exists) {
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
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      const { orgId, courseId, moduleId, lessonId } = request.params
      const userId = request.user.uid

      const enrollSnap = await db
        .doc(`organizations/${orgId}/courses/${courseId}/enrollments/${userId}`)
        .get()
      if (!enrollSnap.exists) {
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
  fastify.get('/marketplace/my-enrollments', async (request, reply) => {
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
  })
}
