import admin from 'firebase-admin'

export const COLLECTIONS = {
  ORG_CHILDREN: (orgId: string) => `organizations/${orgId}/children`,
  CHILDREN: 'children',
  CHILD_PROGRESS: (childId: string) => `children/${childId}/progress/speech`,
  CHILD_TASKS: (childId: string) => `children/${childId}/tasks`,
  CHILD_FEEDBACK: (childId: string) => `children/${childId}/feedback`,
  CHILD_GUARDIANS: (childId: string) => `children/${childId}/guardians`,
  ORG_PARENTS: (orgId: string) => `orgParents/${orgId}/parents`,
} as const

export const DEFAULT_TIMELINE_DAYS = 30
export const MIN_TIMELINE_DAYS = 7
export const MAX_TIMELINE_DAYS = 90

export interface ChildInfo {
  childId: string
  childName: string
  childAge?: number
  assignedAt: string | null
}

export interface ParentConnection {
  parentUserId: string
  parentName: string
  parentEmail: string | null
  specialistId: string | null
  joinedAt: string | null
  children: ChildInfo[]
}

export async function fetchAssignedChildren(
  db: admin.firestore.Firestore,
  orgId: string,
  role: string,
  uid: string
): Promise<{ docs: admin.firestore.QueryDocumentSnapshot[] }> {
  const orgChildrenRef = db.collection(COLLECTIONS.ORG_CHILDREN(orgId))

  if (role === 'org_admin') {
    return orgChildrenRef.where('assigned', '==', true).get()
  }

  const directSnap = await orgChildrenRef
    .where('assigned', '==', true)
    .where('assignedSpecialistId', '==', uid)
    .get()

  const seenIds = new Set(directSnap.docs.map((d) => d.id))
  const allDocs: admin.firestore.QueryDocumentSnapshot[] = [...directSnap.docs]

  const groupsSnap = await db
    .collection(`specialists/${uid}/groups`)
    .where('orgId', '==', orgId)
    .get()

  for (const groupDoc of groupsSnap.docs) {
    const parentsSnap = await db
      .collection(`specialists/${uid}/groups/${groupDoc.id}/parents`)
      .get()

    const newChildIds: string[] = []
    for (const parentDoc of parentsSnap.docs) {
      const childIds = (parentDoc.data().childIds as string[]) || []
      for (const childId of childIds) {
        if (!seenIds.has(childId)) {
          newChildIds.push(childId)
          seenIds.add(childId)
        }
      }
    }

    for (let i = 0; i < newChildIds.length; i += 10) {
      const batch = newChildIds.slice(i, i + 10)
      const batchSnap = await orgChildrenRef
        .where(admin.firestore.FieldPath.documentId(), 'in', batch)
        .get()
      allDocs.push(...batchSnap.docs)
    }
  }

  return { docs: allDocs }
}

export function pickStoredProfileName(
  data: admin.firestore.DocumentData | null | undefined
): string | null {
  if (!data) return null
  const n =
    data.childName ||
    data.name ||
    data.displayName ||
    data.fullName ||
    data.registeredName ||
    data.nickname
  if (typeof n === 'string' && n.trim()) return n.trim()
  if (data.firstName) {
    const fn = data.firstName as string
    const ln = data.lastName as string | undefined
    return ln ? `${fn} ${ln}`.trim() : fn
  }
  return null
}

export async function resolveChildName(
  db: admin.firestore.Firestore,
  childId: string,
  parentUserId?: string,
  orgLinkData?: admin.firestore.DocumentData | null
): Promise<string> {
  const fromLink = pickStoredProfileName(orgLinkData ?? undefined)
  if (fromLink) return fromLink

  const childSnap = await db.doc(`${COLLECTIONS.CHILDREN}/${childId}`).get()
  if (childSnap.exists) {
    const d = childSnap.data()
    const fromChild = pickStoredProfileName(d ?? undefined)
    if (fromChild && fromChild !== 'Unknown') return fromChild
  }

  const userSnap = await db.doc(`users/${childId}`).get()
  if (userSnap.exists) {
    const u = userSnap.data()
    const fromUser = pickStoredProfileName(u ?? undefined)
    if (fromUser && fromUser !== 'Unknown') return fromUser
  }

  if (parentUserId && parentUserId !== childId) {
    const parentSnap = await db.doc(`users/${parentUserId}`).get()
    if (parentSnap.exists) {
      const p = parentSnap.data()
      const fromParent = pickStoredProfileName(p ?? undefined)
      if (fromParent && fromParent !== 'Unknown') return fromParent
    }
  }

  const authUids = [...new Set([childId, parentUserId].filter(Boolean) as string[])]
  for (const uid of authUids) {
    try {
      const user = await admin.auth().getUser(uid)
      if (user.displayName?.trim()) return user.displayName.trim()
      if (user.email) return user.email.split('@')[0]
    } catch {}
  }

  return 'Unknown'
}

export function resolveChildNameFromData(
  childId: string,
  childData: admin.firestore.DocumentData | null | undefined,
  userData: admin.firestore.DocumentData | null | undefined
): string | null {
  const childName =
    childData?.name ||
    childData?.childName ||
    childData?.fullName ||
    (childData?.firstName
      ? childData.lastName
        ? `${childData.firstName} ${childData.lastName}`
        : childData.firstName
      : undefined)
  if (childName) return childName as string

  const userName =
    userData?.name ||
    userData?.childName ||
    userData?.fullName ||
    userData?.displayName ||
    (userData?.firstName
      ? userData.lastName
        ? `${userData.firstName} ${userData.lastName}`
        : userData.firstName
      : undefined)
  if (userName) return userName as string

  return childId || null
}

export async function fetchChildDetails(
  db: admin.firestore.Firestore,
  childId: string,
  parentUserId?: string,
  orgLinkData?: admin.firestore.DocumentData | null
) {
  const childSnap = await db.doc(`${COLLECTIONS.CHILDREN}/${childId}`).get()
  const childData = childSnap.exists ? childSnap.data() : null

  const userSnap = await db.doc(`users/${childId}`).get()
  const userData = userSnap.exists ? userSnap.data() : null

  const name = await resolveChildName(db, childId, parentUserId, orgLinkData)
  const age = childData?.age || childData?.childAge || userData?.age || userData?.childAge

  return { name, age }
}

export function groupChildrenByParent(childrenDocs: admin.firestore.QueryDocumentSnapshot[]): {
  parentMap: Map<string, ChildInfo[]>
  orgLinkByChildId: Map<string, admin.firestore.DocumentData>
} {
  const parentMap = new Map<string, ChildInfo[]>()
  const orgLinkByChildId = new Map<string, admin.firestore.DocumentData>()

  for (const childDoc of childrenDocs) {
    const linkData = childDoc.data()
    const childId = childDoc.id
    const parentUserId = linkData.parentUserId

    orgLinkByChildId.set(childId, linkData)

    if (!parentUserId) {
      continue
    }

    if (!parentMap.has(parentUserId)) {
      parentMap.set(parentUserId, [])
    }

    parentMap.get(parentUserId)!.push({
      childId,
      childName: 'Unknown',
      childAge: undefined,
      assignedAt: linkData.assignedAt?.toDate?.()?.toISOString() || null,
    })
  }

  return { parentMap, orgLinkByChildId }
}

export async function enrichChildrenWithDetails(
  db: admin.firestore.Firestore,
  parentMap: Map<string, ChildInfo[]>,
  orgLinkByChildId: Map<string, admin.firestore.DocumentData>
) {
  await Promise.all(
    Array.from(parentMap.entries()).flatMap(([parentUserId, children]) =>
      children.map(async (child) => {
        const linkData = orgLinkByChildId.get(child.childId)
        const details = await fetchChildDetails(db, child.childId, parentUserId, linkData)
        child.childName = details.name
        child.childAge = details.age
      })
    )
  )
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

export async function buildParentConnection(
  db: admin.firestore.Firestore,
  orgId: string,
  parentUserId: string,
  children: ChildInfo[]
): Promise<ParentConnection> {
  const { name: parentName, email: parentEmail } = await resolveUserName(db, parentUserId)

  const orgParentRef = db.doc(`${COLLECTIONS.ORG_PARENTS(orgId)}/${parentUserId}`)
  const orgParentSnap = await orgParentRef.get()
  const orgParentData = orgParentSnap.exists ? orgParentSnap.data() : null

  return {
    parentUserId,
    parentName,
    parentEmail,
    specialistId: orgParentData?.linkedSpecialistUid || null,
    joinedAt: orgParentData?.joinedAt?.toDate?.()?.toISOString() || null,
    children,
  }
}

export async function fetchChildProgress(db: admin.firestore.Firestore, childId: string) {
  const progressRef = db.doc(COLLECTIONS.CHILD_PROGRESS(childId))
  const progressSnap = await progressRef.get()
  return progressSnap.exists ? progressSnap.data() : null
}

export async function countCompletedTasks(db: admin.firestore.Firestore, childId: string) {
  const tasksRef = db.collection(COLLECTIONS.CHILD_TASKS(childId))
  const tasksSnapshot = await tasksRef.where('status', '==', 'completed').get()
  return tasksSnapshot.size
}

export function parseTimelineDays(daysParam: string | undefined): number {
  const days = parseInt(daysParam || String(DEFAULT_TIMELINE_DAYS), 10)
  return Math.min(Math.max(days, MIN_TIMELINE_DAYS), MAX_TIMELINE_DAYS)
}

export function buildActivityMap(
  tasksDocs: admin.firestore.QueryDocumentSnapshot[]
): Map<string, { attempted: number; completed: number }> {
  const activityMap = new Map<string, { attempted: number; completed: number }>()

  tasksDocs.forEach((doc) => {
    const taskData = doc.data()
    const updatedAt = taskData.updatedAt?.toDate() || new Date()
    const dateKey = updatedAt.toISOString().split('T')[0]

    if (!activityMap.has(dateKey)) {
      activityMap.set(dateKey, { attempted: 0, completed: 0 })
    }

    const day = activityMap.get(dateKey)!
    day.attempted++

    if (taskData.status === 'completed') {
      day.completed++
    }
  })

  return activityMap
}

export function buildFeedbackMap(
  feedbackDocs: admin.firestore.QueryDocumentSnapshot[]
): Map<string, { mood: 'good' | 'ok' | 'hard'; comment?: string; timestamp: Date }> {
  const feedbackMap = new Map()

  feedbackDocs.forEach((doc) => {
    const feedbackData = doc.data()
    const timestamp = feedbackData.timestamp?.toDate() || new Date()
    const dateKey = timestamp.toISOString().split('T')[0]

    feedbackMap.set(dateKey, {
      mood: feedbackData.mood || 'ok',
      comment: feedbackData.comment,
      timestamp,
    })
  })

  return feedbackMap
}

export function buildTimelineDays(
  days: number,
  activityMap: Map<string, { attempted: number; completed: number }>,
  feedbackMap: Map<string, { mood: 'good' | 'ok' | 'hard'; comment?: string; timestamp: Date }>
) {
  const timelineDays = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const dateKey = date.toISOString().split('T')[0]
    const activity = activityMap.get(dateKey) || { attempted: 0, completed: 0 }
    const feedback = feedbackMap.get(dateKey)

    timelineDays.push({
      date: dateKey,
      tasksAttempted: activity.attempted,
      tasksCompleted: activity.completed,
      feedback: feedback
        ? {
            mood: feedback.mood,
            comment: feedback.comment,
            timestamp: feedback.timestamp,
          }
        : undefined,
    })
  }

  return timelineDays
}

export async function createChildRecord(
  db: admin.firestore.Firestore,
  orgId: string,
  createdByUid: string,
  body: {
    firstName: string
    lastName?: string
    dateOfBirth?: string
    gender?: string
    diagnosis?: string
    primaryConcern?: string
  }
) {
  const now = admin.firestore.Timestamp.fromDate(new Date())
  const fullName = [body.firstName.trim(), body.lastName?.trim()].filter(Boolean).join(' ')

  const globalRef = db.collection('children').doc()
  const childData = {
    name: fullName,
    firstName: body.firstName.trim(),
    lastName: body.lastName?.trim() || null,
    dateOfBirth: body.dateOfBirth || null,
    gender: body.gender || null,
    diagnosis: body.diagnosis || null,
    primaryConcern: body.primaryConcern || null,
    orgId,
    createdBy: createdByUid,
    createdAt: now,
    updatedAt: now,
  }

  await globalRef.set(childData)
  await db.collection(`organizations/${orgId}/children`).doc(globalRef.id).set({
    assigned: true,
    childId: globalRef.id,
    name: fullName,
    createdAt: now,
    updatedAt: now,
  })

  return { id: globalRef.id, childData, now }
}

export async function disconnectParentFromOrg(
  db: admin.firestore.Firestore,
  orgId: string,
  parentUserId: string
): Promise<{ childrenUnlinked: number; groupsUpdated: number }> {
  const now = admin.firestore.Timestamp.fromDate(new Date())

  const orgChildrenRef = db.collection(COLLECTIONS.ORG_CHILDREN(orgId))
  const childrenSnap = await orgChildrenRef.where('parentUserId', '==', parentUserId).get()

  let childrenUnlinked = 0
  if (!childrenSnap.empty) {
    const BATCH_SIZE = 400
    for (let i = 0; i < childrenSnap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch()
      for (const doc of childrenSnap.docs.slice(i, i + BATCH_SIZE)) {
        batch.update(doc.ref, { assigned: false, disconnectedAt: now })
        childrenUnlinked++
      }
      await batch.commit()
    }
  }

  await db.doc(`${COLLECTIONS.ORG_PARENTS(orgId)}/${parentUserId}`).delete()

  const membersSnap = await db.collection(`organizations/${orgId}/members`).get()
  let groupsUpdated = 0

  for (const memberDoc of membersSnap.docs) {
    const memberId = memberDoc.id
    let groupsSnap: admin.firestore.QuerySnapshot
    try {
      groupsSnap = await db
        .collection(`specialists/${memberId}/groups`)
        .where('orgId', '==', orgId)
        .get()
    } catch {
      continue
    }
    for (const groupDoc of groupsSnap.docs) {
      const parentRef = db.doc(
        `specialists/${memberId}/groups/${groupDoc.id}/parents/${parentUserId}`
      )
      const parentSnap = await parentRef.get()
      if (parentSnap.exists) {
        await parentRef.delete()
        groupsUpdated++
      }
    }
  }

  return { childrenUnlinked, groupsUpdated }
}

export async function removeChildFromOrg(
  db: admin.firestore.Firestore,
  orgId: string,
  childId: string,
  removedByUid: string
): Promise<{ groupsCleaned: number }> {
  const now = admin.firestore.Timestamp.fromDate(new Date())
  const orgChildRef = db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${childId}`)

  const orgChildSnap = await orgChildRef.get()
  if (!orgChildSnap.exists) {
    throw Object.assign(new Error('Child not found in this organization'), { statusCode: 404 })
  }

  await orgChildRef.update({ assigned: false, removedAt: now, removedBy: removedByUid })

  const membersSnap = await db.collection(`organizations/${orgId}/members`).get()
  let groupsCleaned = 0

  for (const memberDoc of membersSnap.docs) {
    const specialistId = memberDoc.id
    try {
      const groupsSnap = await db
        .collection(`specialists/${specialistId}/groups`)
        .where('orgId', '==', orgId)
        .get()

      for (const groupDoc of groupsSnap.docs) {
        const groupData = groupDoc.data()
        const groupChildIds = (groupData.childIds as string[]) || []
        if (groupChildIds.includes(childId)) {
          await groupDoc.ref.update({
            childIds: groupChildIds.filter((id: string) => id !== childId),
          })
          groupsCleaned++
        }

        const parentsSnap = await db
          .collection(`specialists/${specialistId}/groups/${groupDoc.id}/parents`)
          .get()

        for (const parentDoc of parentsSnap.docs) {
          const childIds = (parentDoc.data().childIds as string[]) || []
          if (childIds.includes(childId)) {
            const updated = childIds.filter((id: string) => id !== childId)
            if (updated.length === 0) {
              await parentDoc.ref.delete()
            } else {
              await parentDoc.ref.update({ childIds: updated })
            }
            groupsCleaned++
          }
        }
      }
    } catch {
      continue
    }
  }

  return { groupsCleaned }
}

export async function getChildProfile(
  db: admin.firestore.Firestore,
  orgId: string,
  childId: string
) {
  const [orgDoc, globalDoc] = await Promise.all([
    db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${childId}`).get(),
    db.doc(`${COLLECTIONS.CHILDREN}/${childId}`).get(),
  ])

  const orgData = orgDoc.exists ? orgDoc.data() : {}
  const globalData = globalDoc.exists ? globalDoc.data() : {}
  const merged = { ...globalData, ...orgData }

  return {
    firstName: merged.firstName ?? null,
    lastName: merged.lastName ?? null,
    fullName: merged.fullName || merged.name || '',
    photoUrl: merged.photoUrl ?? null,
    dateOfBirth: merged.dateOfBirth ?? null,
    age: merged.age ?? null,
    gender: merged.gender ?? null,
    status: merged.status || 'active',
    startDate: merged.startDate ?? null,
    branchId: merged.branchId ?? null,
    primaryConcern: merged.primaryConcern ?? null,
    diagnosis: merged.diagnosis ?? null,
    developmentalNotes: merged.developmentalNotes ?? null,
    communicationLevel: merged.communicationLevel ?? null,
    therapyGoals: merged.therapyGoals ?? null,
    contraindications: merged.contraindications ?? null,
    importantNotes: merged.importantNotes ?? null,
    internalCode: merged.internalCode ?? null,
  }
}

export async function updateChildProfile(
  db: admin.firestore.Firestore,
  orgId: string,
  childId: string,
  data: Record<string, unknown>
) {
  const now = admin.firestore.Timestamp.fromDate(new Date())

  if (data.firstName !== undefined || data.lastName !== undefined) {
    const orgDoc = await db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${childId}`).get()
    const existing = orgDoc.exists ? orgDoc.data() : {}
    const fn = (data.firstName as string) ?? existing?.firstName ?? ''
    const ln = (data.lastName as string) ?? existing?.lastName ?? ''
    data.fullName = `${fn} ${ln}`.trim() || fn || ln
  }

  const updateData = { ...data, updatedAt: now }

  await Promise.all([
    db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${childId}`).set(updateData, { merge: true }),
    db.doc(`${COLLECTIONS.CHILDREN}/${childId}`).set(updateData, { merge: true }),
  ])

  return data
}

export async function getChildGuardians(
  db: admin.firestore.Firestore,
  orgId: string,
  childId: string
) {
  const [snap, linkSnap] = await Promise.all([
    db.collection(COLLECTIONS.CHILD_GUARDIANS(childId)).get(),
    db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${childId}`).get(),
  ])

  const parentUserId: string | null = linkSnap.exists
    ? (linkSnap.data()?.parentUserId ?? null)
    : null

  let orgParentData: admin.firestore.DocumentData | null = null
  let parentAuthDisplayName: string | null = null
  let parentAuthEmail: string | null = null
  if (parentUserId) {
    const [opSnap] = await Promise.all([
      db.doc(`${COLLECTIONS.ORG_PARENTS(orgId)}/${parentUserId}`).get(),
    ])
    orgParentData = opSnap.exists ? (opSnap.data() ?? null) : null
    try {
      const authUser = await admin.auth().getUser(parentUserId)
      parentAuthDisplayName = authUser.displayName || null
      parentAuthEmail = authUser.email || null
    } catch {
      /* ignore */
    }
  }

  const guardians = await Promise.all(
    snap.docs.map(async (doc) => {
      const d = doc.data()
      let enriched: Record<string, unknown> = {}

      if (d.appUserId) {
        const parentSnap = await db.doc(`${COLLECTIONS.ORG_PARENTS(orgId)}/${d.appUserId}`).get()
        if (parentSnap.exists) {
          const p = parentSnap.data()
          enriched = {
            phone: p?.phone || d.phone,
            whatsapp: p?.whatsapp || d.whatsapp,
            email: p?.email || d.email,
          }
        }
      }

      return {
        id: doc.id,
        fullName: d.fullName || '',
        relationship: d.relationship || 'guardian',
        phone: enriched.phone ?? d.phone ?? null,
        whatsapp: enriched.whatsapp ?? d.whatsapp ?? null,
        email: enriched.email ?? d.email ?? null,
        preferredContactMethod: d.preferredContactMethod ?? null,
        isPrimaryContact: d.isPrimaryContact ?? false,
        isEmergencyContact: d.isEmergencyContact ?? false,
        appUserId: d.appUserId ?? null,
        createdAt: d.createdAt?.toDate()?.toISOString() ?? null,
        updatedAt: d.updatedAt?.toDate()?.toISOString() ?? null,
      }
    })
  )

  const alreadyLinked = guardians.some((g) => g.appUserId === parentUserId)
  if (parentUserId && !alreadyLinked && (orgParentData || parentAuthEmail)) {
    const syntheticGuardian = {
      id: `__app__${parentUserId}`,
      fullName:
        orgParentData?.fullName || parentAuthDisplayName || orgParentData?.name || 'Родитель',
      relationship: 'guardian' as const,
      phone: orgParentData?.phone ?? null,
      whatsapp: orgParentData?.whatsapp ?? null,
      email: parentAuthEmail ?? orgParentData?.email ?? null,
      address: orgParentData?.address ?? null,
      preferredContactMethod: null,
      isPrimaryContact: true,
      isEmergencyContact: false,
      appUserId: parentUserId,
      fromApp: true,
      createdAt: null,
      updatedAt: orgParentData?.updatedAt?.toDate?.()?.toISOString() ?? null,
    }
    guardians.unshift(syntheticGuardian as any)
  }

  return guardians
}

export async function addGuardian(
  db: admin.firestore.Firestore,
  childId: string,
  data: Record<string, unknown>
) {
  const now = admin.firestore.Timestamp.fromDate(new Date())
  const docRef = await db.collection(COLLECTIONS.CHILD_GUARDIANS(childId)).add({
    ...data,
    createdAt: now,
    updatedAt: now,
  })
  return { id: docRef.id, now }
}

export async function updateGuardian(
  db: admin.firestore.Firestore,
  childId: string,
  guardianId: string,
  data: Record<string, unknown>
) {
  const now = admin.firestore.Timestamp.fromDate(new Date())
  const ref = db.doc(`${COLLECTIONS.CHILD_GUARDIANS(childId)}/${guardianId}`)
  const snap = await ref.get()
  if (!snap.exists) {
    throw Object.assign(new Error('Guardian not found'), { statusCode: 404 })
  }
  await ref.update({ ...data, updatedAt: now })
  const updated = (await ref.get()).data()
  return { updated, now }
}

export async function deleteGuardian(
  db: admin.firestore.Firestore,
  childId: string,
  guardianId: string
) {
  const ref = db.doc(`${COLLECTIONS.CHILD_GUARDIANS(childId)}/${guardianId}`)
  const snap = await ref.get()
  if (!snap.exists) {
    throw Object.assign(new Error('Guardian not found'), { statusCode: 404 })
  }
  await ref.delete()
}

export async function createChildTask(
  db: admin.firestore.Firestore,
  childId: string,
  createdByUid: string,
  title: string,
  description?: string
) {
  const now = admin.firestore.Timestamp.fromDate(new Date())
  const taskData = {
    title,
    description: description ?? null,
    status: 'pending',
    createdBy: createdByUid,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
  const taskRef = await db.collection(COLLECTIONS.CHILD_TASKS(childId)).add(taskData)
  return { id: taskRef.id, taskData, now }
}

export async function listChildTasks(db: admin.firestore.Firestore, childId: string) {
  const tasksRef = db.collection(COLLECTIONS.CHILD_TASKS(childId))
  const snapshot = await tasksRef.orderBy('updatedAt', 'desc').get()
  return snapshot.docs.map((doc) => {
    const d = doc.data()
    return {
      id: doc.id,
      title: d.title || 'Untitled Task',
      description: d.description ?? null,
      status: d.status || 'pending',
      createdBy: d.createdBy ?? null,
      createdAt: d.createdAt?.toDate() ?? null,
      updatedAt: d.updatedAt?.toDate() ?? null,
      completedAt: d.completedAt?.toDate() ?? null,
      submissionText: d.submissionText ?? null,
      fileUrl: d.fileUrl ?? null,
      submittedAt: d.submittedAt?.toDate() ?? null,
    }
  })
}
