import admin from 'firebase-admin';
import { z } from 'zod';
import { getFirestore } from '../infrastructure/database/firebase.js';
import { requireOrgMember } from '../plugins/rbac.js';
const COLLECTIONS = {
    ORG_CHILDREN: (orgId) => `organizations/${orgId}/children`,
    ORG_MEMBERS: (orgId) => `organizations/${orgId}/members`,
};
const assignChildSchema = z.object({
    childId: z.string().min(1),
    specialistId: z.string().min(1),
});
const unassignChildSchema = z.object({
    childId: z.string().min(1),
});
async function verifyChildAssignment(db, orgId, childId) {
    const childAssignmentRef = db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${childId}`);
    const childAssignmentSnap = await childAssignmentRef.get();
    return childAssignmentSnap.exists && childAssignmentSnap.data()?.assigned === true;
}
async function verifySpecialistMembership(db, orgId, specialistId) {
    const specialistMemberRef = db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${specialistId}`);
    const specialistMemberSnap = await specialistMemberRef.get();
    if (!specialistMemberSnap.exists) {
        return { isValid: false, isActive: false };
    }
    const specialistMemberData = specialistMemberSnap.data();
    const isValid = specialistMemberData?.role === 'specialist';
    const isActive = specialistMemberData?.status === 'active';
    return { isValid, isActive };
}
function buildAssignmentUpdate(specialistId, now) {
    return {
        assignedSpecialistId: specialistId,
        assignedAt: admin.firestore.Timestamp.fromDate(now),
    };
}
export const assignmentsRoute = async (fastify) => {
    fastify.post('/orgs/:orgId/assignments', async (request, reply) => {
        try {
            const { orgId } = request.params;
            const member = await requireOrgMember(request, reply, orgId);
            if (member.role !== 'org_admin') {
                return reply.code(403).send({
                    error: 'Only organization admins can assign children to specialists',
                });
            }
            const db = getFirestore();
            const body = assignChildSchema.parse(request.body);
            const { childId, specialistId } = body;
            const now = new Date();
            const isChildAssigned = await verifyChildAssignment(db, orgId, childId);
            if (!isChildAssigned) {
                return reply.code(404).send({
                    error: 'Child is not assigned to this organization',
                });
            }
            const { isValid, isActive } = await verifySpecialistMembership(db, orgId, specialistId);
            if (!isValid) {
                return reply.code(404).send({
                    error: 'Specialist is not a member of this organization',
                });
            }
            if (!isActive) {
                return reply.code(400).send({
                    error: 'Specialist account is not active',
                });
            }
            const childAssignmentRef = db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${childId}`);
            await childAssignmentRef.update(buildAssignmentUpdate(specialistId, now));
            return {
                ok: true,
                message: 'Child assigned to specialist',
                childId,
                specialistId,
            };
        }
        catch (error) {
            console.error('[ASSIGNMENTS] Error assigning child:', error);
            return reply.code(500).send({
                error: 'Failed to assign child to specialist',
                details: error.message,
            });
        }
    });
    fastify.delete('/orgs/:orgId/assignments', async (request, reply) => {
        try {
            const { orgId } = request.params;
            const member = await requireOrgMember(request, reply, orgId);
            if (member.role !== 'org_admin') {
                return reply.code(403).send({
                    error: 'Only organization admins can unassign children',
                });
            }
            const db = getFirestore();
            const body = unassignChildSchema.parse(request.body);
            const { childId } = body;
            const isChildAssigned = await verifyChildAssignment(db, orgId, childId);
            if (!isChildAssigned) {
                return reply.code(404).send({
                    error: 'Child is not assigned to this organization',
                });
            }
            const childAssignmentRef = db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${childId}`);
            await childAssignmentRef.update({
                assignedSpecialistId: admin.firestore.FieldValue.delete(),
            });
            return {
                ok: true,
                message: 'Child unassigned from specialist',
                childId,
            };
        }
        catch (error) {
            console.error('[ASSIGNMENTS] Error unassigning child:', error);
            return reply.code(500).send({
                error: 'Failed to unassign child from specialist',
                details: error.message,
            });
        }
    });
};
//# sourceMappingURL=assignments.js.map