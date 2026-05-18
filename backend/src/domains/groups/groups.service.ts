import admin from 'firebase-admin'

export const DEFAULT_GROUP_COLOR = '#6366f1'

export const COLLECTIONS = {
  SPECIALIST_GROUPS: (uid: string) => `specialists/${uid}/groups`,
  GROUP_PARENTS: (uid: string, groupId: string) => `specialists/${uid}/groups/${groupId}/parents`,
  ORG_CHILDREN: (orgId: string) => `organizations/${orgId}/children`,
  ORG_MEMBERS: (orgId: string) => `organizations/${orgId}/members`,
  SPECIALISTS: 'specialists',
  CHILDREN: 'children',
} as const

export function isIndexError(error: any): boolean {
  return error.code === 9 || error.message?.includes('index')
}

export function sortByCreatedAt(
  docs: admin.firestore.QueryDocumentSnapshot[]
): admin.firestore.QueryDocumentSnapshot[] {
  return docs.sort((a, b) => {
    const aTime = a.data().createdAt?.toDate?.()?.getTime() || 0
    const bTime = b.data().createdAt?.toDate?.()?.getTime() || 0
    return bTime - aTime
  })
}

export async function fetchGroupsWithFallback(
  db: admin.firestore.Firestore,
  uid: string,
  orgId: string
) {
  const groupsRef = db.collection(COLLECTIONS.SPECIALIST_GROUPS(uid)).where('orgId', '==', orgId)

  try {
    return await groupsRef.orderBy('createdAt', 'desc').get()
  } catch (error: any) {
    if (isIndexError(error)) {
      const snapshot = await groupsRef.get()
      return { docs: sortByCreatedAt(snapshot.docs) } as any
    }
    throw error
  }
}

export async function getSpecialistDisplayName(
  db: admin.firestore.Firestore,
  specialistUid: string
): Promise<string> {
  const ref = db.doc(`${COLLECTIONS.SPECIALISTS}/${specialistUid}`)
  const snap = await ref.get()
  if (!snap.exists) return specialistUid.slice(0, 8)
  const d = snap.data()
  return (d?.fullName || d?.name || specialistUid.slice(0, 8)) as string
}

export async function fetchAllOrgGroups(
  db: admin.firestore.Firestore,
  orgId: string
): Promise<Array<{ doc: admin.firestore.QueryDocumentSnapshot; ownerId: string }>> {
  const membersSnap = await db.collection(COLLECTIONS.ORG_MEMBERS(orgId)).get()
  const result: Array<{ doc: admin.firestore.QueryDocumentSnapshot; ownerId: string }> = []

  for (const memberDoc of membersSnap.docs) {
    const ownerId = memberDoc.id
    let snap: admin.firestore.QuerySnapshot
    try {
      snap = await db
        .collection(COLLECTIONS.SPECIALIST_GROUPS(ownerId))
        .where('orgId', '==', orgId)
        .orderBy('createdAt', 'desc')
        .get()
    } catch (error: any) {
      if (isIndexError(error)) {
        const plain = await db
          .collection(COLLECTIONS.SPECIALIST_GROUPS(ownerId))
          .where('orgId', '==', orgId)
          .get()
        snap = { docs: sortByCreatedAt(plain.docs) } as any
      } else throw error
    }
    for (const doc of snap.docs) {
      result.push({ doc, ownerId })
    }
  }
  result.sort((a, b) => {
    const aTime = a.doc.data().createdAt?.toDate?.()?.getTime() ?? 0
    const bTime = b.doc.data().createdAt?.toDate?.()?.getTime() ?? 0
    return bTime - aTime
  })
  return result
}

export async function countGroupParents(
  db: admin.firestore.Firestore,
  uid: string,
  groupId: string
) {
  const parentsSnapshot = await db.collection(COLLECTIONS.GROUP_PARENTS(uid, groupId)).get()
  return parentsSnapshot.docs.length
}

export function transformGroup(
  doc: admin.firestore.QueryDocumentSnapshot,
  parentCount: number,
  owner?: { ownerId: string; ownerName: string }
) {
  const data = doc.data()
  const base = {
    id: doc.id,
    name: data.name,
    description: data.description || null,
    color: data.color || DEFAULT_GROUP_COLOR,
    orgId: data.orgId,
    parentCount,
    lastAssignedAt: data.lastAssignedAt?.toDate?.()?.toISOString() || null,
    lastAssignedTaskTitles: (data.lastAssignedTaskTitles as string[] | undefined) || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
  }
  if (owner) {
    return { ...base, ownerId: owner.ownerId, ownerName: owner.ownerName }
  }
  return base
}

export async function resolveUserName(
  db: admin.firestore.Firestore,
  uid: string
): Promise<{ name: string; email: string | null }> {
  const userSnap = await db.doc(`users/${uid}`).get()
  if (userSnap.exists) {
    const d = userSnap.data()!
    const name = d.name || d.childName || d.fullName || d.displayName
    if (name) return { name: name as string, email: d.email || null }
  }

  try {
    const user = await admin.auth().getUser(uid)
    const name = user.displayName || user.email?.split('@')[0] || uid.slice(0, 8)
    return { name, email: user.email || null }
  } catch {
    return { name: uid.slice(0, 8), email: null }
  }
}

export async function fetchChildData(
  db: admin.firestore.Firestore,
  childId: string,
  parentUserId?: string
) {
  const childRef = db.doc(`${COLLECTIONS.CHILDREN}/${childId}`)
  const childSnap = await childRef.get()
  const childData = childSnap.exists ? childSnap.data() : null

  let name = childData?.name || childData?.childName || ''
  let age = childData?.age || childData?.childAge

  if (!name) {
    const userSnap = await db.doc(`users/${childId}`).get()
    if (userSnap.exists) {
      const userData = userSnap.data()!
      name = userData.name || userData.childName || ''
      age = age || userData.age || userData.childAge
    }
  }

  if (!name) {
    const uidToLookup = parentUserId || childId
    try {
      const user = await admin.auth().getUser(uidToLookup)
      if (user.displayName) name = user.displayName
      else if (user.email) name = user.email.split('@')[0]
    } catch {}
  }

  return {
    id: childId,
    name: name || 'Unknown',
    age,
  }
}

export async function getChildIdsForParent(
  db: admin.firestore.Firestore,
  orgId: string,
  parentUserId: string
): Promise<string[]> {
  const childrenDocs = await db
    .collection(COLLECTIONS.ORG_CHILDREN(orgId))
    .where('parentUserId', '==', parentUserId)
    .get()

  return childrenDocs.docs.map((doc) => doc.id)
}

export function verifyGroupOwnership(
  groupData: admin.firestore.DocumentData,
  orgId: string
): boolean {
  return groupData.orgId === orgId
}

export function buildGroupData(
  body: { name: string; description?: string; color?: string },
  orgId: string,
  now: Date
) {
  return {
    name: body.name,
    description: body.description || null,
    color: body.color || DEFAULT_GROUP_COLOR,
    orgId,
    createdAt: admin.firestore.Timestamp.fromDate(now),
    updatedAt: admin.firestore.Timestamp.fromDate(now),
  }
}

export async function fetchAssignmentHistory(
  db: admin.firestore.Firestore,
  orgId: string,
  groupId: string,
  ownerId: string
) {
  let snap: admin.firestore.QuerySnapshot
  try {
    snap = await db
      .collection(`organizations/${orgId}/groupAssignments`)
      .where('groupId', '==', groupId)
      .where('ownerId', '==', ownerId)
      .orderBy('assignedAt', 'desc')
      .limit(20)
      .get()
  } catch (err: any) {
    if (err.code === 9 || err.message?.includes('index')) {
      const plain = await db
        .collection(`organizations/${orgId}/groupAssignments`)
        .where('groupId', '==', groupId)
        .where('ownerId', '==', ownerId)
        .get()
      snap = {
        docs: plain.docs.sort((a, b) => {
          const aT = a.data().assignedAt?.toDate?.()?.getTime() ?? 0
          const bT = b.data().assignedAt?.toDate?.()?.getTime() ?? 0
          return bT - aT
        }),
      } as any
    } else throw err
  }

  return snap.docs.map((doc) => {
    const d = doc.data()
    return {
      id: doc.id,
      groupId: d.groupId,
      groupName: d.groupName,
      title: d.title || d.taskTitles?.[0] || 'Задание',
      taskTitles: d.taskTitles || [],
      contentTaskIds: d.contentTaskIds || [],
      contentRoadmapIds: d.contentRoadmapIds || [],
      roadmapNames: d.roadmapNames || [],
      childCount: d.childCount || 0,
      tasksCreated: d.tasksCreated || 0,
      assignedBy: d.assignedBy,
      assignedAt: d.assignedAt?.toDate?.()?.toISOString() || null,
    }
  })
}

export async function assignTasksToGroup(
  db: admin.firestore.Firestore,
  orgId: string,
  groupId: string,
  ownerId: string,
  assignedByUid: string,
  body: {
    contentTaskIds: string[]
    contentRoadmapIds: string[]
    dueDate?: string | null
  }
) {
  const allTaskIdSet = new Set(body.contentTaskIds)
  const taskIdToRoadmapId = new Map<string, string>()
  const roadmapNames: string[] = []

  for (const roadmapId of body.contentRoadmapIds) {
    const roadmapSnap = await db.doc(`organizations/${orgId}/contentRoadmaps/${roadmapId}`).get()
    if (roadmapSnap.exists) {
      const rData = roadmapSnap.data()!
      roadmapNames.push(rData.name || 'Program')
      const taskIds: string[] = rData.taskIds || []
      taskIds.forEach((id) => {
        allTaskIdSet.add(id)
        taskIdToRoadmapId.set(id, roadmapId)
      })
    }
  }

  const contentTaskDocs = await Promise.all(
    Array.from(allTaskIdSet).map((id) => db.doc(`organizations/${orgId}/contentTasks/${id}`).get())
  )
  const contentTasks = contentTaskDocs
    .filter((snap) => snap.exists)
    .map((snap) => ({ id: snap.id, ...snap.data()! }))

  if (contentTasks.length === 0) {
    throw Object.assign(new Error('No valid content tasks found'), { statusCode: 400 })
  }

  const parentsSnap = await db.collection(COLLECTIONS.GROUP_PARENTS(ownerId, groupId)).get()
  const childIdSet = new Set<string>()
  for (const parentDoc of parentsSnap.docs) {
    const childIds = (parentDoc.data().childIds as string[]) || []
    childIds.forEach((id) => childIdSet.add(id))
  }

  if (childIdSet.size === 0) {
    throw Object.assign(new Error('No children in this group'), { statusCode: 400 })
  }

  const childIds = Array.from(childIdSet)
  const now = admin.firestore.Timestamp.fromDate(new Date())
  const BATCH_SIZE = 400
  let tasksCreated = 0

  const groupSnap = await db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(ownerId)}/${groupId}`).get()
  const taskTitles = contentTasks.map((ct: any) => (ct as any).title || 'Untitled')
  const dueDateValue = body.dueDate ? new Date(body.dueDate) : null

  const assignmentRef = db.collection(`organizations/${orgId}/groupAssignments`).doc()
  const assignmentId = assignmentRef.id

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
          createdBy: assignedByUid,
          groupId,
          contentTaskId: ct.id,
          contentRoadmapId: taskIdToRoadmapId.get(ct.id) ?? null,
          groupAssignmentId: assignmentId,
          dueDate: dueDateValue ? admin.firestore.Timestamp.fromDate(dueDateValue) : null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
          submittedAt: null,
        })
        tasksCreated++
      }
    }
    await batch.commit()
  }

  await assignmentRef.set({
    groupId,
    groupName: groupSnap.data()!.name,
    ownerId,
    contentTaskIds: Array.from(allTaskIdSet),
    contentRoadmapIds: body.contentRoadmapIds,
    roadmapNames,
    taskTitles,
    title: roadmapNames.length > 0 ? roadmapNames.join(', ') : taskTitles[0] || 'Задание',
    childCount: childIds.length,
    childIds,
    tasksCreated,
    assignedBy: assignedByUid,
    assignedAt: now,
    status: 'active',
    dueDate: dueDateValue ? admin.firestore.Timestamp.fromDate(dueDateValue) : null,
  })

  const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(ownerId)}/${groupId}`)
  await groupRef.update({
    lastAssignedAt: now,
    lastAssignedTaskTitles: taskTitles,
    updatedAt: now,
  })

  return { tasksCreated, childCount: childIds.length, taskCount: contentTasks.length }
}

export async function getAssignmentDetail(
  db: admin.firestore.Firestore,
  orgId: string,
  assignmentId: string
) {
  const assignmentRef = db.doc(`organizations/${orgId}/groupAssignments/${assignmentId}`)
  const assignmentSnap = await assignmentRef.get()
  if (!assignmentSnap.exists) {
    throw Object.assign(new Error('Assignment not found'), { statusCode: 404 })
  }

  const aData = assignmentSnap.data()!
  const childIds: string[] = aData.childIds || []

  const submissions = await Promise.all(
    childIds.map(async (childId) => {
      const childInfo = await fetchChildData(db, childId)
      let taskId: string | null = null
      let taskData: any = null
      try {
        const tasksSnap = await db
          .collection(`children/${childId}/tasks`)
          .where('groupAssignmentId', '==', assignmentId)
          .limit(1)
          .get()
        if (!tasksSnap.empty) {
          taskId = tasksSnap.docs[0].id
          taskData = tasksSnap.docs[0].data()
        }
      } catch {}

      const status = taskData
        ? taskData.submittedAt
          ? taskData.grade
            ? 'graded'
            : 'submitted'
          : 'pending'
        : 'pending'

      return {
        childId,
        childName: childInfo.name,
        age: childInfo.age,
        taskId,
        status,
        submissionText: taskData?.submissionText ?? null,
        fileUrl: taskData?.fileUrl ?? null,
        submittedAt: taskData?.submittedAt?.toDate?.()?.toISOString() ?? null,
        grade: taskData?.grade ?? null,
        feedback: taskData?.feedback ?? null,
        feedbackAt: taskData?.feedbackAt?.toDate?.()?.toISOString() ?? null,
      }
    })
  )

  const contentRoadmapIds: string[] = aData.contentRoadmapIds || []
  const roadmapDetails = await Promise.all(
    contentRoadmapIds.map(async (roadmapId) => {
      const roadmapSnap = await db.doc(`organizations/${orgId}/contentRoadmaps/${roadmapId}`).get()
      if (!roadmapSnap.exists) return null
      const rData = roadmapSnap.data()!
      const taskIds: string[] = rData.taskIds || []
      const taskSnaps = await Promise.all(
        taskIds.map((tid) => db.doc(`organizations/${orgId}/contentTasks/${tid}`).get())
      )
      const taskTitles = taskSnaps.filter((s) => s.exists).map((s) => s.data()!.title || '')
      return { id: roadmapId, name: rData.name || 'Program', taskTitles }
    })
  )
  const roadmaps = roadmapDetails.filter(Boolean)

  return { aData, childIds, submissions, contentRoadmapIds, roadmaps }
}

export async function deleteAssignment(
  db: admin.firestore.Firestore,
  orgId: string,
  assignmentId: string,
  childIds: string[]
) {
  const commentsSnap = await db
    .collection(`organizations/${orgId}/groupAssignments/${assignmentId}/comments`)
    .get()
  if (commentsSnap.docs.length > 0) {
    const commentBatch = db.batch()
    commentsSnap.docs.forEach((doc) => commentBatch.delete(doc.ref))
    await commentBatch.commit()
  }

  let resolvedChildIds = childIds
  if (resolvedChildIds.length === 0) {
    try {
      const orgChildrenSnap = await db.collection(`organizations/${orgId}/children`).get()
      resolvedChildIds = orgChildrenSnap.docs.map((d) => d.id)
    } catch {}
  }

  if (resolvedChildIds.length > 0) {
    const BATCH_SIZE = 400
    for (let i = 0; i < resolvedChildIds.length; i += BATCH_SIZE) {
      const chunk = resolvedChildIds.slice(i, i + BATCH_SIZE)
      const taskBatch = db.batch()
      for (const childId of chunk) {
        try {
          const tasksSnap = await db
            .collection(`children/${childId}/tasks`)
            .where('groupAssignmentId', '==', assignmentId)
            .get()
          tasksSnap.docs.forEach((doc) => taskBatch.delete(doc.ref))
        } catch {}
      }
      await taskBatch.commit()
    }
  }

  const assignmentRef = db.doc(`organizations/${orgId}/groupAssignments/${assignmentId}`)
  await assignmentRef.delete()
}

export async function getAssignmentComments(
  db: admin.firestore.Firestore,
  orgId: string,
  assignmentId: string
) {
  let snap: admin.firestore.QuerySnapshot
  try {
    snap = await db
      .collection(`organizations/${orgId}/groupAssignments/${assignmentId}/comments`)
      .orderBy('createdAt', 'asc')
      .get()
  } catch (err: any) {
    if (err.code === 9 || err.message?.includes('index')) {
      snap = await db
        .collection(`organizations/${orgId}/groupAssignments/${assignmentId}/comments`)
        .get()
    } else throw err
  }

  return snap.docs.map((doc) => {
    const d = doc.data()
    return {
      id: doc.id,
      authorId: d.authorId,
      authorName: d.authorName,
      authorRole: d.authorRole,
      text: d.text,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
    }
  })
}

export async function addComment(
  db: admin.firestore.Firestore,
  orgId: string,
  assignmentId: string,
  authorId: string,
  authorRole: string,
  text: string
) {
  const now = admin.firestore.Timestamp.fromDate(new Date())

  let authorName = authorId.slice(0, 8)
  try {
    const snap = await db.doc(`specialists/${authorId}`).get()
    if (snap.exists) {
      const d = snap.data()!
      authorName = d.fullName || d.name || authorName
    }
  } catch {}

  const commentRef = db
    .collection(`organizations/${orgId}/groupAssignments/${assignmentId}/comments`)
    .doc()
  await commentRef.set({
    authorId,
    authorName,
    authorRole,
    text,
    createdAt: now,
  })

  return { id: commentRef.id, authorName, now }
}

export async function reviewSubmission(
  db: admin.firestore.Firestore,
  orgId: string,
  assignmentId: string,
  childId: string,
  reviewerUid: string,
  grade: 'approved' | 'needs_revision',
  feedback?: string
) {
  const tasksSnap = await db
    .collection(`children/${childId}/tasks`)
    .where('groupAssignmentId', '==', assignmentId)
    .limit(1)
    .get()

  if (tasksSnap.empty) {
    throw Object.assign(new Error('Task not found for this child and assignment'), {
      statusCode: 404,
    })
  }

  const now = admin.firestore.Timestamp.fromDate(new Date())
  await tasksSnap.docs[0].ref.update({
    grade,
    feedback: feedback ?? null,
    feedbackBy: reviewerUid,
    feedbackAt: now,
    status: grade === 'approved' ? 'completed' : 'pending',
    updatedAt: now,
  })
}
