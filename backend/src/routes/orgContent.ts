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

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

export const orgContentRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } })

  // ——— Tasks ———
  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/content/tasks',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)
        const db = getFirestore()
        const snap = await db
          .collection(COLLECTIONS.ORG_TASKS(orgId))
          .orderBy('createdAt', 'desc')
          .get()
        return { ok: true, tasks: snap.docs.map((d) => transformDoc(d)), count: snap.size }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to list tasks' })
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
        const ref = db.collection(COLLECTIONS.ORG_TASKS(orgId)).doc()
        const data = stripUndefined({
          ...body,
          createdBy: request.user.uid,
          createdAt: toTimestamp(),
          updatedAt: toTimestamp(),
        })
        await ref.set(data)
        return reply
          .code(201)
          .send({ ok: true, task: { id: ref.id, ...transformDoc(await ref.get()) } })
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
        await ref.set(stripUndefined(taskData))
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
  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/content/roadmaps',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)
        const db = getFirestore()
        const snap = await db
          .collection(COLLECTIONS.ORG_ROADMAPS(orgId))
          .orderBy('createdAt', 'desc')
          .get()
        return { ok: true, roadmaps: snap.docs.map((d) => transformDoc(d)), count: snap.size }
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
        const ref = db.collection(COLLECTIONS.ORG_ROADMAPS(orgId)).doc()
        const data = stripUndefined({
          ...body,
          createdBy: request.user.uid,
          createdAt: toTimestamp(),
          updatedAt: toTimestamp(),
        })
        await ref.set(data)
        return reply
          .code(201)
          .send({ ok: true, roadmap: { id: ref.id, ...transformDoc(await ref.get()) } })
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

  // ——— Parent-facing content routes ———
  // These are for the mobile parent app (Bearer token auth, parent linked to org)

  /** Verify parent is linked to this organization and return their child IDs */
  async function requireParentOrgAccess(
    request: { user?: { uid: string } },
    reply: { code: (n: number) => { send: (body: unknown) => unknown } },
    orgId: string
  ): Promise<{ parentUid: string; childIds: string[] } | false> {
    if (!request.user) {
      reply.code(401).send({ error: 'Unauthorized' })
      return false
    }
    const db = getFirestore()
    const parentUid = request.user.uid

    // 1. Primary check: orgParents collection (created on invite acceptance)
    const orgParentRef = db.doc(`orgParents/${orgId}/parents/${parentUid}`)
    const orgParentSnap = await orgParentRef.get()

    // 2. Query organizations/{orgId}/children by parentUserId (NO assigned filter —
    //    the field may be missing or false for newly joined parents)
    const childQuery = await db
      .collection(`organizations/${orgId}/children`)
      .where('parentUserId', '==', parentUid)
      .get()

    // Exclude only explicitly disconnected children (assigned === false)
    let childIds = childQuery.docs.filter((d) => d.data().assigned !== false).map((d) => d.id)

    // 3. If we have org access but no children yet — try to find children via
    //    the specialist's group membership (parent may have joined before children were linked)
    if (childIds.length === 0 && orgParentSnap.exists) {
      const specialistUid = orgParentSnap.data()?.linkedSpecialistUid as string | undefined
      if (specialistUid) {
        try {
          const groupsSnap = await db
            .collection(`specialists/${specialistUid}/groups`)
            .where('orgId', '==', orgId)
            .get()

          const groupChildIds: string[] = []
          for (const groupDoc of groupsSnap.docs) {
            const parentDoc = await db
              .doc(`specialists/${specialistUid}/groups/${groupDoc.id}/parents/${parentUid}`)
              .get()
            if (parentDoc.exists) {
              const ids = (parentDoc.data()?.childIds as string[] | undefined) || []
              groupChildIds.push(...ids)
            }
          }
          childIds = [...new Set(groupChildIds)]
        } catch {
          // ignore — fallback failed, continue with empty childIds
        }
      }
    }

    // 4. Fallback: linkedOrganizationsById in users collection (legacy)
    if (!orgParentSnap.exists && childIds.length === 0) {
      const userSnap = await db.doc(`users/${parentUid}`).get()
      if (userSnap.exists) {
        const linkedOrgs = userSnap.data()?.linkedOrganizationsById || {}
        if (linkedOrgs[orgId]) return { parentUid, childIds }
      }

      reply.code(401).send({
        error: 'Organization access invalid',
        message: 'You are not linked to this organization',
      })
      return false
    }

    return { parentUid, childIds }
  }

  // ——— Content library routes (roadmaps + library tasks) ———

  // GET /orgs/:orgId/parent/content/roadmaps
  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/parent/content/roadmaps',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const access = await requireParentOrgAccess(request, reply, orgId)
        if (!access) return
        const db = getFirestore()
        const snap = await db
          .collection(COLLECTIONS.ORG_ROADMAPS(orgId))
          .orderBy('createdAt', 'desc')
          .get()
        return { ok: true, roadmaps: snap.docs.map((d) => transformDoc(d)), count: snap.size }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to list roadmaps' })
      }
    }
  )

  // GET /orgs/:orgId/parent/content/roadmaps/:roadmapId
  fastify.get<{ Params: { orgId: string; roadmapId: string } }>(
    '/orgs/:orgId/parent/content/roadmaps/:roadmapId',
    async (request, reply) => {
      try {
        const { orgId, roadmapId } = request.params
        const access = await requireParentOrgAccess(request, reply, orgId)
        if (!access) return
        const db = getFirestore()
        const ref = db.doc(`${COLLECTIONS.ORG_ROADMAPS(orgId)}/${roadmapId}`)
        const snap = await ref.get()
        if (!snap.exists) return reply.code(404).send({ error: 'Roadmap not found' })
        const roadmap = transformDoc(snap) as Record<string, unknown>
        const taskIds = (roadmap.taskIds as string[] | undefined) || []
        if (taskIds.length > 0) {
          const taskSnaps = await Promise.all(
            taskIds.map((id) => db.collection(COLLECTIONS.ORG_TASKS(orgId)).doc(id).get())
          )
          const tasks = taskSnaps.filter((s) => s.exists).map((s) => transformDoc(s))
          return { ok: true, roadmap: { ...roadmap, tasks } }
        }
        return { ok: true, roadmap: { ...roadmap, tasks: [] } }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to get roadmap' })
      }
    }
  )

  // GET /orgs/:orgId/parent/content/tasks — content library tasks (for browsing)
  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/parent/content/tasks',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const access = await requireParentOrgAccess(request, reply, orgId)
        if (!access) return
        const db = getFirestore()
        const tasksCollection = db.collection(COLLECTIONS.ORG_TASKS(orgId))
        const { ids } = request.query as { ids?: string }
        if (ids) {
          const taskIds = ids
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          if (taskIds.length === 0) return { ok: true, tasks: [], count: 0 }
          const taskSnaps = await Promise.all(taskIds.map((id) => tasksCollection.doc(id).get()))
          const tasks = taskSnaps.filter((s) => s.exists).map((s) => transformDoc(s))
          return { ok: true, tasks, count: tasks.length }
        }
        const snap = await tasksCollection.orderBy('createdAt', 'desc').get()
        return { ok: true, tasks: snap.docs.map((d) => transformDoc(d)), count: snap.size }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to list tasks' })
      }
    }
  )

  // GET /orgs/:orgId/parent/content/tasks/:taskId
  fastify.get<{ Params: { orgId: string; taskId: string } }>(
    '/orgs/:orgId/parent/content/tasks/:taskId',
    async (request, reply) => {
      try {
        const { orgId, taskId } = request.params
        const access = await requireParentOrgAccess(request, reply, orgId)
        if (!access) return
        const db = getFirestore()
        const snap = await db.doc(`${COLLECTIONS.ORG_TASKS(orgId)}/${taskId}`).get()
        if (!snap.exists) return reply.code(404).send({ error: 'Task not found' })
        return { ok: true, task: transformDoc(snap) }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to get task' })
      }
    }
  )

  // POST /orgs/:orgId/parent/content/tasks/:taskId/complete — mark content-library task complete
  fastify.post<{ Params: { orgId: string; taskId: string } }>(
    '/orgs/:orgId/parent/content/tasks/:taskId/complete',
    async (request, reply) => {
      try {
        const { orgId, taskId } = request.params
        const access = await requireParentOrgAccess(request, reply, orgId)
        if (!access) return
        if (!request.user) return
        const db = getFirestore()
        const body =
          (request.body as { completed?: boolean; childId?: string; roadmapId?: string }) || {}
        const completed = body.completed !== false
        const childId = body.childId || access.childIds[0] || request.user.uid
        const roadmapId = body.roadmapId
        const taskSnap = await db.doc(`${COLLECTIONS.ORG_TASKS(orgId)}/${taskId}`).get()
        if (!taskSnap.exists) return reply.code(404).send({ ok: false, error: 'Task not found' })
        const parentId = request.user.uid
        const docId = `${taskId}_${parentId}_${childId}`
        const compRef = db.collection('alphakidsTaskCompletions').doc(docId)
        const now = admin.firestore.Timestamp.fromDate(new Date())
        const update: Record<string, unknown> = {
          taskId,
          parentId,
          childId,
          orgId,
          completed,
          updatedAt: now,
          completedAt: completed ? now : null,
        }
        if (roadmapId) update.roadmapId = roadmapId
        const existing = await compRef.get()
        if (existing.exists) {
          await compRef.update(update)
        } else {
          await compRef.set({ ...update, createdAt: now })
        }
        return { ok: true, message: 'Task completion status updated' }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to update task completion' })
      }
    }
  )

  // ——— Child-assigned tasks routes (for tasks assigned via groups/specialists) ———

  // GET /orgs/:orgId/parent/tasks — all tasks assigned to parent's children in this org
  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/parent/tasks',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const access = await requireParentOrgAccess(request, reply, orgId)
        if (!access) return
        const db = getFirestore()
        const allTasks: Record<string, unknown>[] = []

        // Cache content task lookups to avoid duplicate fetches
        const contentTaskCache = new Map<string, Record<string, unknown>>()
        const getContentTask = async (ctId: string): Promise<Record<string, unknown>> => {
          if (contentTaskCache.has(ctId)) return contentTaskCache.get(ctId)!
          try {
            const snap = await db.doc(`${COLLECTIONS.ORG_TASKS(orgId)}/${ctId}`).get()
            const ct = snap.exists ? (snap.data() as Record<string, unknown>) : {}
            contentTaskCache.set(ctId, ct)
            return ct
          } catch {
            return {}
          }
        }

        for (const childId of access.childIds) {
          const tasksSnap = await db
            .collection(`children/${childId}/tasks`)
            .orderBy('createdAt', 'desc')
            .get()
          for (const doc of tasksSnap.docs) {
            const d = doc.data()

            // For old tasks that lack rich fields, fall back to the content library doc
            let ct: Record<string, unknown> = {}
            if (
              d.contentTaskId &&
              !d.category &&
              !d.videoUrl &&
              !d.imageUrl &&
              !d.difficulty &&
              !d.estimatedDuration &&
              !d.instructions
            ) {
              ct = await getContentTask(d.contentTaskId as string)
            }

            allTasks.push({
              id: doc.id,
              childId,
              title: d.title || 'Untitled',
              description: d.description ?? ct.description ?? null,
              category: d.category ?? ct.category ?? null,
              estimatedDuration: d.estimatedDuration ?? ct.estimatedDuration ?? null,
              difficulty: d.difficulty ?? ct.difficulty ?? null,
              instructions: d.instructions ?? ct.instructions ?? null,
              videoUrl: d.videoUrl ?? ct.videoUrl ?? null,
              imageUrl: d.imageUrl ?? ct.imageUrl ?? null,
              mediaType: d.mediaType ?? ct.mediaType ?? null,
              ageRange: d.ageRange ?? ct.ageRange ?? null,
              status: d.status || 'pending',
              submissionStatus: d.submissionStatus || 'pending',
              grade: d.grade ?? null,
              feedback: d.feedback ?? null,
              submissionText: d.submissionText ?? null,
              fileUrl: d.fileUrl ?? null,
              groupId: d.groupId ?? null,
              groupAssignmentId: d.groupAssignmentId ?? null,
              contentTaskId: d.contentTaskId ?? null,
              dueDate: d.dueDate?.toDate?.()?.toISOString() || null,
              createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
              updatedAt: d.updatedAt?.toDate?.()?.toISOString() || null,
              completedAt: d.completedAt?.toDate?.()?.toISOString() || null,
              submittedAt: d.submittedAt?.toDate?.()?.toISOString() || null,
            })
          }
        }

        return { ok: true, tasks: allTasks, count: allTasks.length }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to list tasks' })
      }
    }
  )

  // GET /orgs/:orgId/parent/children/:childId/tasks — tasks for a specific child
  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/parent/children/:childId/tasks',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params
        const access = await requireParentOrgAccess(request, reply, orgId)
        if (!access) return

        if (!access.childIds.includes(childId)) {
          return reply.code(403).send({ error: 'Child does not belong to you' })
        }

        const db = getFirestore()
        const tasksSnap = await db
          .collection(`children/${childId}/tasks`)
          .orderBy('createdAt', 'desc')
          .get()

        // Collect contentTaskIds that need lookup (old tasks missing rich fields)
        const ctIdsToFetch = new Set<string>()
        for (const doc of tasksSnap.docs) {
          const d = doc.data()
          if (
            d.contentTaskId &&
            !d.category &&
            !d.videoUrl &&
            !d.imageUrl &&
            !d.difficulty &&
            !d.estimatedDuration &&
            !d.instructions
          ) {
            ctIdsToFetch.add(d.contentTaskId as string)
          }
        }
        const ctMap = new Map<string, Record<string, unknown>>()
        await Promise.all(
          Array.from(ctIdsToFetch).map(async (ctId) => {
            try {
              const snap = await db.doc(`${COLLECTIONS.ORG_TASKS(orgId)}/${ctId}`).get()
              if (snap.exists) ctMap.set(ctId, snap.data() as Record<string, unknown>)
            } catch {
              /* ignore */
            }
          })
        )

        const tasks = tasksSnap.docs.map((doc) => {
          const d = doc.data()
          const ct: Record<string, unknown> =
            (d.contentTaskId && ctMap.get(d.contentTaskId as string)) || {}
          return {
            id: doc.id,
            childId,
            title: d.title || 'Untitled',
            description: d.description ?? ct.description ?? null,
            category: d.category ?? ct.category ?? null,
            estimatedDuration: d.estimatedDuration ?? ct.estimatedDuration ?? null,
            difficulty: d.difficulty ?? ct.difficulty ?? null,
            instructions: d.instructions ?? ct.instructions ?? null,
            videoUrl: d.videoUrl ?? ct.videoUrl ?? null,
            imageUrl: d.imageUrl ?? ct.imageUrl ?? null,
            mediaType: d.mediaType ?? ct.mediaType ?? null,
            ageRange: d.ageRange ?? ct.ageRange ?? null,
            status: d.status || 'pending',
            submissionStatus: d.submissionStatus || 'pending',
            grade: d.grade ?? null,
            feedback: d.feedback ?? null,
            submissionText: d.submissionText ?? null,
            fileUrl: d.fileUrl ?? null,
            groupId: d.groupId ?? null,
            groupAssignmentId: d.groupAssignmentId ?? null,
            contentTaskId: d.contentTaskId ?? null,
            dueDate: d.dueDate?.toDate?.()?.toISOString() || null,
            createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
            updatedAt: d.updatedAt?.toDate?.()?.toISOString() || null,
            completedAt: d.completedAt?.toDate?.()?.toISOString() || null,
            submittedAt: d.submittedAt?.toDate?.()?.toISOString() || null,
          }
        })

        return { ok: true, tasks, count: tasks.length }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to list child tasks' })
      }
    }
  )

  // PATCH /orgs/:orgId/parent/children/:childId/tasks/:taskId — mark assigned task complete/incomplete
  fastify.patch<{ Params: { orgId: string; childId: string; taskId: string } }>(
    '/orgs/:orgId/parent/children/:childId/tasks/:taskId',
    async (request, reply) => {
      try {
        const { orgId, childId, taskId } = request.params
        const access = await requireParentOrgAccess(request, reply, orgId)
        if (!access) return

        if (!access.childIds.includes(childId)) {
          return reply.code(403).send({ error: 'Child does not belong to you' })
        }

        const db = getFirestore()
        const body = (request.body as { completed?: boolean }) || {}
        const completed = body.completed !== false

        const taskRef = db.doc(`children/${childId}/tasks/${taskId}`)
        const taskSnap = await taskRef.get()
        if (!taskSnap.exists) return reply.code(404).send({ error: 'Task not found' })

        const now = admin.firestore.Timestamp.fromDate(new Date())
        await taskRef.update({
          status: completed ? 'completed' : 'pending',
          completedAt: completed ? now : null,
          updatedAt: now,
        })

        return { ok: true, status: completed ? 'completed' : 'pending' }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to update task' })
      }
    }
  )

  // PATCH /orgs/:orgId/parent/children/:childId/tasks/:taskId/submit — submit homework evidence
  fastify.patch<{ Params: { orgId: string; childId: string; taskId: string } }>(
    '/orgs/:orgId/parent/children/:childId/tasks/:taskId/submit',
    async (request, reply) => {
      try {
        const { orgId, childId, taskId } = request.params
        const access = await requireParentOrgAccess(request, reply, orgId)
        if (!access) return

        if (!access.childIds.includes(childId)) {
          return reply.code(403).send({ error: 'Child does not belong to you' })
        }

        const db = getFirestore()
        const taskRef = db.doc(`children/${childId}/tasks/${taskId}`)
        const taskSnap = await taskRef.get()
        if (!taskSnap.exists) return reply.code(404).send({ error: 'Task not found' })

        const body = (request.body as { submissionText?: string; fileUrl?: string }) || {}
        const now = admin.firestore.Timestamp.fromDate(new Date())

        await taskRef.update({
          submissionText: body.submissionText ?? null,
          fileUrl: body.fileUrl ?? null,
          submissionStatus: 'submitted',
          submittedAt: now,
          updatedAt: now,
        })

        return { ok: true, taskId, submittedAt: now.toDate().toISOString() }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to submit homework' })
      }
    }
  )
}
