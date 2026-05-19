import admin from 'firebase-admin'

import { COLLECTIONS, transformDoc } from './orgContent.service.js'

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

export async function listParentTasks(db: admin.firestore.Firestore, orgId: string, ids?: string) {
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

export async function getParentTask(db: admin.firestore.Firestore, orgId: string, taskId: string) {
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

  const relevantAssignments = assignmentsSnap.docs.filter((doc) => {
    const d = doc.data()
    const roadmapIds: string[] = d.contentRoadmapIds || []
    if (roadmapIds.length === 0) return false
    if (childIds.length === 0) return true
    const assignedChildren: string[] = d.childIds || []
    return assignedChildren.some((id) => childIdSet.has(id))
  })

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
