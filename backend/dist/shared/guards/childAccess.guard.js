import { getOrgMemberRef, getOrgChildRef } from '../../infrastructure/database/collections.js';
/**
 * Check if user can access a child
 * Rules:
 * - Org Admin: Can access ALL children in their org
 * - Specialist: Can only access children assigned to them (assignedSpecialistId === their uid)
 */
export async function requireChildAccess(request, reply, orgId, childId) {
    if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
    }
    const { uid } = request.user;
    // First check membership
    const memberRef = getOrgMemberRef(orgId, uid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
        return reply.code(403).send({ error: 'Not a member of this organization' });
    }
    const memberData = memberSnap.data();
    if (memberData?.status !== 'active') {
        return reply.code(403).send({ error: 'Member account is not active' });
    }
    const role = memberData.role || 'specialist';
    // Get child assignment
    const childAssignmentRef = getOrgChildRef(orgId, childId);
    const assignmentSnap = await childAssignmentRef.get();
    if (!assignmentSnap.exists || assignmentSnap.data()?.assigned !== true) {
        return reply.code(404).send({ error: 'Child not assigned to this organization' });
    }
    // Org Admin can access all children
    if (role === 'org_admin') {
        return;
    }
    // Specialist: Check if child is assigned to them
    if (role === 'specialist') {
        const assignmentData = assignmentSnap.data();
        const assignedSpecialistId = assignmentData?.assignedSpecialistId;
        // Check if assigned to this specialist
        if (assignedSpecialistId && assignedSpecialistId !== uid) {
            return reply.code(403).send({ error: 'Child is not assigned to you' });
        }
        // If no assignedSpecialistId, only Org Admin can access
        if (!assignedSpecialistId) {
            return reply.code(403).send({
                error: 'Child is not assigned to any specialist. Please contact your organization admin.',
            });
        }
        return;
    }
    // Unknown role
    return reply.code(403).send({ error: 'Invalid role' });
}
//# sourceMappingURL=childAccess.guard.js.map