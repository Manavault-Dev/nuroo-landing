import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import multipart from '@fastify/multipart'
import { z } from 'zod'

import { getFirestore, getStorageBucket } from '../infrastructure/database/firebase.js'
import { requireOrgMember } from '../plugins/rbac.js'

const COLLECTIONS = {
  ORG_TASKS: (orgId: string) => `organizations/${orgId}/contentTasks`,
  ORG_ROADMAPS: (orgId: string) => `organizations/${orgId}/contentRoadmaps`,
} as const

function toTimestamp(date = new Date()) {
  return admin.firestore.Timestamp.fromDate(date)
}

const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  ageRange: z.object({ min: z.number().min(0), max: z.number().max(18) }).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  estimatedDuration: z.number().optional(),
  instructions: z.array(z.string()).optional(),
  videoUrl: z.string().url().optional().or(z.literal('')),
  imageUrl: z.string().url().optional().or(z.literal('')),
  mediaType: z.enum(['video', 'image', 'none']).optional(),
})

const roadmapSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  ageRange: z.object({ min: z.number().min(0), max: z.number().max(18) }).optional(),
  taskIds: z.array(z.string()).default([]),
})

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

export const orgContentRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } })

  // ——— Tasks ———
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/content/tasks', async (request, reply) => {
    try {
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)
      const db = getFirestore()
      const snap = await db.collection(COLLECTIONS.ORG_TASKS(orgId)).orderBy('createdAt', 'desc').get()
      return { ok: true, tasks: snap.docs.map((d) => transformDoc(d)), count: snap.size }
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || 'Failed to list tasks' })
    }
  })

  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof taskSchema> }>(
    '/orgs/:orgId/content/tasks',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)
        if (!request.user) return
        const db = getFirestore()
        const body = taskSchema.parse(request.body)
        const ref = db.collection(COLLECTIONS.ORG_TASKS(orgId)).doc()
        const data = {
          ...body,
          createdBy: request.user.uid,
          createdAt: toTimestamp(),
          updatedAt: toTimestamp(),
        }
        await ref.set(data)
        return reply.code(201).send({ ok: true, task: { id: ref.id, ...transformDoc(await ref.get()) } })
      } catch (e: any) {
        return reply.code(400).send({ error: e?.message || 'Failed to create task' })
      }
    }
  )

  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/content/tasks/upload',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)
        if (!request.user) return
        const parts = request.parts()
        const fields: Record<string, string> = {}
        let mediaBuffer: Buffer | null = null
        let mediaMimetype = ''
        let mediaFilename = 'file'
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'media') {
            const chunks: Buffer[] = []
            for await (const chunk of part.file) chunks.push(chunk)
            mediaBuffer = Buffer.concat(chunks)
            mediaMimetype = part.mimetype || ''
            mediaFilename = part.filename || 'file'
          } else if (part.type === 'field') {
            fields[part.fieldname] = (part as any).value
          }
        }
        if (!mediaBuffer || mediaBuffer.length === 0) {
          return reply.code(400).send({ error: 'Media file is required' })
        }
        const title = (fields.title || '').trim() || mediaFilename.replace(/\.[^/.]+$/, '')
        const bucket = await getStorageBucket()
        const safeName = mediaFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `orgs/${orgId}/content/${Date.now()}-${safeName}`
        const file = bucket.file(storagePath)
        await file.save(mediaBuffer, {
          contentType: mediaMimetype || undefined,
          metadata: { cacheControl: 'public, max-age=31536000' },
        })
        await file.makePublic()
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`
        const isVideo = mediaMimetype.startsWith('video/')
        const taskData = {
          title,
          description: fields.description?.trim() || undefined,
          category: fields.category?.trim() || undefined,
          difficulty: (['easy', 'medium', 'hard'].includes(fields.difficulty)
            ? fields.difficulty
            : undefined) as 'easy' | 'medium' | 'hard' | undefined,
          estimatedDuration: fields.estimatedDuration
            ? parseInt(fields.estimatedDuration, 10)
            : undefined,
          ageRange:
            fields.ageRangeMin && fields.ageRangeMax
              ? { min: parseInt(fields.ageRangeMin, 10), max: parseInt(fields.ageRangeMax, 10) }
              : undefined,
          instructions:
            fields.instructions && fields.instructions.trim()
              ? (() => {
                  try {
                    return JSON.parse(fields.instructions) as string[]
                  } catch {
                    return undefined
                  }
                })()
              : undefined,
          videoUrl: isVideo ? publicUrl : undefined,
          imageUrl: !isVideo ? publicUrl : undefined,
          createdBy: request.user.uid,
          createdAt: toTimestamp(),
          updatedAt: toTimestamp(),
        }
        const db = getFirestore()
        const ref = db.collection(COLLECTIONS.ORG_TASKS(orgId)).doc()
        await ref.set(taskData)
        return reply.code(201).send({
          ok: true,
          task: { id: ref.id, ...transformDoc(await ref.get()) },
        })
      } catch (e: any) {
        return reply.code(400).send({ error: e?.message || 'Upload failed' })
      }
    }
  )

  fastify.patch<{
    Params: { orgId: string; taskId: string }
    Body: Partial<z.infer<typeof taskSchema>>
  }>('/orgs/:orgId/content/tasks/:taskId', async (request, reply) => {
    try {
      const { orgId, taskId } = request.params
      await requireOrgMember(request, reply, orgId)
      const db = getFirestore()
      const body = taskSchema.partial().parse(request.body)
      const ref = db.doc(`${COLLECTIONS.ORG_TASKS(orgId)}/${taskId}`)
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Task not found' })
      await ref.update(buildUpdateData(body))
      return { ok: true, task: transformDoc(await ref.get()) }
    } catch (e: any) {
      return reply.code(400).send({ error: e?.message || 'Failed to update task' })
    }
  })

  fastify.delete<{ Params: { orgId: string; taskId: string } }>(
    '/orgs/:orgId/content/tasks/:taskId',
    async (request, reply) => {
      try {
        const { orgId, taskId } = request.params
        await requireOrgMember(request, reply, orgId)
        const db = getFirestore()
        const ref = db.doc(`${COLLECTIONS.ORG_TASKS(orgId)}/${taskId}`)
        if (!(await ref.get()).exists) return reply.code(404).send({ error: 'Task not found' })
        await ref.delete()
        return { ok: true }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to delete task' })
      }
    }
  )

  // ——— Roadmaps ———
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/content/roadmaps', async (request, reply) => {
    try {
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)
      const db = getFirestore()
      const snap = await db.collection(COLLECTIONS.ORG_ROADMAPS(orgId)).orderBy('createdAt', 'desc').get()
      return { ok: true, roadmaps: snap.docs.map((d) => transformDoc(d)), count: snap.size }
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || 'Failed to list roadmaps' })
    }
  })

  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof roadmapSchema> }>(
    '/orgs/:orgId/content/roadmaps',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)
        if (!request.user) return
        const db = getFirestore()
        const body = roadmapSchema.parse(request.body)
        const ref = db.collection(COLLECTIONS.ORG_ROADMAPS(orgId)).doc()
        const data = {
          ...body,
          createdBy: request.user.uid,
          createdAt: toTimestamp(),
          updatedAt: toTimestamp(),
        }
        await ref.set(data)
        return reply.code(201).send({ ok: true, roadmap: { id: ref.id, ...transformDoc(await ref.get()) } })
      } catch (e: any) {
        return reply.code(400).send({ error: e?.message || 'Failed to create roadmap' })
      }
    }
  )

  fastify.patch<{
    Params: { orgId: string; roadmapId: string }
    Body: Partial<z.infer<typeof roadmapSchema>>
  }>('/orgs/:orgId/content/roadmaps/:roadmapId', async (request, reply) => {
    try {
      const { orgId, roadmapId } = request.params
      await requireOrgMember(request, reply, orgId)
      const db = getFirestore()
      const body = roadmapSchema.partial().parse(request.body)
      const ref = db.doc(`${COLLECTIONS.ORG_ROADMAPS(orgId)}/${roadmapId}`)
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Roadmap not found' })
      await ref.update(buildUpdateData(body))
      return { ok: true, roadmap: transformDoc(await ref.get()) }
    } catch (e: any) {
      return reply.code(400).send({ error: e?.message || 'Failed to update roadmap' })
    }
  })

  fastify.delete<{ Params: { orgId: string; roadmapId: string } }>(
    '/orgs/:orgId/content/roadmaps/:roadmapId',
    async (request, reply) => {
      try {
        const { orgId, roadmapId } = request.params
        await requireOrgMember(request, reply, orgId)
        const db = getFirestore()
        const ref = db.doc(`${COLLECTIONS.ORG_ROADMAPS(orgId)}/${roadmapId}`)
        if (!(await ref.get()).exists) return reply.code(404).send({ error: 'Roadmap not found' })
        await ref.delete()
        return { ok: true }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to delete roadmap' })
      }
    }
  )
}
