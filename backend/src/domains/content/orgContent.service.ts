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
      } catch (pushErr: any) {
        console.error('[ROADMAP] Auto-push new tasks failed:', pushErr.message)
      }
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

export async function requireParentOrgAccess(
  db: admin.firestore.Firestore,
  parentUid: string,
  orgId: string
): Promise<{ parentUid: string; childIds: string[] } | null> {
  const orgParentRef = db.doc(`orgParents/${orgId}/parents/${parentUid}`)
  const orgParentSnap = await orgParentRef.get()

  const childQuery = await db
    .collection(`organizations/${orgId}/children`)
    .where('parentUserId', '==', parentUid)
    .get()

  let childIds = childQuery.docs.filter((d) => d.data().assigned !== false).map((d) => d.id)

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
      } catch {}
    }
  }

  if (!orgParentSnap.exists && childIds.length === 0) {
    const userSnap = await db.doc(`users/${parentUid}`).get()
    if (userSnap.exists) {
      const linkedOrgs = userSnap.data()?.linkedOrganizationsById || {}
      if (linkedOrgs[orgId]) return { parentUid, childIds }
    }
    return null
  }

  return { parentUid, childIds }
}

export async function listParentRoadmaps(db: admin.firestore.Firestore, orgId: string) {
  const snap = await db
    .collection(COLLECTIONS.ORG_ROADMAPS(orgId))
    .orderBy('createdAt', 'desc')
    .get()
  return { roadmaps: snap.docs.map((d) => transformDoc(d)), count: snap.size }
}

export async function getParentRoadmap(
  db: admin.firestore.Firestore,
  orgId: string,
  roadmapId: string
) {
  const ref = db.doc(`${COLLECTIONS.ORG_ROADMAPS(orgId)}/${roadmapId}`)
  const snap = await ref.get()
  if (!snap.exists) {
    throw Object.assign(new Error('Roadmap not found'), { statusCode: 404 })
  }
  const roadmap = transformDoc(snap) as Record<string, unknown>
  const taskIds = (roadmap.taskIds as string[] | undefined) || []
  if (taskIds.length > 0) {
    const taskSnaps = await Promise.all(
      taskIds.map((id) => db.collection(COLLECTIONS.ORG_TASKS(orgId)).doc(id).get())
    )
    const tasks = taskSnaps.filter((s) => s.exists).map((s) => transformDoc(s))
    return { ...roadmap, tasks }
  }
  return { ...roadmap, tasks: [] }
}

export async function listParentTasks(
  db: admin.firestore.Firestore,
  orgId: string,
  ids?: string
) {
  const tasksCollection = db.collection(COLLECTIONS.ORG_TASKS(orgId))
  if (ids) {
    const taskIds = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (taskIds.length === 0) return { tasks: [], count: 0 }
    const taskSnaps = await Promise.all(taskIds.map((id) => tasksCollection.doc(id).get()))
    const tasks = taskSnaps.filter((s) => s.exists).map((s) => transformDoc(s))
    return { tasks, count: tasks.length }
  }
  const snap = await tasksCollection.orderBy('createdAt', 'desc').get()
  return { tasks: snap.docs.map((d) => transformDoc(d)), count: snap.size }
}

export async function getParentTask(
  db: admin.firestore.Firestore,
  orgId: string,
  taskId: string
) {
  const snap = await db.doc(`${COLLECTIONS.ORG_TASKS(orgId)}/${taskId}`).get()
  if (!snap.exists) {
    throw Object.assign(new Error('Task not found'), { statusCode: 404 })
  }
  return transformDoc(snap)
}

export async function completeParentTask(
  db: admin.firestore.Firestore,
  orgId: string,
  taskId: string,
  parentUid: string,
  childId: string,
  completed: boolean,
  roadmapId?: string
) {
  const taskSnap = await db.doc(`${COLLECTIONS.ORG_TASKS(orgId)}/${taskId}`).get()
  if (!taskSnap.exists) {
    throw Object.assign(new Error('Task not found'), { statusCode: 404 })
  }
  const docId = `${taskId}_${parentUid}_${childId}`
  const compRef = db.collection('alphakidsTaskCompletions').doc(docId)
  const now = admin.firestore.Timestamp.fromDate(new Date())
  const update: Record<string, unknown> = {
    taskId,
    parentId: parentUid,
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
}

export async function getRoadmapAssignmentsForParent(
  db: admin.firestore.Firestore,
  orgId: string,
  childIds: string[],
  parentUid: string,
  filterRoadmapId?: string
) {
  const childIdSet = new Set(childIds)

  let assignmentsSnap: FirebaseFirestore.QuerySnapshot
  try {
    assignmentsSnap = await db
      .collection(`organizations/${orgId}/groupAssignments`)
      .orderBy('assignedAt', 'desc')
      .get()
  } catch {
    assignmentsSnap = await db.collection(`organizations/${orgId}/groupAssignments`).get()
  }

  console.log(`[roadmap-assignments] total groupAssignments=${assignmentsSnap.size}`)

  const relevantAssignments = assignmentsSnap.docs.filter((doc) => {
    const d = doc.data()
    const roadmapIds: string[] = d.contentRoadmapIds || []
    if (roadmapIds.length === 0) return false
    if (childIds.length === 0) return true
    const assignedChildren: string[] = d.childIds || []
    const matches = assignedChildren.some((id) => childIdSet.has(id))
    console.log(
      `[roadmap-assignments] assignment=${doc.id} roadmaps=${JSON.stringify(roadmapIds)} assignedChildren=${JSON.stringify(assignedChildren)} matches=${matches}`
    )
    return matches
  })

  console.log(`[roadmap-assignments] relevantAssignments=${relevantAssignments.length}`)

  if (relevantAssignments.length === 0) {
    return {
      roadmapAssignments: [],
      _debug: { childIds, totalAssignments: assignmentsSnap.size },
    }
  }

  const roadmapMap = new Map<
    string,
    { assignmentId: string; dueDate: string | null; matchedChildIds: string[] }
  >()
  for (const assignmentDoc of relevantAssignments) {
    const d = assignmentDoc.data()
    const roadmapIds: string[] = d.contentRoadmapIds || []
    const assignedChildren: string[] = d.childIds || []
    const matched = assignedChildren.filter((id) => childIdSet.has(id))
    for (const roadmapId of roadmapIds) {
      if (filterRoadmapId && roadmapId !== filterRoadmapId) continue
      if (!roadmapMap.has(roadmapId)) {
        roadmapMap.set(roadmapId, {
          assignmentId: assignmentDoc.id,
          dueDate: d.dueDate?.toDate?.()?.toISOString() ?? null,
          matchedChildIds: matched,
        })
      }
    }
  }

  if (roadmapMap.size === 0) return { roadmapAssignments: [] }

  const roadmapAssignments = await Promise.all(
    Array.from(roadmapMap.entries()).map(async ([roadmapId, meta]) => {
      let roadmapName = roadmapId
      let roadmapDescription: string | null = null
      try {
        const rSnap = await db.doc(`organizations/${orgId}/contentRoadmaps/${roadmapId}`).get()
        if (rSnap.exists) {
          const rData = rSnap.data()!
          roadmapName = (rData.name as string) || roadmapId
          roadmapDescription = (rData.description as string) ?? null
        }
      } catch {}

      const allChildTasks: any[] = []
      await Promise.all(
        meta.matchedChildIds.map(async (childId) => {
          try {
            const tasksSnap = await db
              .collection(`children/${childId}/tasks`)
              .where('groupAssignmentId', '==', meta.assignmentId)
              .orderBy('createdAt', 'asc')
              .get()
            for (const taskDoc of tasksSnap.docs) {
              const td = taskDoc.data()
              if (td.contentRoadmapId && td.contentRoadmapId !== roadmapId) continue
              allChildTasks.push({
                id: taskDoc.id,
                childId,
                title: td.title || 'Untitled',
                description: td.description ?? null,
                status: td.status || 'pending',
                submissionStatus: td.submissionStatus || 'pending',
                grade: td.grade ?? null,
                feedback: td.feedback ?? null,
                submittedAt: td.submittedAt?.toDate?.()?.toISOString() ?? null,
                dueDate: td.dueDate?.toDate?.()?.toISOString() ?? null,
                videoUrl: td.videoUrl ?? null,
                imageUrl: td.imageUrl ?? null,
                instructions: td.instructions ?? null,
                createdAt: td.createdAt?.toDate?.()?.toISOString() ?? null,
              })
            }
          } catch {
            try {
              const tasksSnap = await db
                .collection(`children/${childId}/tasks`)
                .orderBy('createdAt', 'asc')
                .get()
              for (const taskDoc of tasksSnap.docs) {
                const td = taskDoc.data()
                if (td.groupAssignmentId !== meta.assignmentId) continue
                if (td.contentRoadmapId && td.contentRoadmapId !== roadmapId) continue
                allChildTasks.push({
                  id: taskDoc.id,
                  childId,
                  title: td.title || 'Untitled',
                  description: td.description ?? null,
                  status: td.status || 'pending',
                  submissionStatus: td.submissionStatus || 'pending',
                  grade: td.grade ?? null,
                  feedback: td.feedback ?? null,
                  submittedAt: td.submittedAt?.toDate?.()?.toISOString() ?? null,
                  dueDate: td.dueDate?.toDate?.()?.toISOString() ?? null,
                  videoUrl: td.videoUrl ?? null,
                  imageUrl: td.imageUrl ?? null,
                  instructions: td.instructions ?? null,
                  createdAt: td.createdAt?.toDate?.()?.toISOString() ?? null,
                })
              }
            } catch {}
          }
        })
      )

      const completedCount = allChildTasks.filter(
        (t) => t.submissionStatus === 'submitted' || t.grade === 'approved' || t.submittedAt
      ).length

      return {
        roadmapId,
        roadmapName,
        roadmapDescription,
        assignmentId: meta.assignmentId,
        dueDate: meta.dueDate,
        totalTasks: allChildTasks.length,
        completedTasks: completedCount,
        tasks: allChildTasks,
      }
    })
  )

  return { roadmapAssignments }
}

export async function listParentChildTasks(
  db: admin.firestore.Firestore,
  orgId: string,
  childId: string
) {
  const tasksSnap = await db
    .collection(`children/${childId}/tasks`)
    .orderBy('createdAt', 'desc')
    .get()

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
      } catch {}
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
      contentRoadmapId: d.contentRoadmapId ?? null,
      dueDate: d.dueDate?.toDate?.()?.toISOString() || null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: d.updatedAt?.toDate?.()?.toISOString() || null,
      completedAt: d.completedAt?.toDate?.()?.toISOString() || null,
      submittedAt: d.submittedAt?.toDate?.()?.toISOString() || null,
    }
  })

  return { tasks, count: tasks.length }
}

export async function updateParentChildTask(
  db: admin.firestore.Firestore,
  childId: string,
  taskId: string,
  completed: boolean
) {
  const taskRef = db.doc(`children/${childId}/tasks/${taskId}`)
  const taskSnap = await taskRef.get()
  if (!taskSnap.exists) {
    throw Object.assign(new Error('Task not found'), { statusCode: 404 })
  }
  const now = admin.firestore.Timestamp.fromDate(new Date())
  await taskRef.update({
    status: completed ? 'completed' : 'pending',
    completedAt: completed ? now : null,
    updatedAt: now,
  })
  return completed ? 'completed' : 'pending'
}

export async function getChildRoadmapAssignments(
  db: admin.firestore.Firestore,
  orgId: string,
  childId: string
) {
  const tasksSnap = await db
    .collection(`children/${childId}/tasks`)
    .orderBy('createdAt', 'asc')
    .get()

  const roadmapTasks = tasksSnap.docs.filter((d) => !!d.data().contentRoadmapId)

  if (roadmapTasks.length === 0) {
    return []
  }

  const byRoadmap = new Map<
    string,
    { assignmentId: string | null; dueDate: string | null; tasks: any[] }
  >()
  for (const doc of roadmapTasks) {
    const d = doc.data()
    const roadmapId = d.contentRoadmapId as string
    if (!roadmapId) continue
    if (!byRoadmap.has(roadmapId)) {
      byRoadmap.set(roadmapId, {
        assignmentId: d.groupAssignmentId ?? null,
        dueDate: d.dueDate?.toDate?.()?.toISOString() ?? null,
        tasks: [],
      })
    }
    byRoadmap.get(roadmapId)!.tasks.push({
      id: doc.id,
      title: d.title || 'Untitled',
      description: d.description ?? null,
      status: d.status || 'pending',
      submissionStatus: d.submissionStatus || 'pending',
      grade: d.grade ?? null,
      feedback: d.feedback ?? null,
      submissionText: d.submissionText ?? null,
      fileUrl: d.fileUrl ?? null,
      submittedAt: d.submittedAt?.toDate?.()?.toISOString() ?? null,
      dueDate: d.dueDate?.toDate?.()?.toISOString() ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
    })
  }

  return Promise.all(
    Array.from(byRoadmap.entries()).map(async ([roadmapId, data]) => {
      let roadmapName = roadmapId
      try {
        const roadmapSnap = await db
          .doc(`organizations/${orgId}/contentRoadmaps/${roadmapId}`)
          .get()
        if (roadmapSnap.exists) {
          roadmapName = (roadmapSnap.data()!.name as string) || roadmapId
        }
      } catch {}
      return {
        roadmapId,
        roadmapName,
        assignmentId: data.assignmentId,
        dueDate: data.dueDate,
        tasks: data.tasks,
      }
    })
  )
}

export async function submitParentChildTask(
  db: admin.firestore.Firestore,
  childId: string,
  taskId: string,
  submissionText?: string,
  fileUrl?: string
) {
  const taskRef = db.doc(`children/${childId}/tasks/${taskId}`)
  const taskSnap = await taskRef.get()
  if (!taskSnap.exists) {
    throw Object.assign(new Error('Task not found'), { statusCode: 404 })
  }
  const now = admin.firestore.Timestamp.fromDate(new Date())
  await taskRef.update({
    submissionText: submissionText ?? null,
    fileUrl: fileUrl ?? null,
    submissionStatus: 'submitted',
    submittedAt: now,
    updatedAt: now,
  })
  return now
}

export async function listAllParentTasks(
  db: admin.firestore.Firestore,
  orgId: string,
  childIds: string[]
) {
  const allTasks: Record<string, unknown>[] = []

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

  for (const childId of childIds) {
    const tasksSnap = await db
      .collection(`children/${childId}/tasks`)
      .orderBy('createdAt', 'desc')
      .get()
    for (const doc of tasksSnap.docs) {
      const d = doc.data()

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
        contentRoadmapId: d.contentRoadmapId ?? null,
        dueDate: d.dueDate?.toDate?.()?.toISOString() || null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() || null,
        completedAt: d.completedAt?.toDate?.()?.toISOString() || null,
        submittedAt: d.submittedAt?.toDate?.()?.toISOString() || null,
      })
    }
  }

  return { tasks: allTasks, count: allTasks.length }
}
