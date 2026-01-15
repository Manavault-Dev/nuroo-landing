import { FastifyRequest, FastifyReply } from 'fastify'
import { getFirestore } from '../firebaseAdmin.js'
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
  const memberRef = db.doc(`organizations/${orgId}/members/${request.user.uid}`)
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

export async function requireChildAssigned(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  childId: string
): Promise<void> {
  const db = getFirestore()
  const childAssignmentRef = db.doc(`organizations/${orgId}/children/${childId}`)
  const assignmentSnap = await childAssignmentRef.get()

  if (!assignmentSnap.exists) {
    return reply.code(404).send({ error: 'Child not assigned to this organization' }) as never
  }

  const data = assignmentSnap.data()
  if (data?.assigned !== true) {
    return reply.code(403).send({ error: 'Child assignment is inactive' }) as never
  }
}
