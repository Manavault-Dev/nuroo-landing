import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../infrastructure/database/firebase.js'
import { requireOrgMember } from '../plugins/rbac.js'

const DEFAULT_GROUP_COLOR = '#6366f1'

const COLLECTIONS = {
  SPECIALIST_GROUPS: (uid: string) => `specialists/${uid}/groups`,
  GROUP_PARENTS: (uid: string, groupId: string) => `specialists/${uid}/groups/${groupId}/parents`,
  ORG_CHILDREN: (orgId: string) => `organizations/${orgId}/children`,
  ORG_MEMBERS: (orgId: string) => `organizations/${orgId}/members`,
  SPECIALISTS: 'specialists',
  CHILDREN: 'children',
} as const

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
})

const addParentToGroupSchema = z.object({
  parentUserId: z.string().min(1),
  childIds: z.array(z.string()).optional(),
})

const addCommentSchema = z.object({
  text: z.string().min(1).max(2000),
})

const reviewSubmissionSchema = z.object({
  grade: z.enum(['approved', 'needs_revision']),
  feedback: z.string().max(2000).optional(),
})

const updateAssignmentSchema = z.object({
  status: z.enum(['active', 'closed']).optional(),
  dueDate: z.string().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
})

const assignGroupTasksSchema = z.object({
  contentTaskIds: z.array(z.string().min(1)).min(1).max(50),
  dueDate: z.string().nullable().optional(),
})

function isIndexError(error: any): boolean {
  return error.code === 9 || error.message?.includes('index')
}

function sortByCreatedAt(
  docs: admin.firestore.QueryDocumentSnapshot[]
): admin.firestore.QueryDocumentSnapshot[] {
  return docs.sort((a, b) => {
    const aTime = a.data().createdAt?.toDate?.()?.getTime() || 0
    const bTime = b.data().createdAt?.toDate?.()?.getTime() || 0
    return bTime - aTime
  })
}

async function fetchGroupsWithFallback(db: admin.firestore.Firestore, uid: string, orgId: string) {
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

async function getSpecialistDisplayName(
  db: admin.firestore.Firestore,
  specialistUid: string
): Promise<string> {
  const ref = db.doc(`${COLLECTIONS.SPECIALISTS}/${specialistUid}`)
  const snap = await ref.get()
  if (!snap.exists) return specialistUid.slice(0, 8)
  const d = snap.data()
  return (d?.fullName || d?.name || specialistUid.slice(0, 8)) as string
}

/** For org_admin: fetch all groups in the org (from all specialists), with owner info */
async function fetchAllOrgGroups(
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

async function countGroupParents(db: admin.firestore.Firestore, uid: string, groupId: string) {
  const parentsSnapshot = await db.collection(COLLECTIONS.GROUP_PARENTS(uid, groupId)).get()
  return parentsSnapshot.docs.length
}

function transformGroup(
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

async function resolveUserName(
  db: admin.firestore.Firestore,
  uid: string
): Promise<{ name: string; email: string | null }> {
  // 1. users/{uid} — where mobile app stores the name
  const userSnap = await db.doc(`users/${uid}`).get()
  if (userSnap.exists) {
    const d = userSnap.data()!
    const name = d.name || d.childName || d.fullName || d.displayName
    if (name) return { name: name as string, email: d.email || null }
  }

  // 2. Firebase Auth
  try {
    const user = await admin.auth().getUser(uid)
    const name = user.displayName || user.email?.split('@')[0] || uid.slice(0, 8)
    return { name, email: user.email || null }
  } catch {
    return { name: uid.slice(0, 8), email: null }
  }
}

async function fetchChildData(
  db: admin.firestore.Firestore,
  childId: string,
  parentUserId?: string
) {
  const childRef = db.doc(`${COLLECTIONS.CHILDREN}/${childId}`)
  const childSnap = await childRef.get()
  const childData = childSnap.exists ? childSnap.data() : null

  let name = childData?.name || childData?.childName || ''
  let age = childData?.age || childData?.childAge

  // Fallback to users collection (mobile app stores child name here)
  if (!name) {
    const userSnap = await db.doc(`users/${childId}`).get()
    if (userSnap.exists) {
      const userData = userSnap.data()!
      name = userData.name || userData.childName || ''
      age = age || userData.age || userData.childAge
    }
  }

  // Fallback to Firebase Auth displayName
  if (!name) {
    const uidToLookup = parentUserId || childId
    try {
      const user = await admin.auth().getUser(uidToLookup)
      if (user.displayName) name = user.displayName
      else if (user.email) name = user.email.split('@')[0]
    } catch {
      // user not found
    }
  }

  return {
    id: childId,
    name: name || 'Unknown',
    age,
  }
}

async function getChildIdsForParent(
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

function verifyGroupOwnership(groupData: admin.firestore.DocumentData, orgId: string): boolean {
  return groupData.orgId === orgId
}

function buildGroupData(body: z.infer<typeof createGroupSchema>, orgId: string, now: Date) {
  return {
    name: body.name,
    description: body.description || null,
    color: body.color || DEFAULT_GROUP_COLOR,
    orgId,
    createdAt: admin.firestore.Timestamp.fromDate(now),
    updatedAt: admin.firestore.Timestamp.fromDate(now),
  }
}

export const groupsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/groups', async (request, reply) => {
    try {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const db = getFirestore()

      if (member.role === 'org_admin') {
        const allGroupsWithOwner = await fetchAllOrgGroups(db, orgId)
        const groups = await Promise.all(
          allGroupsWithOwner.map(async ({ doc, ownerId }) => {
            const parentCount = await countGroupParents(db, ownerId, doc.id)
            const ownerName = await getSpecialistDisplayName(db, ownerId)
            return transformGroup(doc, parentCount, { ownerId, ownerName })
          })
        )
        return { ok: true, groups, count: groups.length }
      }

      const groupsSnapshot = await fetchGroupsWithFallback(db, uid, orgId)
      const groups = await Promise.all(
        groupsSnapshot.docs.map(async (doc) => {
          const parentCount = await countGroupParents(db, uid, doc.id)
          return transformGroup(doc, parentCount)
        })
      )

      return {
        ok: true,
        groups,
        count: groups.length,
      }
    } catch (error: any) {
      console.error('[GROUPS] Error listing groups:', error)
      return reply.code(500).send({
        error: 'Failed to list groups',
        details: error.message,
      })
    }
  })

  fastify.post<{
    Params: { orgId: string }
    Body: z.infer<typeof createGroupSchema>
  }>('/orgs/:orgId/groups', async (request, reply) => {
    try {
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const body = createGroupSchema.parse(request.body)
      const now = new Date()

      const db = getFirestore()

      const existingGroups = await db
        .collection(COLLECTIONS.SPECIALIST_GROUPS(uid))
        .where('orgId', '==', orgId)
        .where('name', '==', body.name)
        .limit(1)
        .get()

      if (!existingGroups.empty) {
        return reply.code(400).send({
          error: 'Group with this name already exists',
        })
      }

      const groupRef = db.collection(COLLECTIONS.SPECIALIST_GROUPS(uid)).doc()
      const groupId = groupRef.id
      const groupData = buildGroupData(body, orgId, now)

      await groupRef.set(groupData)

      return {
        ok: true,
        group: {
          id: groupId,
          ...groupData,
          parentCount: 0,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      }
    } catch (error: any) {
      console.error('[GROUPS] Error creating group:', error)
      return reply.code(500).send({
        error: 'Failed to create group',
        details: error.message,
      })
    }
  })

  fastify.get<{
    Params: { orgId: string; groupId: string }
    Querystring: { ownerId?: string }
  }>('/orgs/:orgId/groups/:groupId', async (request, reply) => {
    try {
      const { orgId, groupId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const ownerId =
        member.role === 'org_admin' && request.query?.ownerId
          ? (request.query as { ownerId: string }).ownerId
          : uid

      const db = getFirestore()
      const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(ownerId)}/${groupId}`)
      const groupSnap = await groupRef.get()

      if (!groupSnap.exists) {
        return reply.code(404).send({ error: 'Group not found' })
      }

      const groupData = groupSnap.data()!

      if (!verifyGroupOwnership(groupData, orgId)) {
        return reply.code(403).send({
          error: 'Group does not belong to this organization',
        })
      }

      if (member.role === 'specialist' && ownerId !== uid) {
        return reply.code(403).send({ error: 'You can only view your own groups' })
      }

      const parentsSnapshot = await db.collection(COLLECTIONS.GROUP_PARENTS(ownerId, groupId)).get()

      const parents = await Promise.all(
        parentsSnapshot.docs.map(async (doc) => {
          const data = doc.data()
          const parentUid = doc.id
          const { name, email } = await resolveUserName(db, parentUid)
          const childIds = data.childIds || []
          const children = await Promise.all(
            childIds.map((childId: string) => fetchChildData(db, childId, parentUid))
          )

          return {
            parentUserId: parentUid,
            name,
            email,
            children,
            addedAt: data.addedAt?.toDate?.()?.toISOString() || null,
          }
        })
      )

      const groupPayload: Record<string, unknown> = {
        id: groupId,
        name: groupData.name,
        description: groupData.description || null,
        color: groupData.color || DEFAULT_GROUP_COLOR,
        orgId: groupData.orgId,
        parents,
        parentCount: parents.length,
        createdAt: groupData.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: groupData.updatedAt?.toDate?.()?.toISOString() || null,
      }
      if (member.role === 'org_admin' && ownerId !== uid) {
        groupPayload.ownerId = ownerId
        groupPayload.ownerName = await getSpecialistDisplayName(db, ownerId)
      }
      return { ok: true, group: groupPayload }
    } catch (error: any) {
      console.error('[GROUPS] Error getting group:', error)
      return reply.code(500).send({
        error: 'Failed to get group',
        details: error.message,
      })
    }
  })

  fastify.post<{
    Params: { orgId: string; groupId: string }
    Body: z.infer<typeof addParentToGroupSchema>
  }>('/orgs/:orgId/groups/:groupId/parents', async (request, reply) => {
    try {
      const { orgId, groupId } = request.params
      await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const body = addParentToGroupSchema.parse(request.body)
      const now = new Date()

      const db = getFirestore()

      const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(uid)}/${groupId}`)
      const groupSnap = await groupRef.get()

      if (!groupSnap.exists) {
        return reply.code(404).send({ error: 'Group not found' })
      }

      const groupData = groupSnap.data()!

      if (!verifyGroupOwnership(groupData, orgId)) {
        return reply.code(403).send({
          error: 'Group does not belong to this organization',
        })
      }

      const orgChildrenSnap = await db
        .collection(COLLECTIONS.ORG_CHILDREN(orgId))
        .where('parentUserId', '==', body.parentUserId)
        .limit(1)
        .get()

      if (orgChildrenSnap.empty) {
        return reply.code(404).send({
          error: 'Parent is not linked to this organization',
        })
      }

      let childIds = body.childIds || []
      if (childIds.length === 0) {
        childIds = await getChildIdsForParent(db, orgId, body.parentUserId)
      }

      const parentRef = db.doc(`${COLLECTIONS.GROUP_PARENTS(uid, groupId)}/${body.parentUserId}`)
      const parentSnap = await parentRef.get()

      const parentData = {
        childIds,
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      }

      if (parentSnap.exists) {
        await parentRef.update(parentData)
      } else {
        await parentRef.set({
          ...parentData,
          addedAt: admin.firestore.Timestamp.fromDate(now),
        })
      }

      return {
        ok: true,
        message: 'Parent added to group successfully',
      }
    } catch (error: any) {
      console.error('[GROUPS] Error adding parent to group:', error)
      return reply.code(500).send({
        error: 'Failed to add parent to group',
        details: error.message,
      })
    }
  })

  fastify.delete<{ Params: { orgId: string; groupId: string; parentUserId: string } }>(
    '/orgs/:orgId/groups/:groupId/parents/:parentUserId',
    async (request, reply) => {
      try {
        const { orgId, groupId, parentUserId } = request.params
        await requireOrgMember(request, reply, orgId)
        const { uid } = request.user!

        const db = getFirestore()

        const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(uid)}/${groupId}`)
        const groupSnap = await groupRef.get()

        if (!groupSnap.exists) {
          return reply.code(404).send({ error: 'Group not found' })
        }

        const parentRef = db.doc(`${COLLECTIONS.GROUP_PARENTS(uid, groupId)}/${parentUserId}`)
        await parentRef.delete()

        return {
          ok: true,
          message: 'Parent removed from group successfully',
        }
      } catch (error: any) {
        console.error('[GROUPS] Error removing parent from group:', error)
        return reply.code(500).send({
          error: 'Failed to remove parent from group',
          details: error.message,
        })
      }
    }
  )

  fastify.patch<{
    Params: { orgId: string; groupId: string }
    Body: Partial<z.infer<typeof createGroupSchema>>
  }>('/orgs/:orgId/groups/:groupId', async (request, reply) => {
    try {
      const { orgId, groupId } = request.params
      await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const body = request.body as any
      const now = new Date()

      const db = getFirestore()

      const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(uid)}/${groupId}`)
      const groupSnap = await groupRef.get()

      if (!groupSnap.exists) {
        return reply.code(404).send({ error: 'Group not found' })
      }

      const groupData = groupSnap.data()!

      if (!verifyGroupOwnership(groupData, orgId)) {
        return reply.code(403).send({
          error: 'Group does not belong to this organization',
        })
      }

      if (body.name && body.name !== groupData.name) {
        const existingGroups = await db
          .collection(COLLECTIONS.SPECIALIST_GROUPS(uid))
          .where('orgId', '==', orgId)
          .where('name', '==', body.name)
          .limit(1)
          .get()

        if (!existingGroups.empty) {
          return reply.code(400).send({
            error: 'Group with this name already exists',
          })
        }
      }

      const updateData: any = {
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      }

      if (body.name) updateData.name = body.name
      if (body.description !== undefined) updateData.description = body.description || null
      if (body.color) updateData.color = body.color

      await groupRef.update(updateData)

      return {
        ok: true,
        message: 'Group updated successfully',
      }
    } catch (error: any) {
      console.error('[GROUPS] Error updating group:', error)
      return reply.code(500).send({
        error: 'Failed to update group',
        details: error.message,
      })
    }
  })

  fastify.delete<{ Params: { orgId: string; groupId: string } }>(
    '/orgs/:orgId/groups/:groupId',
    async (request, reply) => {
      try {
        const { orgId, groupId } = request.params
        await requireOrgMember(request, reply, orgId)
        const { uid } = request.user!

        const db = getFirestore()

        const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(uid)}/${groupId}`)
        const groupSnap = await groupRef.get()

        if (!groupSnap.exists) {
          return reply.code(404).send({ error: 'Group not found' })
        }

        const groupData = groupSnap.data()!

        if (!verifyGroupOwnership(groupData, orgId)) {
          return reply.code(403).send({
            error: 'Group does not belong to this organization',
          })
        }

        const parentsSnapshot = await db.collection(COLLECTIONS.GROUP_PARENTS(uid, groupId)).get()

        const deletePromises = parentsSnapshot.docs.map((doc) => doc.ref.delete())
        await Promise.all(deletePromises)

        await groupRef.delete()

        return {
          ok: true,
          message: 'Group deleted successfully',
        }
      } catch (error: any) {
        console.error('[GROUPS] Error deleting group:', error)
        return reply.code(500).send({
          error: 'Failed to delete group',
          details: error.message,
        })
      }
    }
  )

  // GET /orgs/:orgId/groups/:groupId/assignments — assignment history for a group
  fastify.get<{
    Params: { orgId: string; groupId: string }
    Querystring: { ownerId?: string }
  }>('/orgs/:orgId/groups/:groupId/assignments', async (request, reply) => {
    try {
      const { orgId, groupId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      // Specialist sees only their group's assignments; org_admin can pass ownerId to see a specialist's group
      const ownerId =
        member.role === 'org_admin' && (request.query as { ownerId?: string })?.ownerId
          ? (request.query as { ownerId: string }).ownerId
          : uid

      const db = getFirestore()
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
        // Index not ready — fall back to unordered
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

      const assignments = snap.docs.map((doc) => {
        const d = doc.data()
        return {
          id: doc.id,
          groupId: d.groupId,
          groupName: d.groupName,
          taskTitles: d.taskTitles || [],
          contentTaskIds: d.contentTaskIds || [],
          childCount: d.childCount || 0,
          tasksCreated: d.tasksCreated || 0,
          assignedBy: d.assignedBy,
          assignedAt: d.assignedAt?.toDate?.()?.toISOString() || null,
        }
      })

      return { ok: true, assignments, count: assignments.length }
    } catch (error: any) {
      console.error('[GROUPS] Error fetching assignment history:', error)
      return reply
        .code(500)
        .send({ error: 'Failed to fetch assignment history', details: error.message })
    }
  })

  // POST /orgs/:orgId/groups/:groupId/assign — assign existing content tasks to all children in a group
  fastify.post<{
    Params: { orgId: string; groupId: string }
    Querystring: { ownerId?: string }
    Body: z.infer<typeof assignGroupTasksSchema>
  }>('/orgs/:orgId/groups/:groupId/assign', async (request, reply) => {
    try {
      const { orgId, groupId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const ownerId =
        member.role === 'org_admin' && (request.query as any)?.ownerId
          ? (request.query as any).ownerId
          : uid
      const body = assignGroupTasksSchema.parse(request.body)

      const db = getFirestore()

      // Verify group exists (using resolved ownerId)
      const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(ownerId)}/${groupId}`)
      const groupSnap = await groupRef.get()
      if (!groupSnap.exists) return reply.code(404).send({ error: 'Group not found' })
      if (!verifyGroupOwnership(groupSnap.data()!, orgId)) {
        return reply.code(403).send({ error: 'Group does not belong to this organization' })
      }

      // Fetch content tasks from the org library
      const contentTaskDocs = await Promise.all(
        body.contentTaskIds.map((id) => db.doc(`organizations/${orgId}/contentTasks/${id}`).get())
      )
      const contentTasks = contentTaskDocs
        .filter((snap) => snap.exists)
        .map((snap) => ({ id: snap.id, ...snap.data()! }))

      if (contentTasks.length === 0) {
        return reply.code(400).send({ error: 'No valid content tasks found' })
      }

      // Collect all unique child IDs from group parents
      const parentsSnap = await db.collection(COLLECTIONS.GROUP_PARENTS(ownerId, groupId)).get()
      const childIdSet = new Set<string>()
      for (const parentDoc of parentsSnap.docs) {
        const childIds = (parentDoc.data().childIds as string[]) || []
        childIds.forEach((id) => childIdSet.add(id))
      }

      if (childIdSet.size === 0) {
        return reply.code(400).send({ error: 'No children in this group' })
      }

      const childIds = Array.from(childIdSet)
      const now = admin.firestore.Timestamp.fromDate(new Date())
      const BATCH_SIZE = 400
      let tasksCreated = 0

      const taskTitles = contentTasks.map((ct: any) => (ct as any).title || 'Untitled')
      const dueDateValue = body.dueDate ? new Date(body.dueDate) : null

      // Create assignment doc first to get its ID
      const assignmentRef = db.collection(`organizations/${orgId}/groupAssignments`).doc()
      const assignmentId = assignmentRef.id

      // For each child, create one task per content task
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
              createdBy: uid,
              groupId,
              contentTaskId: ct.id,
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

      // Save assignment doc with childIds for efficient submission queries
      await assignmentRef.set({
        groupId,
        groupName: groupSnap.data()!.name,
        ownerId,
        contentTaskIds: body.contentTaskIds,
        taskTitles,
        title: taskTitles[0] || 'Задание',
        childCount: childIds.length,
        childIds,
        tasksCreated,
        assignedBy: uid,
        assignedAt: now,
        status: 'active',
        dueDate: dueDateValue ? admin.firestore.Timestamp.fromDate(dueDateValue) : null,
      })

      // Update group document with last assignment metadata (for list display)
      await groupRef.update({
        lastAssignedAt: now,
        lastAssignedTaskTitles: taskTitles,
        updatedAt: now,
      })

      return {
        ok: true,
        tasksCreated,
        childCount: childIds.length,
        taskCount: contentTasks.length,
        message: `${contentTasks.length} task(s) assigned to ${childIds.length} children`,
      }
    } catch (error: any) {
      console.error('[GROUPS] Error assigning group tasks:', error)
      return reply.code(500).send({ error: 'Failed to assign group tasks', details: error.message })
    }
  })

  // ─── Assignment Detail ───────────────────────────────────────────────────────

  fastify.get<{
    Params: { orgId: string; groupId: string; assignmentId: string }
    Querystring: { ownerId?: string }
  }>('/orgs/:orgId/groups/:groupId/assignments/:assignmentId', async (request, reply) => {
    try {
      const { orgId, assignmentId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const db = getFirestore()

      const assignmentRef = db.doc(`organizations/${orgId}/groupAssignments/${assignmentId}`)
      const assignmentSnap = await assignmentRef.get()
      if (!assignmentSnap.exists) return reply.code(404).send({ error: 'Assignment not found' })

      const aData = assignmentSnap.data()!
      if (member.role === 'specialist' && aData.ownerId !== uid) {
        return reply.code(403).send({ error: 'You can only view your own assignments' })
      }

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
          } catch {
            /* index not ready — submission shows as pending */
          }

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

      return {
        ok: true,
        assignment: {
          id: assignmentId,
          groupId: aData.groupId,
          groupName: aData.groupName,
          ownerId: aData.ownerId,
          title: aData.title || (aData.taskTitles?.[0] ?? 'Задание'),
          description: aData.description ?? null,
          dueDate: aData.dueDate ?? null,
          taskTitles: aData.taskTitles || [],
          childCount: aData.childCount || childIds.length,
          status: aData.status || 'active',
          assignedAt: aData.assignedAt?.toDate?.()?.toISOString() ?? null,
          submissions,
        },
      }
    } catch (error: any) {
      console.error('[GROUPS] Error fetching assignment detail:', error)
      return reply
        .code(500)
        .send({ error: 'Failed to fetch assignment detail', details: error.message })
    }
  })

  fastify.patch<{
    Params: { orgId: string; groupId: string; assignmentId: string }
    Body: z.infer<typeof updateAssignmentSchema>
  }>('/orgs/:orgId/groups/:groupId/assignments/:assignmentId', async (request, reply) => {
    try {
      const { orgId, assignmentId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const body = updateAssignmentSchema.parse(request.body)
      const db = getFirestore()

      const assignmentRef = db.doc(`organizations/${orgId}/groupAssignments/${assignmentId}`)
      const assignmentSnap = await assignmentRef.get()
      if (!assignmentSnap.exists) return reply.code(404).send({ error: 'Assignment not found' })

      const aData = assignmentSnap.data()!
      if (member.role === 'specialist' && aData.ownerId !== uid) {
        return reply.code(403).send({ error: 'You can only update your own assignments' })
      }

      const updates: Record<string, any> = {
        updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
      }
      if (body.status) updates.status = body.status
      if (body.dueDate !== undefined) updates.dueDate = body.dueDate
      if (body.title) updates.title = body.title
      if (body.description !== undefined) updates.description = body.description

      await assignmentRef.update(updates)
      return { ok: true }
    } catch (error: any) {
      return reply.code(500).send({ error: 'Failed to update assignment', details: error.message })
    }
  })

  fastify.delete<{ Params: { orgId: string; groupId: string; assignmentId: string } }>(
    '/orgs/:orgId/groups/:groupId/assignments/:assignmentId',
    async (request, reply) => {
      try {
        const { orgId, assignmentId } = request.params
        const member = await requireOrgMember(request, reply, orgId)
        const { uid } = request.user!
        const db = getFirestore()

        const assignmentRef = db.doc(`organizations/${orgId}/groupAssignments/${assignmentId}`)
        const assignmentSnap = await assignmentRef.get()
        if (!assignmentSnap.exists) return reply.code(404).send({ error: 'Assignment not found' })

        const aData = assignmentSnap.data()!
        if (member.role === 'specialist' && aData.ownerId !== uid) {
          return reply.code(403).send({ error: 'You can only delete your own assignments' })
        }

        // Delete comments subcollection
        const commentsSnap = await db
          .collection(`organizations/${orgId}/groupAssignments/${assignmentId}/comments`)
          .get()
        if (commentsSnap.docs.length > 0) {
          const commentBatch = db.batch()
          commentsSnap.docs.forEach((doc) => commentBatch.delete(doc.ref))
          await commentBatch.commit()
        }

        // Delete individual child tasks that belong to this assignment
        let childIds: string[] = aData.childIds || []

        // Fallback for old assignments created before childIds tracking:
        // query all children in the org to find tasks with matching groupAssignmentId
        if (childIds.length === 0) {
          try {
            const orgChildrenSnap = await db.collection(`organizations/${orgId}/children`).get()
            childIds = orgChildrenSnap.docs.map((d) => d.id)
          } catch {
            // ignore — will skip task deletion
          }
        }

        if (childIds.length > 0) {
          const BATCH_SIZE = 400
          for (let i = 0; i < childIds.length; i += BATCH_SIZE) {
            const chunk = childIds.slice(i, i + BATCH_SIZE)
            const taskBatch = db.batch()
            for (const childId of chunk) {
              try {
                const tasksSnap = await db
                  .collection(`children/${childId}/tasks`)
                  .where('groupAssignmentId', '==', assignmentId)
                  .get()
                tasksSnap.docs.forEach((doc) => taskBatch.delete(doc.ref))
              } catch {
                // skip if collection query fails for this child
              }
            }
            await taskBatch.commit()
          }
        }

        await assignmentRef.delete()
        return { ok: true }
      } catch (error: any) {
        return reply
          .code(500)
          .send({ error: 'Failed to delete assignment', details: error.message })
      }
    }
  )

  // ─── Comments ────────────────────────────────────────────────────────────────

  fastify.get<{ Params: { orgId: string; groupId: string; assignmentId: string } }>(
    '/orgs/:orgId/groups/:groupId/assignments/:assignmentId/comments',
    async (request, reply) => {
      try {
        const { orgId, assignmentId } = request.params
        await requireOrgMember(request, reply, orgId)
        const db = getFirestore()

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

        const comments = snap.docs.map((doc) => {
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
        return { ok: true, comments }
      } catch (error: any) {
        return reply.code(500).send({ error: 'Failed to fetch comments', details: error.message })
      }
    }
  )

  fastify.post<{
    Params: { orgId: string; groupId: string; assignmentId: string }
    Body: z.infer<typeof addCommentSchema>
  }>('/orgs/:orgId/groups/:groupId/assignments/:assignmentId/comments', async (request, reply) => {
    try {
      const { orgId, assignmentId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const body = addCommentSchema.parse(request.body)
      const db = getFirestore()
      const now = admin.firestore.Timestamp.fromDate(new Date())

      let authorName = uid.slice(0, 8)
      try {
        const snap = await db.doc(`specialists/${uid}`).get()
        if (snap.exists) {
          const d = snap.data()!
          authorName = d.fullName || d.name || authorName
        }
      } catch {
        /* specialist lookup optional */
      }

      const commentRef = db
        .collection(`organizations/${orgId}/groupAssignments/${assignmentId}/comments`)
        .doc()
      await commentRef.set({
        authorId: uid,
        authorName,
        authorRole: member.role,
        text: body.text,
        createdAt: now,
      })

      return {
        ok: true,
        comment: {
          id: commentRef.id,
          authorId: uid,
          authorName,
          authorRole: member.role,
          text: body.text,
          createdAt: now.toDate().toISOString(),
        },
      }
    } catch (error: any) {
      return reply.code(500).send({ error: 'Failed to add comment', details: error.message })
    }
  })

  // ─── Submission Review ───────────────────────────────────────────────────────

  fastify.patch<{
    Params: { orgId: string; groupId: string; assignmentId: string; childId: string }
    Body: z.infer<typeof reviewSubmissionSchema>
  }>(
    '/orgs/:orgId/groups/:groupId/assignments/:assignmentId/submissions/:childId',
    async (request, reply) => {
      try {
        const { orgId, assignmentId, childId } = request.params
        const member = await requireOrgMember(request, reply, orgId)
        const { uid } = request.user!
        const body = reviewSubmissionSchema.parse(request.body)
        const db = getFirestore()
        const now = admin.firestore.Timestamp.fromDate(new Date())

        // Verify specialist owns this assignment
        const assignmentSnap = await db
          .doc(`organizations/${orgId}/groupAssignments/${assignmentId}`)
          .get()
        if (!assignmentSnap.exists) return reply.code(404).send({ error: 'Assignment not found' })
        const aData = assignmentSnap.data()!
        if (member.role === 'specialist' && aData.ownerId !== uid) {
          return reply
            .code(403)
            .send({ error: 'You can only review submissions for your own assignments' })
        }

        // Find the child's task for this assignment
        const tasksSnap = await db
          .collection(`children/${childId}/tasks`)
          .where('groupAssignmentId', '==', assignmentId)
          .limit(1)
          .get()

        if (tasksSnap.empty) {
          return reply.code(404).send({ error: 'Task not found for this child and assignment' })
        }

        await tasksSnap.docs[0].ref.update({
          grade: body.grade,
          feedback: body.feedback ?? null,
          feedbackBy: uid,
          feedbackAt: now,
          status: body.grade === 'approved' ? 'completed' : 'pending',
          updatedAt: now,
        })

        return { ok: true, childId, grade: body.grade }
      } catch (error: any) {
        return reply
          .code(500)
          .send({ error: 'Failed to review submission', details: error.message })
      }
    }
  )
}
