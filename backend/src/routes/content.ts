import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'
import multipart from '@fastify/multipart'

import { getFirestore, getStorage, getApp, getAuth } from '../infrastructure/database/firebase.js'
import { requireSuperAdmin } from '../plugins/superAdmin.js'

const COLLECTIONS = {
  TASKS: 'content/tasks/items',
  ROADMAPS: 'content/roadmaps/items',
  ALPHAKIDS_ACCESS_CODES: 'alphakidsAccessCodes',
  ALPHAKIDS_TASK_COMPLETIONS: 'alphakidsTaskCompletions',
} as const

const ALPHAKIDS_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function generateAlphakidsCode(length = 8): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ALPHAKIDS_CODE_CHARS.charAt(Math.floor(Math.random() * ALPHAKIDS_CODE_CHARS.length))
  }
  return code
}
function normalizeAlphakidsCode(code: string): string {
  return code.trim().toUpperCase()
}
async function validateAlphakidsCode(
  db: admin.firestore.Firestore,
  code: string
): Promise<boolean> {
  const doc = await getAlphakidsCodeDoc(db, code)
  return doc !== null
}

async function getAlphakidsCodeDoc(
  db: admin.firestore.Firestore,
  code: string
): Promise<{ expiresAt: Date | null; duration: string } | null> {
  const normalized = normalizeAlphakidsCode(code)
  if (!normalized) return null
  const ref = db.collection(COLLECTIONS.ALPHAKIDS_ACCESS_CODES).doc(normalized)
  const snap = await ref.get()
  if (!snap.exists) return null
  const data = snap.data()!
  const expiresAt = data.expiresAt?.toDate?.() ?? null
  if (expiresAt !== null && expiresAt !== undefined && expiresAt < new Date()) return null
  return { expiresAt, duration: (data.duration as string) || 'forever' }
}

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

  fastify.post('/api/parent/alphakids/validate', async (request, reply) => {
    const db = getFirestore()
    const body = (request.body as { code?: string }) || {}
    const code = body.code?.trim()
    if (!code) {
      return reply.code(400).send({ error: 'code is required', ok: false })
    }
    const doc = await getAlphakidsCodeDoc(db, code)
    if (!doc) {
      return reply.code(401).send({ error: 'Invalid or expired code', ok: false })
    }
    return reply.send({
      ok: true,
      expiresAt: doc.expiresAt?.toISOString() ?? null,
      duration: doc.duration,
    })
  })

  async function requireAlphakidsCode(
    request: { query?: { code?: string } },
    reply: { code: (n: number) => { send: (body: unknown) => unknown } }
  ): Promise<admin.firestore.Firestore | null> {
    const db = getFirestore()
    const code = request.query?.code
    if (!code) {
      reply.code(401).send({ error: 'Access code required. Use query param: ?code=YOUR_CODE' })
      return null
    }
    const valid = await validateAlphakidsCode(db, code)
    if (!valid) {
      reply.code(401).send({ error: 'Invalid or expired access code' })
      return null
    }
    return db
  }

  async function requireAlphakidsCodeAndAuth(
    request: { query?: { code?: string }; headers?: { authorization?: string } },
    reply: { code: (n: number) => { send: (body: unknown) => unknown } }
  ): Promise<{ db: admin.firestore.Firestore; parentId: string } | null> {
    const db = await requireAlphakidsCode(request, reply)
    if (!db) return null
    const authHeader = request.headers?.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Bearer token required' })
      return null
    }
    try {
      const token = authHeader.substring(7)
      const decoded = await getAuth().verifyIdToken(token)
      return { db, parentId: decoded.uid }
    } catch {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token' })
      return null
    }
  }

  fastify.get('/api/parent/content/roadmaps', async (request, reply) => {
    const db = await requireAlphakidsCode(request, reply)
    if (!db) return
    const snap = await db.collection(COLLECTIONS.ROADMAPS).orderBy('createdAt', 'desc').get()
    return { ok: true, roadmaps: snap.docs.map(transformDoc), count: snap.size }
  })

  fastify.get('/api/parent/content/roadmaps/:roadmapId', async (request, reply) => {
    const db = await requireAlphakidsCode(request, reply)
    if (!db) return
    const { roadmapId } = request.params as { roadmapId: string }
    const ref = db.doc(`${COLLECTIONS.ROADMAPS}/${roadmapId}`)
    const snap = await ref.get()
    if (!snap.exists) return reply.code(404).send({ error: 'Roadmap not found' })
    const roadmap = transformDoc(snap) as Record<string, unknown>
    const taskIds = (roadmap.taskIds as string[] | undefined) || []
    if (taskIds.length > 0) {
      const taskSnaps = await Promise.all(
        taskIds.map((id) => db.doc(`${COLLECTIONS.TASKS}/${id}`).get())
      )
      const tasks = taskSnaps.filter((s) => s.exists).map((s) => transformDoc(s))
      return { ok: true, roadmap: { ...roadmap, tasks } }
    }
    return { ok: true, roadmap: { ...roadmap, tasks: [] } }
  })

  fastify.get('/api/parent/content/tasks', async (request, reply) => {
    const db = await requireAlphakidsCode(request, reply)
    if (!db) return
    const { ids } = request.query as { ids?: string }
    if (ids) {
      const taskIds = ids
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (taskIds.length === 0) return { ok: true, tasks: [], count: 0 }
      const taskSnaps = await Promise.all(
        taskIds.map((id) => db.doc(`${COLLECTIONS.TASKS}/${id}`).get())
      )
      const tasks = taskSnaps.filter((s) => s.exists).map((s) => transformDoc(s))
      return { ok: true, tasks, count: tasks.length }
    }
    const snap = await db.collection(COLLECTIONS.TASKS).orderBy('createdAt', 'desc').get()
    return { ok: true, tasks: snap.docs.map(transformDoc), count: snap.size }
  })

  fastify.get('/api/parent/content/tasks/completed', async (request, reply) => {
    const ctx = await requireAlphakidsCodeAndAuth(request, reply)
    if (!ctx) return
    const { db, parentId } = ctx
    const { roadmapId, fromDate, toDate } = request.query as {
      roadmapId?: string
      fromDate?: string
      toDate?: string
    }
    const snap = await db
      .collection(COLLECTIONS.ALPHAKIDS_TASK_COMPLETIONS)
      .where('parentId', '==', parentId)
      .where('completed', '==', true)
      .orderBy('completedAt', 'desc')
      .limit(200)
      .get()
    let items = snap.docs.map((d) => {
      const data = d.data()
      return {
        taskId: data.taskId,
        completed: true,
        completedAt: data.completedAt?.toDate?.()?.toISOString() ?? null,
        roadmapId: data.roadmapId ?? null,
      }
    })
    if (roadmapId) items = items.filter((i) => i.roadmapId === roadmapId)
    if (fromDate) {
      const from = new Date(fromDate)
      if (!isNaN(from.getTime()))
        items = items.filter((i) => i.completedAt && new Date(i.completedAt) >= from)
    }
    if (toDate) {
      const to = new Date(toDate)
      if (!isNaN(to.getTime()))
        items = items.filter((i) => i.completedAt && new Date(i.completedAt) <= to)
    }
    return { ok: true, tasks: items, count: items.length }
  })

  fastify.get('/api/parent/content/tasks/:taskId/complete', async (request, reply) => {
    const ctx = await requireAlphakidsCodeAndAuth(request, reply)
    if (!ctx) return
    const { db, parentId } = ctx
    const { taskId } = request.params as { taskId: string }
    const taskRef = db.doc(`${COLLECTIONS.TASKS}/${taskId}`)
    if (!(await taskRef.get()).exists) {
      return reply
        .code(404)
        .send({ ok: false, error: 'Not Found', message: 'Task not found or not accessible' })
    }
    const docId = `${taskId}_${parentId}`
    const compRef = db.collection(COLLECTIONS.ALPHAKIDS_TASK_COMPLETIONS).doc(docId)
    const compSnap = await compRef.get()
    if (!compSnap.exists) {
      return reply.send({ ok: true, completed: false, completedAt: null })
    }
    const data = compSnap.data()!
    return reply.send({
      ok: true,
      completed: data.completed === true,
      completedAt: data.completedAt?.toDate?.()?.toISOString() ?? null,
    })
  })

  const completeBodySchema = z.object({
    completed: z.boolean(),
    childId: z.string().optional(),
    roadmapId: z.string().optional(),
  })

  fastify.post('/api/parent/content/tasks/:taskId/complete', async (request, reply) => {
    const ctx = await requireAlphakidsCodeAndAuth(request, reply)
    if (!ctx) return
    const { db, parentId } = ctx
    const { taskId } = request.params as { taskId: string }
    const parseResult = completeBodySchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.code(400).send({
        ok: false,
        error: 'Bad Request',
        message: "Missing 'completed' field in request body or invalid type",
      })
    }
    const { completed, childId, roadmapId } = parseResult.data
    const taskRef = db.doc(`${COLLECTIONS.TASKS}/${taskId}`)
    const taskSnap = await taskRef.get()
    if (!taskSnap.exists) {
      return reply
        .code(404)
        .send({ ok: false, error: 'Not Found', message: 'Task not found or not accessible' })
    }
    const docId = childId ? `${taskId}_${parentId}_${childId}` : `${taskId}_${parentId}`
    const compRef = db.collection(COLLECTIONS.ALPHAKIDS_TASK_COMPLETIONS).doc(docId)
    const now = toTimestamp()
    const update: Record<string, unknown> = {
      taskId,
      parentId,
      completed,
      updatedAt: now,
    }
    if (childId) update.childId = childId
    if (roadmapId) update.roadmapId = roadmapId
    if (completed) {
      update.completedAt = now
    } else {
      update.completedAt = null
    }
    const existing = await compRef.get()
    if (existing.exists) {
      await compRef.update(update)
    } else {
      await compRef.set({ ...update, createdAt: now })
    }
    return reply.send({ ok: true, message: 'Task completion status updated' })
  })

  fastify.get('/api/parent/content/tasks/:taskId', async (request, reply) => {
    const db = await requireAlphakidsCode(request, reply)
    if (!db) return
    const { taskId } = request.params as { taskId: string }
    const ref = db.doc(`${COLLECTIONS.TASKS}/${taskId}`)
    const snap = await ref.get()
    if (!snap.exists) return reply.code(404).send({ error: 'Task not found' })
    return { ok: true, task: transformDoc(snap) }
  })

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

  const alphakidsDurationSchema = z.object({
    duration: z.enum(['7d', '30d', 'forever']),
  })

  fastify.post('/admin/content/alphakids-codes', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const db = getFirestore()
    const { uid } = request.user!
    const { duration } = alphakidsDurationSchema.parse(request.body)
    let expiresAt: admin.firestore.Timestamp | null = null
    if (duration === '7d') {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      expiresAt = toTimestamp(d)
    } else if (duration === '30d') {
      const d = new Date()
      d.setDate(d.getDate() + 30)
      expiresAt = toTimestamp(d)
    }
    let code = generateAlphakidsCode(8)
    const col = db.collection(COLLECTIONS.ALPHAKIDS_ACCESS_CODES)
    while ((await col.doc(normalizeAlphakidsCode(code)).get()).exists) {
      code = generateAlphakidsCode(8)
    }
    const normalizedCode = normalizeAlphakidsCode(code)
    await col.doc(normalizedCode).set({
      code: normalizedCode,
      duration,
      expiresAt,
      createdBy: uid,
      createdAt: toTimestamp(),
    })
    return {
      ok: true,
      code: normalizedCode,
      duration,
      expiresAt: expiresAt?.toDate?.()?.toISOString() ?? null,
    }
  })

  fastify.get('/admin/content/alphakids-codes', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const db = getFirestore()
    const snap = await db
      .collection(COLLECTIONS.ALPHAKIDS_ACCESS_CODES)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    const list = snap.docs.map((d) => {
      const data = d.data()
      return {
        code: data.code ?? d.id,
        duration: data.duration,
        expiresAt: data.expiresAt?.toDate?.()?.toISOString() ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      }
    })
    return { ok: true, codes: list, count: list.length }
  })

  fastify.post('/admin/content/tasks/upload', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const { uid } = request.user!
    const taskId = (request.query as { taskId?: string })?.taskId

    type Part = {
      type: string
      fieldname?: string
      value?: string
      filename?: string
      mimetype?: string
      toBuffer(): Promise<Buffer>
    }
    const parts = (request as { parts: () => AsyncIterable<Part> }).parts()
    const fields: Record<string, string> = {}
    let mediaFile: Part | null = null

    for await (const part of parts) {
      if (part.type === 'field') {
        fields[part.fieldname as string] = part.value as string
      } else if (part.type === 'file') {
        mediaFile = part
      }
    }

    if (!mediaFile) {
      return reply.code(400).send({ error: 'No media file uploaded' })
    }

    const isVideo = mediaFile.mimetype.startsWith('video/')
    const isImage = mediaFile.mimetype.startsWith('image/')
    if (!isVideo && !isImage) {
      return reply.code(400).send({ error: 'Only video and image files allowed' })
    }

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
