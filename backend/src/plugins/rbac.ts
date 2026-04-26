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

  const role = memberData.role || 'specialist'

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

    for (const groupDoc of groupsSnap.docs) {
      const parentsSnap = await db
        .collection(`specialists/${uid}/groups/${groupDoc.id}/parents`)
        .get()
      for (const parentDoc of parentsSnap.docs) {
        const childIds = (parentDoc.data().childIds as string[]) || []
        if (childIds.includes(resolvedChildId)) {
          return resolvedChildId
        }
      }
    }

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
