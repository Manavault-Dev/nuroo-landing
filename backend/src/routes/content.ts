import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'
import multipart from '@fastify/multipart'

import { getFirestore, getStorage, getApp } from '../infrastructure/database/firebase.js'
import { requireSuperAdmin } from '../plugins/superAdmin.js'

// Collections
const COLLECTIONS = {
  TASKS: 'content/tasks/items',
  ROADMAPS: 'content/roadmaps/items',
} as const

// Schemas
const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  ageRange: z.object({ min: z.number().min(0), max: z.number().max(18) }).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  estimatedDuration: z.number().optional(),
  instructions: z.array(z.string()).optional(),
  videoUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  mediaType: z.enum(['video', 'image', 'none']).optional(),
})

const roadmapSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  ageRange: z.object({ min: z.number().min(0), max: z.number().max(18) }).optional(),
  taskIds: z.array(z.string()).default([]),
})

// Helpers
function toTimestamp(date = new Date()) {
  return admin.firestore.Timestamp.fromDate(date)
}

function transformDoc(doc: admin.firestore.DocumentSnapshot) {
  const data = doc.data()
  if (!data) return { id: doc.id }

  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
  }
}

function buildUpdateData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = { updatedAt: toTimestamp() }
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) data[key] = value
  }
  return data
}

async function getStorageBucket() {
  const storage = getStorage()
  const app = getApp()
  const projectId = app.options.projectId
  const configuredBucket = app.options.storageBucket

  const candidates = [
    configuredBucket,
    `${projectId}.firebasestorage.app`,
    `${projectId}.appspot.com`,
  ].filter(Boolean) as string[]

  for (const name of candidates) {
    try {
      const bucket = storage.bucket(name)
      const [exists] = await bucket.exists()
      if (exists) return bucket
    } catch {
      continue
    }
  }

  throw new Error('Storage bucket not found. Check FIREBASE_STORAGE_BUCKET config.')
}

export const contentRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } })

  // Tasks CRUD
  fastify.get('/admin/content/tasks', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const db = getFirestore()
    const snap = await db.collection(COLLECTIONS.TASKS).orderBy('createdAt', 'desc').get()
    return { ok: true, tasks: snap.docs.map(transformDoc), count: snap.size }
  })

  fastify.post('/admin/content/tasks', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const db = getFirestore()
    const { uid } = request.user!
    const body = taskSchema.parse(request.body)

    const ref = db.collection(COLLECTIONS.TASKS).doc()
    const data = { ...body, createdBy: uid, createdAt: toTimestamp(), updatedAt: toTimestamp() }
    await ref.set(data)

    return { ok: true, task: { id: ref.id, ...data } }
  })

  fastify.patch('/admin/content/tasks/:taskId', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const db = getFirestore()
    const { taskId } = request.params as { taskId: string }
    const body = taskSchema.partial().parse(request.body)

    const ref = db.doc(`${COLLECTIONS.TASKS}/${taskId}`)
    const snap = await ref.get()
    if (!snap.exists) return reply.code(404).send({ error: 'Task not found' })

    await ref.update(buildUpdateData(body))
    return { ok: true, task: transformDoc(await ref.get()) }
  })

  fastify.delete('/admin/content/tasks/:taskId', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const db = getFirestore()
    const { taskId } = request.params as { taskId: string }

    const ref = db.doc(`${COLLECTIONS.TASKS}/${taskId}`)
    if (!(await ref.get()).exists) return reply.code(404).send({ error: 'Task not found' })

    await ref.delete()
    return { ok: true }
  })

  // Roadmaps CRUD
  fastify.get('/admin/content/roadmaps', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const db = getFirestore()
    const snap = await db.collection(COLLECTIONS.ROADMAPS).orderBy('createdAt', 'desc').get()
    return { ok: true, roadmaps: snap.docs.map(transformDoc), count: snap.size }
  })

  fastify.post('/admin/content/roadmaps', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const db = getFirestore()
    const { uid } = request.user!
    const body = roadmapSchema.parse(request.body)

    const ref = db.collection(COLLECTIONS.ROADMAPS).doc()
    const data = { ...body, createdBy: uid, createdAt: toTimestamp(), updatedAt: toTimestamp() }
    await ref.set(data)

    return { ok: true, roadmap: { id: ref.id, ...data } }
  })

  fastify.patch('/admin/content/roadmaps/:roadmapId', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const db = getFirestore()
    const { roadmapId } = request.params as { roadmapId: string }
    const body = roadmapSchema.partial().parse(request.body)

    const ref = db.doc(`${COLLECTIONS.ROADMAPS}/${roadmapId}`)
    if (!(await ref.get()).exists) return reply.code(404).send({ error: 'Roadmap not found' })

    await ref.update(buildUpdateData(body))
    return { ok: true, roadmap: transformDoc(await ref.get()) }
  })

  fastify.delete('/admin/content/roadmaps/:roadmapId', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const db = getFirestore()
    const { roadmapId } = request.params as { roadmapId: string }

    const ref = db.doc(`${COLLECTIONS.ROADMAPS}/${roadmapId}`)
    if (!(await ref.get()).exists) return reply.code(404).send({ error: 'Roadmap not found' })

    await ref.delete()
    return { ok: true }
  })

  // Task Media Upload
  fastify.post('/admin/content/tasks/upload', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const { uid } = request.user!
    const taskId = (request.query as { taskId?: string })?.taskId

    // Collect all parts first
    const parts = (request as any).parts()
    const fields: Record<string, string> = {}
    let mediaFile: any = null

    for await (const part of parts) {
      if (part.type === 'field') {
        fields[part.fieldname] = part.value as string
      } else if (part.type === 'file') {
        mediaFile = part
      }
    }

    if (!mediaFile) {
      return reply.code(400).send({ error: 'No media file uploaded' })
    }

    // Validate file type
    const isVideo = mediaFile.mimetype.startsWith('video/')
    const isImage = mediaFile.mimetype.startsWith('image/')
    if (!isVideo && !isImage) {
      return reply.code(400).send({ error: 'Only video and image files allowed' })
    }

    // Upload to storage
    const bucket = await getStorageBucket()
    const folder = isVideo ? 'videos' : 'images'
    const fileName = `content/tasks/${folder}/${uid}/${Date.now()}_${mediaFile.filename}`
    const file = bucket.file(fileName)

    const buffer = await mediaFile.toBuffer()
    await file.save(buffer, {
      metadata: { contentType: mediaFile.mimetype },
    })
    await file.makePublic()

    const mediaUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`

    // Build task data
    const taskData: Record<string, unknown> = {
      title: fields.title || mediaFile.filename || 'Untitled',
      mediaType: isVideo ? 'video' : 'image',
      [isVideo ? 'videoUrl' : 'imageUrl']: mediaUrl,
    }

    if (fields.description) taskData.description = fields.description
    if (fields.category) taskData.category = fields.category
    if (fields.difficulty) taskData.difficulty = fields.difficulty
    if (fields.estimatedDuration) taskData.estimatedDuration = parseInt(fields.estimatedDuration)
    if (fields.ageRangeMin && fields.ageRangeMax) {
      taskData.ageRange = {
        min: parseInt(fields.ageRangeMin),
        max: parseInt(fields.ageRangeMax),
      }
    }
    if (fields.instructions) {
      try {
        taskData.instructions = JSON.parse(fields.instructions)
      } catch {
        taskData.instructions = [fields.instructions]
      }
    }

    // Save or update
    const db = getFirestore()
    if (taskId) {
      const ref = db.doc(`${COLLECTIONS.TASKS}/${taskId}`)
      if (!(await ref.get()).exists) {
        return reply.code(404).send({ error: 'Task not found' })
      }
      await ref.update(buildUpdateData(taskData))
      return { ok: true, task: transformDoc(await ref.get()) }
    }

    const ref = db.collection(COLLECTIONS.TASKS).doc()
    const data = { ...taskData, createdBy: uid, createdAt: toTimestamp(), updatedAt: toTimestamp() }
    await ref.set(data)

    return { ok: true, task: { id: ref.id, ...data } }
  })
}
