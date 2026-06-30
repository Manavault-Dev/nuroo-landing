import admin from 'firebase-admin'

export const COLLECTIONS = {
  ORG_TASKS: (orgId: string) => `organizations/${orgId}/contentTasks`,
  ORG_ROADMAPS: (orgId: string) => `organizations/${orgId}/contentRoadmaps`,
} as const

export function toTimestamp(date = new Date()) {
  return admin.firestore.Timestamp.fromDate(date)
}

export function transformDoc(doc: admin.firestore.DocumentSnapshot) {
  const data = doc.data()
  if (!data) return { id: doc.id }
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
  }
}

export function buildUpdateData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = { updatedAt: toTimestamp() }
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) data[key] = value
  }
  return data
}

export function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

export async function listContentTasks(db: admin.firestore.Firestore, orgId: string) {
  const snap = await db.collection(COLLECTIONS.ORG_TASKS(orgId)).orderBy('createdAt', 'desc').get()
  return { tasks: snap.docs.map((d) => transformDoc(d)), count: snap.size }
}

export async function createContentTask(
  db: admin.firestore.Firestore,
  orgId: string,
  createdByUid: string,
  body: Record<string, unknown>
) {
  const ref = db.collection(COLLECTIONS.ORG_TASKS(orgId)).doc()
  const data = stripUndefined({
    ...body,
    createdBy: createdByUid,
    createdAt: toTimestamp(),
    updatedAt: toTimestamp(),
  })
  await ref.set(data)
  return { id: ref.id, doc: await ref.get() }
}

export async function uploadContentTask(
  db: admin.firestore.Firestore,
  orgId: string,
  createdByUid: string,
  storageBucket: any,
  mediaBuffer: Buffer,
  mediaMimetype: string,
  mediaFilename: string,
  fields: Record<string, string>
) {
  const safeName = mediaFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `orgs/${orgId}/content/${Date.now()}-${safeName}`
  const file = storageBucket.file(storagePath)
  await file.save(mediaBuffer, {
    contentType: mediaMimetype || undefined,
    metadata: { cacheControl: 'public, max-age=31536000' },
  })
  await file.makePublic()
  const publicUrl = `https://storage.googleapis.com/${storageBucket.name}/${storagePath}`
  const isVideo = mediaMimetype.startsWith('video/')
  const title = (fields.title || '').trim() || mediaFilename.replace(/\.[^/.]+$/, '')

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
    mediaType: isVideo ? 'video' : 'image',
    createdBy: createdByUid,
    createdAt: toTimestamp(),
    updatedAt: toTimestamp(),
  }

  const ref = db.collection(COLLECTIONS.ORG_TASKS(orgId)).doc()
  await ref.set(stripUndefined(taskData))
  return { id: ref.id, doc: await ref.get() }
}

export async function getContentTask(db: admin.firestore.Firestore, orgId: string, taskId: string) {
  const ref = db.doc(`${COLLECTIONS.ORG_TASKS(orgId)}/${taskId}`)
  const snap = await ref.get()
  if (!snap.exists) {
    throw Object.assign(new Error('Task not found'), { statusCode: 404 })
  }
  return transformDoc(snap)
}

export async function updateContentTask(
  db: admin.firestore.Firestore,
  orgId: string,
  taskId: string,
  body: Record<string, unknown>
) {
  const ref = db.doc(`${COLLECTIONS.ORG_TASKS(orgId)}/${taskId}`)
  const snap = await ref.get()
  if (!snap.exists) {
    throw Object.assign(new Error('Task not found'), { statusCode: 404 })
  }
  await ref.update(buildUpdateData(body))
  return transformDoc(await ref.get())
}

export async function deleteContentTask(
  db: admin.firestore.Firestore,
  orgId: string,
  taskId: string
) {
  const ref = db.doc(`${COLLECTIONS.ORG_TASKS(orgId)}/${taskId}`)
  if (!(await ref.get()).exists) {
    throw Object.assign(new Error('Task not found'), { statusCode: 404 })
  }
  await ref.delete()
}

export async function listContentRoadmaps(db: admin.firestore.Firestore, orgId: string) {
  const snap = await db
    .collection(COLLECTIONS.ORG_ROADMAPS(orgId))
    .orderBy('createdAt', 'desc')
    .get()
  return { roadmaps: snap.docs.map((d) => transformDoc(d)), count: snap.size }
}

export async function createContentRoadmap(
  db: admin.firestore.Firestore,
  orgId: string,
  createdByUid: string,
  body: Record<string, unknown>
) {
  const ref = db.collection(COLLECTIONS.ORG_ROADMAPS(orgId)).doc()
  const data = stripUndefined({
    ...body,
    createdBy: createdByUid,
    createdAt: toTimestamp(),
    updatedAt: toTimestamp(),
  })
  await ref.set(data)
  return { id: ref.id, doc: await ref.get() }
}

export async function updateContentRoadmap(
  db: admin.firestore.Firestore,
  orgId: string,
  roadmapId: string,
  body: Record<string, unknown>,
  requestUserUid: string
) {
  const ref = db.doc(`${COLLECTIONS.ORG_ROADMAPS(orgId)}/${roadmapId}`)
  const snap = await ref.get()
  if (!snap.exists) {
    throw Object.assign(new Error('Roadmap not found'), { statusCode: 404 })
  }

  const oldTaskIds: string[] = snap.data()?.taskIds || []
  await ref.update(buildUpdateData(body))

  const taskIds = body.taskIds as string[] | undefined
  if (taskIds && taskIds.length > 0) {
    const addedTaskIds = taskIds.filter((id) => !oldTaskIds.includes(id))
    if (addedTaskIds.length > 0) {
      try {
        const assignmentsSnap = await db
          .collection(`organizations/${orgId}/groupAssignments`)
          .where('contentRoadmapIds', 'array-contains', roadmapId)
          .where('status', '==', 'active')
          .get()

        if (!assignmentsSnap.empty) {
          const contentTaskDocs = await Promise.all(
            addedTaskIds.map((id) => db.doc(`${COLLECTIONS.ORG_TASKS(orgId)}/${id}`).get())
          )
          const contentTasks = contentTaskDocs
            .filter((s) => s.exists)
            .map((s) => ({ id: s.id, ...s.data()! }))

          if (contentTasks.length > 0) {
            const now = admin.firestore.Timestamp.fromDate(new Date())
            const BATCH_SIZE = 400

            for (const assignmentDoc of assignmentsSnap.docs) {
              const aData = assignmentDoc.data()
              const childIds: string[] = aData.childIds || []
              const assignmentId = assignmentDoc.id
              const assignedBy = aData.ownerId || requestUserUid
              const dueDateRaw = aData.dueDate?.toDate?.() || null

              for (let i = 0; i < childIds.length; i += BATCH_SIZE) {
                const batch = db.batch()
                const chunk = childIds.slice(i, i + BATCH_SIZE)
                for (const childId of chunk) {
                  for (const ct of contentTasks) {
                    const taskRef = db.collection(`children/${childId}/tasks`).doc()
                    batch.set(taskRef, {
                      title: (ct as any).title,
                      description: (ct as any).description ?? null,
                      category: (ct as any).category ?? null,
                      estimatedDuration: (ct as any).estimatedDuration ?? null,
                      difficulty: (ct as any).difficulty ?? null,
                      instructions: (ct as any).instructions ?? null,
                      videoUrl: (ct as any).videoUrl ?? null,
                      imageUrl: (ct as any).imageUrl ?? null,
                      mediaType: (ct as any).mediaType ?? null,
                      ageRange: (ct as any).ageRange ?? null,
                      status: 'pending',
                      submissionStatus: 'pending',
                      grade: null,
                      feedback: null,
                      createdBy: assignedBy,
                      groupId: aData.groupId,
                      contentTaskId: ct.id,
                      contentRoadmapId: roadmapId,
                      groupAssignmentId: assignmentId,
                      dueDate: dueDateRaw ? admin.firestore.Timestamp.fromDate(dueDateRaw) : null,
                      createdAt: now,
                      updatedAt: now,
                      completedAt: null,
                      submittedAt: null,
                    })
                  }
                }
                await batch.commit()
              }
            }
          }
        }
      } catch {}
    }
  }

  return transformDoc(await ref.get())
}

export async function deleteContentRoadmap(
  db: admin.firestore.Firestore,
  orgId: string,
  roadmapId: string
) {
  const ref = db.doc(`${COLLECTIONS.ORG_ROADMAPS(orgId)}/${roadmapId}`)
  if (!(await ref.get()).exists) {
    throw Object.assign(new Error('Roadmap not found'), { statusCode: 404 })
  }
  await ref.delete()
}
