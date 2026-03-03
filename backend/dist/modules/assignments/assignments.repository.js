import admin from 'firebase-admin';
import { getOrgChildRef, getOrgMemberRef } from '../../infrastructure/database/collections.js';
import { nowTimestamp } from '../../shared/utils/timestamp.js';
export async function findChildAssignment(orgId, childId) {
    const childAssignmentRef = getOrgChildRef(orgId, childId);
    const snap = await childAssignmentRef.get();
    return snap.exists ? { ref: childAssignmentRef, data: snap.data() } : null;
}
export async function findMember(orgId, uid) {
    const memberRef = getOrgMemberRef(orgId, uid);
    const snap = await memberRef.get();
    return snap.exists ? snap.data() : null;
}
export async function assignChildToSpecialist(orgId, childId, specialistId) {
    const childAssignmentRef = getOrgChildRef(orgId, childId);
    await childAssignmentRef.update({
        assignedSpecialistId: specialistId,
        assignedAt: nowTimestamp(),
    });
    console.log(`[ASSIGNMENTS] Child ${childId} assigned to specialist ${specialistId} in org ${orgId}`);
}
export async function unassignChildFromSpecialist(orgId, childId) {
    const childAssignmentRef = getOrgChildRef(orgId, childId);
    await childAssignmentRef.update({
        assignedSpecialistId: admin.firestore.FieldValue.delete(),
    });
    console.log(`[ASSIGNMENTS] Child ${childId} unassigned from specialist in org ${orgId}`);
}
//# sourceMappingURL=assignments.repository.js.map