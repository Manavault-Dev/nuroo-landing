import multipart from '@fastify/multipart'
import { z } from 'zod'

import { getFirestore, getStorageBucket } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../plugins/rbac.js'
import {
  listContentTasks,
  getContentTask,
  createContentTask,
  uploadContentTask,
  updateContentTask,
  deleteContentTask,
  listContentRoadmaps,
  createContentRoadmap,
  updateContentRoadmap,
  deleteContentRoadmap,
} from './orgContent.service.js'

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

export const orgContentAdminRoute: import('fastify').FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } })

  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/content/tasks',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)
        const db = getFirestore()
        const result = await listContentTasks(db, orgId)
        return { ok: true, ...result }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to list tasks' })
      }
    }
  )

  fastify.get<{ Params: { orgId: string; taskId: string } }>(
    '/orgs/:orgId/content/tasks/:taskId',
    async (request, reply) => {
      try {
        const { orgId, taskId } = request.params
        await requireOrgMember(request, reply, orgId)
        const db = getFirestore()
        try {
          const task = await getContentTask(db, orgId, taskId)
          return { ok: true, task }
        } catch (e: any) {
          if (e.statusCode === 404) return reply.code(404).send({ error: e.message })
          throw e
        }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to get task' })
      }
    }
  )

  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof taskSchema> }>(
    '/orgs/:orgId/content/tasks',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)
        if (!request.user) return
        const db = getFirestore()
        const body = taskSchema.parse(request.body)
        const { id, doc } = await createContentTask(db, orgId, request.user.uid, body)
        return reply.code(201).send({ ok: true, task: { id, ...doc } })
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
        const db = getFirestore()
        const bucket = await getStorageBucket()
        const { id, doc } = await uploadContentTask(
          db,
          orgId,
          request.user.uid,
          bucket,
          mediaBuffer,
          mediaMimetype,
          mediaFilename,
          fields
        )
        return reply.code(201).send({ ok: true, task: { id, ...doc } })
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
      try {
        const task = await updateContentTask(db, orgId, taskId, body)
        return { ok: true, task }
      } catch (e: any) {
        if (e.statusCode === 404) return reply.code(404).send({ error: e.message })
        throw e
      }
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
        try {
          await deleteContentTask(db, orgId, taskId)
          return { ok: true }
        } catch (e: any) {
          if (e.statusCode === 404) return reply.code(404).send({ error: e.message })
          throw e
        }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to delete task' })
      }
    }
  )

  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/content/roadmaps',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)
        const db = getFirestore()
        const result = await listContentRoadmaps(db, orgId)
        return { ok: true, ...result }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to list roadmaps' })
      }
    }
  )

  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof roadmapSchema> }>(
    '/orgs/:orgId/content/roadmaps',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)
        if (!request.user) return
        const db = getFirestore()
        const body = roadmapSchema.parse(request.body)
        const { id, doc } = await createContentRoadmap(db, orgId, request.user.uid, body)
        return reply.code(201).send({ ok: true, roadmap: { id, ...doc } })
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
      if (!request.user) return
      const db = getFirestore()
      const body = roadmapSchema.partial().parse(request.body)
      try {
        const roadmap = await updateContentRoadmap(db, orgId, roadmapId, body, request.user.uid)
        return { ok: true, roadmap }
      } catch (e: any) {
        if (e.statusCode === 404) return reply.code(404).send({ error: e.message })
        throw e
      }
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
        try {
          await deleteContentRoadmap(db, orgId, roadmapId)
          return { ok: true }
        } catch (e: any) {
          if (e.statusCode === 404) return reply.code(404).send({ error: e.message })
          throw e
        }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to delete roadmap' })
      }
    }
  )
}
