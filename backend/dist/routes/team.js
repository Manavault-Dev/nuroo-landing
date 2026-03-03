import admin from 'firebase-admin';
import { z } from 'zod';
import { getFirestore } from '../infrastructure/database/firebase.js';
import { requireOrgMember } from '../plugins/rbac.js';
const COLLECTIONS = {
    ORG_MEMBERS: (orgId) => `organizations/${orgId}/members`,
    SPECIALISTS: 'specialists',
};
const updateMemberRoleSchema = z.object({
    role: z.enum(['org_admin', 'specialist']),
});
function isActiveMember(memberData) {
    return !memberData.status || memberData.status === 'active';
}
function normalizeRole(role) {
    return role === 'org_admin' ? 'admin' : 'specialist';
}
function extractJoinedAt(memberData) {
    return memberData.joinedAt?.toDate?.() || memberData.addedAt?.toDate?.() || new Date();
}
async function getSpecialistProfile(db, specialistUid) {
    const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${specialistUid}`);
    const specialistSnap = await specialistRef.get();
    return specialistSnap.exists ? specialistSnap.data() || null : null;
}
function transformTeamMember(doc, specialistData) {
    const memberData = doc.data();
    const specialistUid = doc.id;
    return {
        uid: specialistUid,
        email: specialistData?.email || '',
        name: specialistData?.fullName || specialistData?.name || 'Unknown',
        role: normalizeRole(memberData.role),
        joinedAt: extractJoinedAt(memberData),
    };
}
export const teamRoute = async (fastify) => {
    fastify.get('/orgs/:orgId/team', async (request, reply) => {
        try {
            const { orgId } = request.params;
            const member = await requireOrgMember(request, reply, orgId);
            if (member.role !== 'org_admin') {
                return reply.code(403).send({
                    error: 'Only organization admins can view team members',
                });
            }
            const db = getFirestore();
            const membersSnapshot = await db.collection(COLLECTIONS.ORG_MEMBERS(orgId)).get();
            const activeMembers = membersSnapshot.docs.filter((doc) => isActiveMember(doc.data()));
            const teamMembers = await Promise.all(activeMembers.map(async (doc) => {
                const specialistUid = doc.id;
                const specialistData = await getSpecialistProfile(db, specialistUid);
                return transformTeamMember(doc, specialistData);
            }));
            return teamMembers;
        }
        catch (error) {
            const err = error;
            console.error('[TEAM] Error fetching team members:', error);
            return reply.code(500).send({
                error: 'Failed to fetch team members',
                message: err.message || 'Unknown error',
                details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            });
        }
    });
    // PATCH /orgs/:orgId/members/:uid - Update member role (org_admin only)
    fastify.patch('/orgs/:orgId/members/:uid', async (request, reply) => {
        try {
            const { orgId, uid: targetUid } = request.params;
            const member = await requireOrgMember(request, reply, orgId);
            if (member.role !== 'org_admin') {
                return reply.code(403).send({ error: 'Only organization admins can update member roles' });
            }
            const currentUid = request.user.uid;
            if (targetUid === currentUid) {
                return reply.code(400).send({
                    error: 'Cannot change your own role. Transfer admin rights to another member first.',
                });
            }
            const body = updateMemberRoleSchema.parse(request.body);
            const db = getFirestore();
            const memberRef = db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${targetUid}`);
            const memberSnap = await memberRef.get();
            if (!memberSnap.exists) {
                return reply.code(404).send({ error: 'Member not found' });
            }
            await memberRef.update({
                role: body.role,
                updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
            });
            // Update specialist profile orgId/role
            const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${targetUid}`);
            const specialistSnap = await specialistRef.get();
            if (specialistSnap.exists) {
                await specialistRef.update({
                    orgId,
                    role: body.role,
                    updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
                });
            }
            return { ok: true, role: body.role };
        }
        catch (error) {
            const err = error;
            console.error('[TEAM] Error updating member role:', error);
            return reply.code(500).send({
                error: 'Failed to update member role',
                message: err.message || 'Unknown error',
            });
        }
    });
    // DELETE /orgs/:orgId/members/:uid - Remove member (org_admin only)
    fastify.delete('/orgs/:orgId/members/:uid', async (request, reply) => {
        try {
            const { orgId, uid: targetUid } = request.params;
            const member = await requireOrgMember(request, reply, orgId);
            if (member.role !== 'org_admin') {
                return reply.code(403).send({ error: 'Only organization admins can remove members' });
            }
            const currentUid = request.user.uid;
            if (targetUid === currentUid) {
                return reply.code(400).send({
                    error: 'Cannot remove yourself. Transfer admin rights to another member first.',
                });
            }
            const db = getFirestore();
            const memberRef = db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${targetUid}`);
            const memberSnap = await memberRef.get();
            if (!memberSnap.exists) {
                return reply.code(404).send({ error: 'Member not found' });
            }
            // Deactivate instead of delete to preserve history
            await memberRef.update({
                status: 'inactive',
                removedAt: admin.firestore.Timestamp.fromDate(new Date()),
                removedBy: currentUid,
            });
            // Clear org from specialist profile
            const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${targetUid}`);
            const specialistSnap = await specialistRef.get();
            if (specialistSnap.exists) {
                await specialistRef.update({
                    orgId: admin.firestore.FieldValue.delete(),
                    role: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
                });
            }
            return { ok: true };
        }
        catch (error) {
            const err = error;
            console.error('[TEAM] Error removing member:', error);
            return reply.code(500).send({
                error: 'Failed to remove member',
                message: err.message || 'Unknown error',
            });
        }
    });
};
//# sourceMappingURL=team.js.map