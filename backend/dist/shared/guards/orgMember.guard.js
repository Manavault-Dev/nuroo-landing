import { getOrgMemberRef } from '../../infrastructure/database/collections.js';
export async function requireOrgMember(request, reply, orgId) {
    if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
    }
    const memberRef = getOrgMemberRef(orgId, request.user.uid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
        return reply.code(403).send({ error: 'Not a member of this organization' });
    }
    const data = memberSnap.data();
    if (data?.status !== 'active') {
        return reply.code(403).send({ error: 'Member account is not active' });
    }
    return {
        uid: request.user.uid,
        role: data.role || 'specialist',
        status: data.status,
        addedAt: data.addedAt?.toDate() || new Date(),
    };
}
export async function requireOrgAdmin(request, reply, orgId) {
    const member = await requireOrgMember(request, reply, orgId);
    if (member.role !== 'org_admin') {
        return reply
            .code(403)
            .send({ error: 'Only organization admins can perform this action' });
    }
    return member;
}
//# sourceMappingURL=orgMember.guard.js.map