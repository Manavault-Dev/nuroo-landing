import admin from 'firebase-admin';
import { getFirestore } from '../infrastructure/database/firebase.js';
import { requireOrgMember } from '../plugins/rbac.js';
const COLLECTIONS = {
    ORG_PARENTS: (orgId) => `organizations/${orgId}/parents`,
    ORG_PARENTS_REAL: (orgId) => `orgParents/${orgId}/parents`,
    ORG_CHILDREN: (orgId) => `organizations/${orgId}/children`,
};
async function fetchParentAuthData(parentUid) {
    try {
        const auth = admin.auth();
        const parentUser = await auth.getUser(parentUid);
        return {
            email: parentUser.email || null,
            displayName: parentUser.displayName || null,
        };
    }
    catch (error) {
        return {
            email: null,
            displayName: null,
        };
    }
}
async function countLinkedChildren(db, orgId, parentUid) {
    const childrenSnapshot = await db
        .collection(COLLECTIONS.ORG_CHILDREN(orgId))
        .where('parentUserId', '==', parentUid)
        .get();
    return childrenSnapshot.docs.length;
}
function transformLegacyParent(doc) {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate()?.toISOString() || null,
    };
}
async function transformRealParent(db, orgId, doc) {
    const data = doc.data();
    const parentUid = doc.id;
    const authData = await fetchParentAuthData(parentUid);
    const linkedChildrenCount = await countLinkedChildren(db, orgId, parentUid);
    return {
        id: parentUid,
        parentUserId: parentUid,
        name: authData.displayName || data.name || 'Unknown',
        email: authData.email || data.email || null,
        phone: data.phone || null,
        linkedSpecialistUid: data.linkedSpecialistUid || null,
        linkedChildrenCount,
        joinedAt: data.joinedAt?.toDate?.()?.toISOString() || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.joinedAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
    };
}
function mergeParents(realParents, legacyParents) {
    const realParentIds = new Set(realParents.map((p) => p.id));
    const uniqueLegacyParents = legacyParents.filter((p) => !realParentIds.has(p.id));
    return [...realParents, ...uniqueLegacyParents];
}
export const parentsRoute = async (fastify) => {
    fastify.get('/orgs/:orgId/parents', async (request, reply) => {
        try {
            const { orgId } = request.params;
            await requireOrgMember(request, reply, orgId);
            const db = getFirestore();
            const legacyParentsSnap = await db.collection(COLLECTIONS.ORG_PARENTS(orgId)).get();
            const legacyParents = legacyParentsSnap.docs.map(transformLegacyParent);
            let realParentsSnap;
            try {
                realParentsSnap = await db.collection(COLLECTIONS.ORG_PARENTS_REAL(orgId)).get();
            }
            catch (error) {
                realParentsSnap = { docs: [] };
            }
            const realParents = await Promise.all(realParentsSnap.docs.map((doc) => transformRealParent(db, orgId, doc)));
            const allParents = mergeParents(realParents, legacyParents);
            return { ok: true, parents: allParents };
        }
        catch (error) {
            console.error('[PARENTS] Error fetching parents:', error);
            return reply.code(500).send({
                error: 'Failed to fetch parent contacts',
                details: error.message,
            });
        }
    });
};
//# sourceMappingURL=parents.js.map