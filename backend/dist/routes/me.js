import admin from 'firebase-admin';
import { getFirestore } from '../infrastructure/database/firebase.js';
import { config } from '../config.js';
import { z } from 'zod';
const COLLECTIONS = {
    SPECIALISTS: 'specialists',
    ORGANIZATIONS: 'organizations',
    ORG_MEMBERS: (orgId) => `organizations/${orgId}/members`,
};
const DEV_SUPER_ADMIN_WHITELIST = ['nuroo@gmail.com'];
const updateProfileSchema = z.object({
    name: z.string().min(1).max(100).optional(),
});
function isSuperAdmin(request) {
    if (!request.user)
        return false;
    const userEmail = (request.user.email || '').toLowerCase().trim();
    const hasClaim = request.user.claims?.superAdmin === true;
    const isWhitelisted = config.NODE_ENV !== 'production' &&
        DEV_SUPER_ADMIN_WHITELIST.some((email) => email.toLowerCase().trim() === userEmail);
    return hasClaim || isWhitelisted;
}
function extractName(specialistData, email) {
    if (specialistData?.fullName)
        return specialistData.fullName;
    if (specialistData?.name)
        return specialistData.name;
    return email?.split('@')[0] || 'Specialist';
}
function normalizeRole(role) {
    return role === 'org_admin' ? 'admin' : 'specialist';
}
async function findOrganizationsForUser(db, uid, isUserSuperAdmin) {
    const orgsSnapshot = await db.collection(COLLECTIONS.ORGANIZATIONS).get();
    const organizations = [];
    for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id;
        const orgData = orgDoc.data();
        if (isUserSuperAdmin && orgData.createdBy === uid) {
            organizations.push({
                orgId,
                orgName: orgData.name || orgId,
                role: 'admin',
            });
            continue;
        }
        const memberRef = db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${uid}`);
        const memberSnap = await memberRef.get();
        if (!memberSnap.exists)
            continue;
        const memberData = memberSnap.data();
        if (memberData?.status !== 'active')
            continue;
        organizations.push({
            orgId,
            orgName: orgData.name || orgId,
            role: normalizeRole(memberData.role),
        });
    }
    return organizations;
}
function buildProfileUpdateData(name, now) {
    return {
        fullName: name,
        name,
        updatedAt: admin.firestore.Timestamp.fromDate(now),
    };
}
function buildNewProfileData(uid, email, name, now) {
    return {
        uid,
        email: email || '',
        fullName: name,
        name,
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
    };
}
export const meRoute = async (fastify) => {
    fastify.get('/me', async (request, reply) => {
        if (!request.user) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
        const db = getFirestore();
        const { uid, email } = request.user;
        const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${uid}`);
        const specialistSnap = await specialistRef.get();
        const specialistData = specialistSnap.exists ? specialistSnap.data() : null;
        const name = extractName(specialistData, email);
        const userIsSuperAdmin = isSuperAdmin(request);
        const organizations = await findOrganizationsForUser(db, uid, userIsSuperAdmin);
        const profile = {
            uid,
            email: email || '',
            name,
            organizations,
        };
        return profile;
    });
    fastify.post('/me', async (request, reply) => {
        if (!request.user) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
        const db = getFirestore();
        const { uid, email } = request.user;
        const body = updateProfileSchema.parse(request.body);
        const now = new Date();
        const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${uid}`);
        const specialistSnap = await specialistRef.get();
        if (specialistSnap.exists) {
            if (body.name) {
                await specialistRef.update(buildProfileUpdateData(body.name, now));
            }
            const data = (await specialistRef.get()).data();
            return {
                ok: true,
                specialist: {
                    uid,
                    email: email || '',
                    name: extractName(data, email),
                },
            };
        }
        const name = body.name || email?.split('@')[0] || 'Specialist';
        const newData = buildNewProfileData(uid, email, name, now);
        await specialistRef.set(newData);
        return {
            ok: true,
            specialist: { uid, email: email || '', name: newData.fullName },
        };
    });
};
//# sourceMappingURL=me.js.map