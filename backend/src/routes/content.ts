import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../firebaseAdmin.js'
import { requireSuperAdmin } from '../plugins/superAdmin.js'

const CONTENT_COLLECTIONS = {
  TASKS: 'content/tasks/items',
  ROADMAPS: 'content/roadmaps/items',
  MATERIALS: 'content/materials/items',
  VIDEOS: 'content/videos/items',
} as const

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  ageRange: z
    .object({
      min: z.number().min(0),
      max: z.number().max(18),
    })
    .optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  estimatedDuration: z.number().optional(),
  materials: z.array(z.string()).optional(),
  instructions: z.array(z.string()).optional(),
  videoUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
})

const updateTaskSchema = createTaskSchema.partial()

const createRoadmapSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  ageRange: z
    .object({
      min: z.number().min(0),
      max: z.number().max(18),
    })
    .optional(),
  steps: z
    .array(
      z.object({
        order: z.number(),
        taskId: z.string().optional(),
        title: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
})

const updateRoadmapSchema = createRoadmapSchema.partial()

const createMaterialSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(['article', 'video', 'pdf', 'image', 'other']),
  content: z.string().optional(),
  url: z.string().url().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

const updateMaterialSchema = createMaterialSchema.partial()

const createVideoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  duration: z.number().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ageRange: z
    .object({
      min: z.number().min(0),
      max: z.number().max(18),
    })
    .optional(),
})

const updateVideoSchema = createVideoSchema.partial()

function transformFirestoreDoc(
  doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot
) {
  const data = doc.data()
  if (!data) {
    return { id: doc.id }
  }
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
  }
}

function buildUpdateData<T extends Record<string, unknown>>(
  body: Partial<T>
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {
    updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
  }

  Object.keys(body).forEach((key) => {
    if (body[key as keyof T] !== undefined) {
      updateData[key] = body[key as keyof T]
    }
  })

  return updateData
}

function createContentItem<T extends { title?: string; name?: string }>(
  collection: string,
  body: T,
  uid: string
) {
  const db = getFirestore()
  const now = new Date()
  const ref = db.collection(collection).doc()
  const id = ref.id

  const data = {
    ...body,
    createdBy: uid,
    createdAt: admin.firestore.Timestamp.fromDate(now),
    updatedAt: admin.firestore.Timestamp.fromDate(now),
  }

  return { ref, id, data }
}

function transformCreatedItem<
  T extends { createdAt: admin.firestore.Timestamp; updatedAt: admin.firestore.Timestamp },
>(id: string, data: T) {
  return {
    id,
    ...data,
    createdAt: data.createdAt.toDate().toISOString(),
    updatedAt: data.updatedAt.toDate().toISOString(),
  }
}

export const contentRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/content/tasks', async (request, reply) => {
    await requireSuperAdmin(request, reply)

    try {
      const db = getFirestore()
      const tasksSnap = await db
        .collection(CONTENT_COLLECTIONS.TASKS)
        .orderBy('createdAt', 'desc')
        .get()

      const tasks = tasksSnap.docs.map(transformFirestoreDoc)

      return { ok: true, tasks, count: tasks.length }
    } catch (error: any) {
      console.error('[CONTENT] Error fetching tasks:', error)
      return reply.code(500).send({
        error: 'Failed to fetch tasks',
        details: error.message,
      })
    }
  })

  fastify.post<{ Body: z.infer<typeof createTaskSchema> }>(
    '/admin/content/tasks',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      try {
        const { uid } = request.user!
        const body = createTaskSchema.parse(request.body)
        const { ref, id, data } = createContentItem(CONTENT_COLLECTIONS.TASKS, body, uid)

        await ref.set(data)

        return {
          ok: true,
          task: transformCreatedItem(id, data),
        }
      } catch (error: any) {
        console.error('[CONTENT] Error creating task:', error)
        return reply.code(500).send({
          error: 'Failed to create task',
          details: error.message,
        })
      }
    }
  )

  fastify.patch<{ Params: { taskId: string }; Body: z.infer<typeof updateTaskSchema> }>(
    '/admin/content/tasks/:taskId',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      try {
        const db = getFirestore()
        const { taskId } = request.params
        const body = updateTaskSchema.parse(request.body)
        const taskRef = db.doc(`${CONTENT_COLLECTIONS.TASKS}/${taskId}`)
        const taskSnap = await taskRef.get()

        if (!taskSnap.exists) {
          return reply.code(404).send({ error: 'Task not found' })
        }

        const updateData = buildUpdateData(body)
        await taskRef.update(updateData)

        const updatedData = (await taskRef.get()).data()!

        return {
          ok: true,
          task: transformFirestoreDoc(taskSnap) as any,
        }
      } catch (error: any) {
        console.error('[CONTENT] Error updating task:', error)
        return reply.code(500).send({
          error: 'Failed to update task',
          details: error.message,
        })
      }
    }
  )

  fastify.delete<{ Params: { taskId: string } }>(
    '/admin/content/tasks/:taskId',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      try {
        const db = getFirestore()
        const { taskId } = request.params
        const taskRef = db.doc(`${CONTENT_COLLECTIONS.TASKS}/${taskId}`)
        const taskSnap = await taskRef.get()

        if (!taskSnap.exists) {
          return reply.code(404).send({ error: 'Task not found' })
        }

        await taskRef.delete()

        return { ok: true, message: 'Task deleted' }
      } catch (error: any) {
        console.error('[CONTENT] Error deleting task:', error)
        return reply.code(500).send({
          error: 'Failed to delete task',
          details: error.message,
        })
      }
    }
  )

  fastify.get('/admin/content/roadmaps', async (request, reply) => {
    await requireSuperAdmin(request, reply)

    try {
      const db = getFirestore()
      const roadmapsSnap = await db
        .collection(CONTENT_COLLECTIONS.ROADMAPS)
        .orderBy('createdAt', 'desc')
        .get()

      const roadmaps = roadmapsSnap.docs.map(transformFirestoreDoc)

      return { ok: true, roadmaps, count: roadmaps.length }
    } catch (error: any) {
      console.error('[CONTENT] Error fetching roadmaps:', error)
      return reply.code(500).send({
        error: 'Failed to fetch roadmaps',
        details: error.message,
      })
    }
  })

  fastify.post<{ Body: z.infer<typeof createRoadmapSchema> }>(
    '/admin/content/roadmaps',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      try {
        const { uid } = request.user!
        const body = createRoadmapSchema.parse(request.body)
        const { ref, id, data } = createContentItem(CONTENT_COLLECTIONS.ROADMAPS, body, uid)

        await ref.set(data)

        return {
          ok: true,
          roadmap: transformCreatedItem(id, data),
        }
      } catch (error: any) {
        console.error('[CONTENT] Error creating roadmap:', error)
        return reply.code(500).send({
          error: 'Failed to create roadmap',
          details: error.message,
        })
      }
    }
  )

  fastify.patch<{ Params: { roadmapId: string }; Body: z.infer<typeof updateRoadmapSchema> }>(
    '/admin/content/roadmaps/:roadmapId',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      try {
        const db = getFirestore()
        const { roadmapId } = request.params
        const body = updateRoadmapSchema.parse(request.body)
        const roadmapRef = db.doc(`${CONTENT_COLLECTIONS.ROADMAPS}/${roadmapId}`)
        const roadmapSnap = await roadmapRef.get()

        if (!roadmapSnap.exists) {
          return reply.code(404).send({ error: 'Roadmap not found' })
        }

        const updateData = buildUpdateData(body)
        await roadmapRef.update(updateData)

        const updatedData = (await roadmapRef.get()).data()!

        return {
          ok: true,
          roadmap: transformFirestoreDoc(roadmapSnap) as any,
        }
      } catch (error: any) {
        console.error('[CONTENT] Error updating roadmap:', error)
        return reply.code(500).send({
          error: 'Failed to update roadmap',
          details: error.message,
        })
      }
    }
  )

  fastify.delete<{ Params: { roadmapId: string } }>(
    '/admin/content/roadmaps/:roadmapId',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      try {
        const db = getFirestore()
        const { roadmapId } = request.params
        const roadmapRef = db.doc(`${CONTENT_COLLECTIONS.ROADMAPS}/${roadmapId}`)
        const roadmapSnap = await roadmapRef.get()

        if (!roadmapSnap.exists) {
          return reply.code(404).send({ error: 'Roadmap not found' })
        }

        await roadmapRef.delete()

        return { ok: true, message: 'Roadmap deleted' }
      } catch (error: any) {
        console.error('[CONTENT] Error deleting roadmap:', error)
        return reply.code(500).send({
          error: 'Failed to delete roadmap',
          details: error.message,
        })
      }
    }
  )

  fastify.get('/admin/content/materials', async (request, reply) => {
    await requireSuperAdmin(request, reply)

    try {
      const db = getFirestore()
      const materialsSnap = await db
        .collection(CONTENT_COLLECTIONS.MATERIALS)
        .orderBy('createdAt', 'desc')
        .get()

      const materials = materialsSnap.docs.map(transformFirestoreDoc)

      return { ok: true, materials, count: materials.length }
    } catch (error: any) {
      console.error('[CONTENT] Error fetching materials:', error)
      return reply.code(500).send({
        error: 'Failed to fetch materials',
        details: error.message,
      })
    }
  })

  fastify.post<{ Body: z.infer<typeof createMaterialSchema> }>(
    '/admin/content/materials',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      try {
        const { uid } = request.user!
        const body = createMaterialSchema.parse(request.body)
        const { ref, id, data } = createContentItem(CONTENT_COLLECTIONS.MATERIALS, body, uid)

        await ref.set(data)

        return {
          ok: true,
          material: transformCreatedItem(id, data),
        }
      } catch (error: any) {
        console.error('[CONTENT] Error creating material:', error)
        return reply.code(500).send({
          error: 'Failed to create material',
          details: error.message,
        })
      }
    }
  )

  fastify.patch<{ Params: { materialId: string }; Body: z.infer<typeof updateMaterialSchema> }>(
    '/admin/content/materials/:materialId',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      try {
        const db = getFirestore()
        const { materialId } = request.params
        const body = updateMaterialSchema.parse(request.body)
        const materialRef = db.doc(`${CONTENT_COLLECTIONS.MATERIALS}/${materialId}`)
        const materialSnap = await materialRef.get()

        if (!materialSnap.exists) {
          return reply.code(404).send({ error: 'Material not found' })
        }

        const updateData = buildUpdateData(body)
        await materialRef.update(updateData)

        return {
          ok: true,
          material: transformFirestoreDoc(materialSnap) as any,
        }
      } catch (error: any) {
        console.error('[CONTENT] Error updating material:', error)
        return reply.code(500).send({
          error: 'Failed to update material',
          details: error.message,
        })
      }
    }
  )

  fastify.delete<{ Params: { materialId: string } }>(
    '/admin/content/materials/:materialId',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      try {
        const db = getFirestore()
        const { materialId } = request.params
        const materialRef = db.doc(`${CONTENT_COLLECTIONS.MATERIALS}/${materialId}`)
        const materialSnap = await materialRef.get()

        if (!materialSnap.exists) {
          return reply.code(404).send({ error: 'Material not found' })
        }

        await materialRef.delete()

        return { ok: true, message: 'Material deleted' }
      } catch (error: any) {
        console.error('[CONTENT] Error deleting material:', error)
        return reply.code(500).send({
          error: 'Failed to delete material',
          details: error.message,
        })
      }
    }
  )

  fastify.get('/admin/content/videos', async (request, reply) => {
    await requireSuperAdmin(request, reply)

    try {
      const db = getFirestore()
      const videosSnap = await db
        .collection(CONTENT_COLLECTIONS.VIDEOS)
        .orderBy('createdAt', 'desc')
        .get()

      const videos = videosSnap.docs.map(transformFirestoreDoc)

      return { ok: true, videos, count: videos.length }
    } catch (error: any) {
      console.error('[CONTENT] Error fetching videos:', error)
      return reply.code(500).send({
        error: 'Failed to fetch videos',
        details: error.message,
      })
    }
  })

  fastify.post<{ Body: z.infer<typeof createVideoSchema> }>(
    '/admin/content/videos',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      try {
        const { uid } = request.user!
        const body = createVideoSchema.parse(request.body)
        const { ref, id, data } = createContentItem(CONTENT_COLLECTIONS.VIDEOS, body, uid)

        await ref.set(data)

        return {
          ok: true,
          video: transformCreatedItem(id, data),
        }
      } catch (error: any) {
        console.error('[CONTENT] Error creating video:', error)
        return reply.code(500).send({
          error: 'Failed to create video',
          details: error.message,
        })
      }
    }
  )

  fastify.patch<{ Params: { videoId: string }; Body: z.infer<typeof updateVideoSchema> }>(
    '/admin/content/videos/:videoId',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      try {
        const db = getFirestore()
        const { videoId } = request.params
        const body = updateVideoSchema.parse(request.body)
        const videoRef = db.doc(`${CONTENT_COLLECTIONS.VIDEOS}/${videoId}`)
        const videoSnap = await videoRef.get()

        if (!videoSnap.exists) {
          return reply.code(404).send({ error: 'Video not found' })
        }

        const updateData = buildUpdateData(body)
        await videoRef.update(updateData)

        return {
          ok: true,
          video: transformFirestoreDoc(videoSnap) as any,
        }
      } catch (error: any) {
        console.error('[CONTENT] Error updating video:', error)
        return reply.code(500).send({
          error: 'Failed to update video',
          details: error.message,
        })
      }
    }
  )

  fastify.delete<{ Params: { videoId: string } }>(
    '/admin/content/videos/:videoId',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      try {
        const db = getFirestore()
        const { videoId } = request.params
        const videoRef = db.doc(`${CONTENT_COLLECTIONS.VIDEOS}/${videoId}`)
        const videoSnap = await videoRef.get()

        if (!videoSnap.exists) {
          return reply.code(404).send({ error: 'Video not found' })
        }

        await videoRef.delete()

        return { ok: true, message: 'Video deleted' }
      } catch (error: any) {
        console.error('[CONTENT] Error deleting video:', error)
        return reply.code(500).send({
          error: 'Failed to delete video',
          details: error.message,
        })
      }
    }
  )
}
