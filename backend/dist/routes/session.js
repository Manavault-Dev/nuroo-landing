import { getFirestore } from '../infrastructure/database/firebase.js';
const COLLECTIONS = {
    SPECIALISTS: 'specialists',
    ORGANIZATIONS: 'organizations',
    ORG_MEMBERS: (orgId) => `organizations/${orgId}/members`,
};
async function findActiveOrganization(db, uid) {
    const orgsSnapshot = await db.collection(COLLECTIONS.ORGANIZATIONS).get();
    for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id;
        const memberRef = db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${uid}`);
        const memberSnap = await memberRef.get();
        if (memberSnap.exists && memberSnap.data()?.status === 'active') {
            return orgId;
        }
    }
    return null;
}
export const sessionRoute = async (fastify) => {
    fastify.get('/session', async (request, reply) => {
        if (!request.user) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
        const db = getFirestore();
        const { uid } = request.user;
        const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${uid}`);
        const specialistSnap = await specialistRef.get();
        if (!specialistSnap.exists) {
            return { ok: true, hasOrg: false };
        }
        const orgId = await findActiveOrganization(db, uid);
        if (orgId) {
            return { ok: true, orgId, hasOrg: true };
        }
        return { ok: true, hasOrg: false };
    });
};
//# sourceMappingURL=session.js.map