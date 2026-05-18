import { FastifyRequest, FastifyReply } from 'fastify'
import { getOrgMemberRef, getOrgChildRef } from '../../infrastructure/database/collections.js'

export async function requireChildAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  childId: string
): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' }) as never
  }

  const { uid } = request.user

  const memberRef = getOrgMemberRef(orgId, uid)
  const memberSnap = await memberRef.get()

  if (!memberSnap.exists) {
    return reply.code(403).send({ error: 'Not a member of this organization' }) as never
  }

  const memberData = memberSnap.data()
  if (memberData?.status !== 'active') {
    return reply.code(403).send({ error: 'Member account is not active' }) as never
  }

  const role = memberData.role || 'specialist'

  const childAssignmentRef = getOrgChildRef(orgId, childId)
  const assignmentSnap = await childAssignmentRef.get()

  if (!assignmentSnap.exists || assignmentSnap.data()?.assigned !== true) {
    return reply.code(404).send({ error: 'Child not assigned to this organization' }) as never
  }

  if (role === 'org_admin') {
    return
  }

  if (role === 'specialist') {
    const assignmentData = assignmentSnap.data()
    const assignedSpecialistId = assignmentData?.assignedSpecialistId

    if (assignedSpecialistId && assignedSpecialistId !== uid) {
      return reply.code(403).send({ error: 'Child is not assigned to you' }) as never
    }

    if (!assignedSpecialistId) {
      return reply.code(403).send({
        error: 'Child is not assigned to any specialist. Please contact your organization admin.',
      }) as never
    }

    return
  }

  return reply.code(403).send({ error: 'Invalid role' }) as never
}
