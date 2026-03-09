import { FastifyRequest, FastifyReply } from 'fastify'
import { getFirestore } from '../infrastructure/database/firebase.js'
import type { OrgMember } from '../types.js'

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

  const memberRef = db.doc(`organizations/${orgId}/members/${uid}`)
  const memberSnap = await memberRef.get()

  if (!memberSnap.exists) {
    return reply.code(403).send({ error: 'Not a member of this organization' }) as never
  }

  const data = memberSnap.data()
  if (data?.status !== 'active') {
    return reply.code(403).send({ error: 'Member account is not active' }) as never
  }

  return {
    uid: request.user.uid,
    role: data.role || 'specialist',
    status: data.status,
    addedAt: data.addedAt?.toDate() || new Date(),
  }
}

/**
 * Check if user can access a child
 * Rules:
 * - Org Admin: Can access ALL children in their org
 * - Specialist: Can access children assigned to them directly (assignedSpecialistId === their uid)
 *              OR children that belong to any of their groups in this org
 */
export async function requireChildAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  childId: string
): Promise<void> {
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

  const role = memberData.role || 'specialist'

  // Org Admin can access all children
  if (role === 'org_admin') {
    const childAssignmentRef = db.doc(`organizations/${orgId}/children/${childId}`)
    const assignmentSnap = await childAssignmentRef.get()

    if (!assignmentSnap.exists || assignmentSnap.data()?.assigned !== true) {
      return reply.code(404).send({ error: 'Child not assigned to this organization' }) as never
    }

    return // Org Admin has access
  }

  // Specialist: Check direct assignment or group membership
  if (role === 'specialist') {
    const childAssignmentRef = db.doc(`organizations/${orgId}/children/${childId}`)
    const assignmentSnap = await childAssignmentRef.get()

    if (!assignmentSnap.exists) {
      return reply.code(404).send({ error: 'Child not assigned to this organization' }) as never
    }

    const assignmentData = assignmentSnap.data()
    if (assignmentData?.assigned !== true) {
      return reply.code(403).send({ error: 'Child assignment is inactive' }) as never
    }

    // 1. Direct assignment
    const assignedSpecialistId = assignmentData.assignedSpecialistId
    if (assignedSpecialistId === uid) {
      return // Has direct access
    }

    // 2. Group membership — check if this child is in any of the specialist's groups
    const groupsSnap = await db
      .collection(`specialists/${uid}/groups`)
      .where('orgId', '==', orgId)
      .get()

    for (const groupDoc of groupsSnap.docs) {
      const parentsSnap = await db
        .collection(`specialists/${uid}/groups/${groupDoc.id}/parents`)
        .get()
      for (const parentDoc of parentsSnap.docs) {
        const childIds = (parentDoc.data().childIds as string[]) || []
        if (childIds.includes(childId)) {
          return // Has access via group
        }
      }
    }

    return reply.code(403).send({ error: 'Child is not assigned to you' }) as never
  }

  // Unknown role
  return reply.code(403).send({ error: 'Invalid role' }) as never
}

/**
 * @deprecated Use requireChildAccess instead
 * Kept for backward compatibility
 */
export async function requireChildAssigned(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  childId: string
): Promise<void> {
  return requireChildAccess(request, reply, orgId, childId)
}
