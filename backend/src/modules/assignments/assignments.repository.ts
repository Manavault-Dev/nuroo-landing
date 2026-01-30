import admin from 'firebase-admin'
import { getOrgChildRef, getOrgMemberRef } from '../../infrastructure/database/collections.js'
import { nowTimestamp } from '../../shared/utils/timestamp.js'

export async function findChildAssignment(orgId: string, childId: string) {
  const childAssignmentRef = getOrgChildRef(orgId, childId)
  const snap = await childAssignmentRef.get()
  return snap.exists ? { ref: childAssignmentRef, data: snap.data()! } : null
}

export async function findMember(orgId: string, uid: string) {
  const memberRef = getOrgMemberRef(orgId, uid)
  const snap = await memberRef.get()
  return snap.exists ? snap.data() : null
}

export async function assignChildToSpecialist(
  orgId: string,
  childId: string,
  specialistId: string
) {
  const childAssignmentRef = getOrgChildRef(orgId, childId)
  await childAssignmentRef.update({
    assignedSpecialistId: specialistId,
    assignedAt: nowTimestamp(),
  })

  console.log(
    `[ASSIGNMENTS] Child ${childId} assigned to specialist ${specialistId} in org ${orgId}`
  )
}

export async function unassignChildFromSpecialist(orgId: string, childId: string) {
  const childAssignmentRef = getOrgChildRef(orgId, childId)
  await childAssignmentRef.update({
    assignedSpecialistId: admin.firestore.FieldValue.delete(),
  })

  console.log(`[ASSIGNMENTS] Child ${childId} unassigned from specialist in org ${orgId}`)
}
