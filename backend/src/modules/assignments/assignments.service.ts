import {
  findChildAssignment,
  findMember,
  assignChildToSpecialist,
  unassignChildFromSpecialist,
} from './assignments.repository.js'
import type { AssignChildInput, UnassignChildInput } from './assignments.schema.js'

export async function assignChild(orgId: string, input: AssignChildInput) {
  const { childId, specialistId } = input

  // Verify child is assigned to org
  const childAssignment = await findChildAssignment(orgId, childId)

  if (!childAssignment || childAssignment.data?.assigned !== true) {
    return { error: 'Child is not assigned to this organization', code: 404 }
  }

  // Verify specialist is a member of the org
  const specialistMember = await findMember(orgId, specialistId)

  if (!specialistMember) {
    return { error: 'Specialist is not a member of this organization', code: 404 }
  }

  if (specialistMember.role !== 'specialist') {
    return { error: 'User is not a specialist', code: 400 }
  }

  if (specialistMember.status !== 'active') {
    return { error: 'Specialist account is not active', code: 400 }
  }

  await assignChildToSpecialist(orgId, childId, specialistId)

  return {
    ok: true,
    message: 'Child assigned to specialist',
    childId,
    specialistId,
  }
}

export async function unassignChild(orgId: string, input: UnassignChildInput) {
  const { childId } = input

  // Verify child is assigned to org
  const childAssignment = await findChildAssignment(orgId, childId)

  if (!childAssignment || childAssignment.data?.assigned !== true) {
    return { error: 'Child is not assigned to this organization', code: 404 }
  }

  await unassignChildFromSpecialist(orgId, childId)

  return {
    ok: true,
    message: 'Child unassigned from specialist',
    childId,
  }
}
