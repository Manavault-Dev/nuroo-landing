import { FastifyRequest, FastifyReply } from 'fastify'
import { getFirestore } from '../database/firebase.js'
import { config } from '../../config/index.js'
import type { OrgMember } from '../../shared/types/domain.js'

function normalizeOrgRole(role: unknown): OrgMember['role'] {
  return role === 'org_admin' || role === 'admin' ? 'org_admin' : 'specialist'
}

async function recoverIndexedMembership(
  db: ReturnType<typeof getFirestore>,
  orgId: string,
  uid: string
): Promise<OrgMember | null> {
  const now = new Date()
  const memberRef = db.doc(`organizations/${orgId}/members/${uid}`)

  // Run all recovery lookups in parallel
  const [orgSnap, userOrgSnap, specialistSnap] = await Promise.all([
    db.doc(`organizations/${orgId}`).get(),
    db.doc(`specialists/${uid}/organizations/${orgId}`).get(),
    db.doc(`specialists/${uid}`).get(),
  ])

  const orgData = orgSnap.exists ? orgSnap.data() : null

  // Check 1: user created the org
  if (orgData?.createdBy === uid) {
    await memberRef.set(
      { uid, role: 'org_admin', status: 'active', addedAt: now, updatedAt: now },
      { merge: true }
    )
    return { uid, role: 'org_admin', status: 'active', addedAt: now }
  }

  // Check 2: specialists/{uid}.orgId points to this org (primary specialist = owner)
  if (specialistSnap.exists && specialistSnap.data()?.orgId === orgId) {
    await memberRef.set(
      { uid, role: 'org_admin', status: 'active', addedAt: now, updatedAt: now },
      { merge: true }
    )
    return { uid, role: 'org_admin', status: 'active', addedAt: now }
  }

  // Check 3: user has an active entry in specialists/{uid}/organizations/{orgId}
  const userOrgData = userOrgSnap.exists ? userOrgSnap.data() : null
  if (userOrgData?.status === 'active') {
    const role = normalizeOrgRole(userOrgData.role)
    await memberRef.set(
      { uid, role, status: 'active', addedAt: now, updatedAt: now },
      { merge: true }
    )
    return { uid, role, status: 'active', addedAt: now }
  }

  return null
}

export async function requireOrgMember(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string
): Promise<OrgMember> {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' }) as never
  }

  const db = getFirestore()
  const { uid } = request.user

  if (request.user.claims?.superAdmin === true) {
    return {
      uid,
      role: 'org_admin',
      status: 'active',
      addedAt: new Date(),
    }
  }

  const memberRef = db.doc(`organizations/${orgId}/members/${uid}`)
  const memberSnap = await memberRef.get()

  if (!memberSnap.exists) {
    const recoveredMember = await recoverIndexedMembership(db, orgId, uid)
    if (recoveredMember) return recoveredMember

    request.log.warn(
      { orgId, uid },
      '[ORG_MEMBER_FORBIDDEN] User is not indexed as an organization member'
    )
    return reply.code(403).send({ error: 'Not a member of this organization' }) as never
  }

  const data = memberSnap.data()
  if (data?.status !== 'active') {
    const recoveredMember = await recoverIndexedMembership(db, orgId, uid)
    if (recoveredMember) return recoveredMember

    return reply.code(403).send({ error: 'Member account is not active' }) as never
  }

  const role = normalizeOrgRole(data.role)
  if (role !== 'org_admin') {
    const recoveredMember = await recoverIndexedMembership(db, orgId, uid)
    if (recoveredMember?.role === 'org_admin') return recoveredMember
  }

  return {
    uid: request.user.uid,
    role,
    status: data.status,
    addedAt: data.addedAt?.toDate() || new Date(),
  }
}

export async function requireChildAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  childId: string
): Promise<string> {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' }) as never
  }

  const db = getFirestore()
  const { uid } = request.user

  const memberRef = db.doc(`organizations/${orgId}/members/${uid}`)
  const memberSnap = await memberRef.get()

  if (!memberSnap.exists) {
    return reply.code(403).send({ error: 'Not a member of this organization' }) as never
  }

  const memberData = memberSnap.data()
  if (memberData?.status !== 'active') {
    return reply.code(403).send({ error: 'Member account is not active' }) as never
  }

  const role = normalizeOrgRole(memberData.role)

  const orgChildrenRef = db.collection(`organizations/${orgId}/children`)
  const directAssignmentRef = orgChildrenRef.doc(childId)
  const directAssignmentSnap = await directAssignmentRef.get()

  let resolvedChildId = childId
  let assignmentSnap = directAssignmentSnap

  if (!assignmentSnap.exists) {
    const byParentSnap = await orgChildrenRef
      .where('parentUserId', '==', childId)
      .where('assigned', '==', true)
      .limit(2)
      .get()

    if (byParentSnap.empty) {
      return reply.code(404).send({ error: 'Child not assigned to this organization' }) as never
    }
    if (byParentSnap.size > 1) {
      return reply.code(409).send({
        error: 'Multiple children found for this identifier. Please use a childId.',
      }) as never
    }

    resolvedChildId = byParentSnap.docs[0].id
    assignmentSnap = byParentSnap.docs[0]
  }

  if (role === 'org_admin') {
    if (!assignmentSnap.exists || assignmentSnap.data()?.assigned !== true) {
      return reply.code(404).send({ error: 'Child not assigned to this organization' }) as never
    }

    return resolvedChildId
  }

  if (role === 'specialist') {
    if (!assignmentSnap.exists) {
      return reply.code(404).send({ error: 'Child not assigned to this organization' }) as never
    }

    const assignmentData = assignmentSnap.data()
    if (assignmentData?.assigned !== true) {
      return reply.code(403).send({ error: 'Child assignment is inactive' }) as never
    }

    const assignedSpecialistId = assignmentData.assignedSpecialistId
    if (assignedSpecialistId === uid) {
      return resolvedChildId
    }

    const groupsSnap = await db
      .collection(`specialists/${uid}/groups`)
      .where('orgId', '==', orgId)
      .get()

    if (groupsSnap.empty) {
      return reply.code(403).send({ error: 'Child is not assigned to you' }) as never
    }

    // Fetch all group-parent subcollections in parallel instead of sequentially
    const allParentsSnaps = await Promise.all(
      groupsSnap.docs.map((groupDoc) =>
        db.collection(`specialists/${uid}/groups/${groupDoc.id}/parents`).get()
      )
    )

    const hasAccess = allParentsSnaps.some((parentsSnap) =>
      parentsSnap.docs.some((parentDoc) => {
        const childIds = (parentDoc.data().childIds as string[]) || []
        return childIds.includes(resolvedChildId)
      })
    )

    if (hasAccess) return resolvedChildId

    return reply.code(403).send({ error: 'Child is not assigned to you' }) as never
  }

  return reply.code(403).send({ error: 'Invalid role' }) as never
}

export async function requireChildAssigned(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  childId: string
): Promise<string> {
  return requireChildAccess(request, reply, orgId, childId)
}

export async function requireOrgAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string
): Promise<OrgMember> {
  const member = await requireOrgMember(request, reply, orgId)
  if (member.role !== 'org_admin') {
    return reply
      .code(403)
      .send({ error: 'Only organization admins can perform this action' }) as never
  }
  return member
}

export async function requirePlatformAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const headerKey = request.headers['x-platform-admin-key']
  if (config.PLATFORM_ADMIN_SECRET && headerKey === config.PLATFORM_ADMIN_SECRET) return

  const claims = request.user?.claims as Record<string, unknown> | undefined
  if (claims?.platform_admin === true) return

  return reply
    .code(403)
    .send({ error: 'Platform admin access required', code: 'PLATFORM_ADMIN_REQUIRED' }) as never
}
