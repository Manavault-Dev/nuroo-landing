import admin from 'firebase-admin';
import { z } from 'zod';
import { getFirestore } from '../infrastructure/database/firebase.js';
import { requireOrgMember } from '../plugins/rbac.js';
const DEFAULT_GROUP_COLOR = '#6366f1';
const COLLECTIONS = {
    SPECIALIST_GROUPS: (uid) => `specialists/${uid}/groups`,
    GROUP_PARENTS: (uid, groupId) => `specialists/${uid}/groups/${groupId}/parents`,
    ORG_CHILDREN: (orgId) => `organizations/${orgId}/children`,
    CHILDREN: 'children',
};
const createGroupSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
});
const addParentToGroupSchema = z.object({
    parentUserId: z.string().min(1),
    childIds: z.array(z.string()).optional(),
});
function isIndexError(error) {
    return error.code === 9 || error.message?.includes('index');
}
function sortByCreatedAt(docs) {
    return docs.sort((a, b) => {
        const aTime = a.data().createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.data().createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
    });
}
async function fetchGroupsWithFallback(db, uid, orgId) {
    const groupsRef = db.collection(COLLECTIONS.SPECIALIST_GROUPS(uid)).where('orgId', '==', orgId);
    try {
        return await groupsRef.orderBy('createdAt', 'desc').get();
    }
    catch (error) {
        if (isIndexError(error)) {
            const snapshot = await groupsRef.get();
            return { docs: sortByCreatedAt(snapshot.docs) };
        }
        throw error;
    }
}
async function countGroupParents(db, uid, groupId) {
    const parentsSnapshot = await db.collection(COLLECTIONS.GROUP_PARENTS(uid, groupId)).get();
    return parentsSnapshot.docs.length;
}
function transformGroup(doc, parentCount) {
    const data = doc.data();
    return {
        id: doc.id,
        name: data.name,
        description: data.description || null,
        color: data.color || DEFAULT_GROUP_COLOR,
        orgId: data.orgId,
        parentCount,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
    };
}
async function fetchParentAuthData(parentUid) {
    try {
        const auth = admin.auth();
        const parentUser = await auth.getUser(parentUid);
        return {
            email: parentUser.email || null,
            displayName: parentUser.displayName || null,
        };
    }
    catch {
        return {
            email: null,
            displayName: null,
        };
    }
}
async function fetchChildData(db, childId) {
    const childRef = db.doc(`${COLLECTIONS.CHILDREN}/${childId}`);
    const childSnap = await childRef.get();
    if (!childSnap.exists) {
        return {
            id: childId,
            name: 'Unknown',
            age: undefined,
        };
    }
    const childData = childSnap.data();
    return {
        id: childId,
        name: childData.name || childData.childName || 'Unknown',
        age: childData.age || childData.childAge,
    };
}
async function getChildIdsForParent(db, orgId, parentUserId) {
    const childrenDocs = await db
        .collection(COLLECTIONS.ORG_CHILDREN(orgId))
        .where('parentUserId', '==', parentUserId)
        .get();
    return childrenDocs.docs.map((doc) => doc.id);
}
function verifyGroupOwnership(groupData, orgId) {
    return groupData.orgId === orgId;
}
function buildGroupData(body, orgId, now) {
    return {
        name: body.name,
        description: body.description || null,
        color: body.color || DEFAULT_GROUP_COLOR,
        orgId,
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
    };
}
export const groupsRoute = async (fastify) => {
    fastify.get('/orgs/:orgId/groups', async (request, reply) => {
        try {
            const { orgId } = request.params;
            await requireOrgMember(request, reply, orgId);
            const { uid } = request.user;
            const db = getFirestore();
            const groupsSnapshot = await fetchGroupsWithFallback(db, uid, orgId);
            const groups = await Promise.all(groupsSnapshot.docs.map(async (doc) => {
                const parentCount = await countGroupParents(db, uid, doc.id);
                return transformGroup(doc, parentCount);
            }));
            return {
                ok: true,
                groups,
                count: groups.length,
            };
        }
        catch (error) {
            console.error('[GROUPS] Error listing groups:', error);
            return reply.code(500).send({
                error: 'Failed to list groups',
                details: error.message,
            });
        }
    });
    fastify.post('/orgs/:orgId/groups', async (request, reply) => {
        try {
            const { orgId } = request.params;
            await requireOrgMember(request, reply, orgId);
            const { uid } = request.user;
            const body = createGroupSchema.parse(request.body);
            const now = new Date();
            const db = getFirestore();
            const existingGroups = await db
                .collection(COLLECTIONS.SPECIALIST_GROUPS(uid))
                .where('orgId', '==', orgId)
                .where('name', '==', body.name)
                .limit(1)
                .get();
            if (!existingGroups.empty) {
                return reply.code(400).send({
                    error: 'Group with this name already exists',
                });
            }
            const groupRef = db.collection(COLLECTIONS.SPECIALIST_GROUPS(uid)).doc();
            const groupId = groupRef.id;
            const groupData = buildGroupData(body, orgId, now);
            await groupRef.set(groupData);
            return {
                ok: true,
                group: {
                    id: groupId,
                    ...groupData,
                    parentCount: 0,
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                },
            };
        }
        catch (error) {
            console.error('[GROUPS] Error creating group:', error);
            return reply.code(500).send({
                error: 'Failed to create group',
                details: error.message,
            });
        }
    });
    fastify.get('/orgs/:orgId/groups/:groupId', async (request, reply) => {
        try {
            const { orgId, groupId } = request.params;
            await requireOrgMember(request, reply, orgId);
            const { uid } = request.user;
            const db = getFirestore();
            const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(uid)}/${groupId}`);
            const groupSnap = await groupRef.get();
            if (!groupSnap.exists) {
                return reply.code(404).send({ error: 'Group not found' });
            }
            const groupData = groupSnap.data();
            if (!verifyGroupOwnership(groupData, orgId)) {
                return reply.code(403).send({
                    error: 'Group does not belong to this organization',
                });
            }
            const parentsSnapshot = await db.collection(COLLECTIONS.GROUP_PARENTS(uid, groupId)).get();
            const parents = await Promise.all(parentsSnapshot.docs.map(async (doc) => {
                const data = doc.data();
                const parentUid = doc.id;
                const authData = await fetchParentAuthData(parentUid);
                const childIds = data.childIds || [];
                const children = await Promise.all(childIds.map((childId) => fetchChildData(db, childId)));
                return {
                    parentUserId: parentUid,
                    name: authData.displayName || 'Unknown',
                    email: authData.email,
                    children,
                    addedAt: data.addedAt?.toDate?.()?.toISOString() || null,
                };
            }));
            return {
                ok: true,
                group: {
                    id: groupId,
                    name: groupData.name,
                    description: groupData.description || null,
                    color: groupData.color || DEFAULT_GROUP_COLOR,
                    orgId: groupData.orgId,
                    parents,
                    parentCount: parents.length,
                    createdAt: groupData.createdAt?.toDate?.()?.toISOString() || null,
                    updatedAt: groupData.updatedAt?.toDate?.()?.toISOString() || null,
                },
            };
        }
        catch (error) {
            console.error('[GROUPS] Error getting group:', error);
            return reply.code(500).send({
                error: 'Failed to get group',
                details: error.message,
            });
        }
    });
    fastify.post('/orgs/:orgId/groups/:groupId/parents', async (request, reply) => {
        try {
            const { orgId, groupId } = request.params;
            await requireOrgMember(request, reply, orgId);
            const { uid } = request.user;
            const body = addParentToGroupSchema.parse(request.body);
            const now = new Date();
            const db = getFirestore();
            const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(uid)}/${groupId}`);
            const groupSnap = await groupRef.get();
            if (!groupSnap.exists) {
                return reply.code(404).send({ error: 'Group not found' });
            }
            const groupData = groupSnap.data();
            if (!verifyGroupOwnership(groupData, orgId)) {
                return reply.code(403).send({
                    error: 'Group does not belong to this organization',
                });
            }
            const orgChildrenSnap = await db
                .collection(COLLECTIONS.ORG_CHILDREN(orgId))
                .where('parentUserId', '==', body.parentUserId)
                .limit(1)
                .get();
            if (orgChildrenSnap.empty) {
                return reply.code(404).send({
                    error: 'Parent is not linked to this organization',
                });
            }
            let childIds = body.childIds || [];
            if (childIds.length === 0) {
                childIds = await getChildIdsForParent(db, orgId, body.parentUserId);
            }
            const parentRef = db.doc(`${COLLECTIONS.GROUP_PARENTS(uid, groupId)}/${body.parentUserId}`);
            const parentSnap = await parentRef.get();
            const parentData = {
                childIds,
                updatedAt: admin.firestore.Timestamp.fromDate(now),
            };
            if (parentSnap.exists) {
                await parentRef.update(parentData);
            }
            else {
                await parentRef.set({
                    ...parentData,
                    addedAt: admin.firestore.Timestamp.fromDate(now),
                });
            }
            return {
                ok: true,
                message: 'Parent added to group successfully',
            };
        }
        catch (error) {
            console.error('[GROUPS] Error adding parent to group:', error);
            return reply.code(500).send({
                error: 'Failed to add parent to group',
                details: error.message,
            });
        }
    });
    fastify.delete('/orgs/:orgId/groups/:groupId/parents/:parentUserId', async (request, reply) => {
        try {
            const { orgId, groupId, parentUserId } = request.params;
            await requireOrgMember(request, reply, orgId);
            const { uid } = request.user;
            const db = getFirestore();
            const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(uid)}/${groupId}`);
            const groupSnap = await groupRef.get();
            if (!groupSnap.exists) {
                return reply.code(404).send({ error: 'Group not found' });
            }
            const parentRef = db.doc(`${COLLECTIONS.GROUP_PARENTS(uid, groupId)}/${parentUserId}`);
            await parentRef.delete();
            return {
                ok: true,
                message: 'Parent removed from group successfully',
            };
        }
        catch (error) {
            console.error('[GROUPS] Error removing parent from group:', error);
            return reply.code(500).send({
                error: 'Failed to remove parent from group',
                details: error.message,
            });
        }
    });
    fastify.patch('/orgs/:orgId/groups/:groupId', async (request, reply) => {
        try {
            const { orgId, groupId } = request.params;
            await requireOrgMember(request, reply, orgId);
            const { uid } = request.user;
            const body = request.body;
            const now = new Date();
            const db = getFirestore();
            const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(uid)}/${groupId}`);
            const groupSnap = await groupRef.get();
            if (!groupSnap.exists) {
                return reply.code(404).send({ error: 'Group not found' });
            }
            const groupData = groupSnap.data();
            if (!verifyGroupOwnership(groupData, orgId)) {
                return reply.code(403).send({
                    error: 'Group does not belong to this organization',
                });
            }
            if (body.name && body.name !== groupData.name) {
                const existingGroups = await db
                    .collection(COLLECTIONS.SPECIALIST_GROUPS(uid))
                    .where('orgId', '==', orgId)
                    .where('name', '==', body.name)
                    .limit(1)
                    .get();
                if (!existingGroups.empty) {
                    return reply.code(400).send({
                        error: 'Group with this name already exists',
                    });
                }
            }
            const updateData = {
                updatedAt: admin.firestore.Timestamp.fromDate(now),
            };
            if (body.name)
                updateData.name = body.name;
            if (body.description !== undefined)
                updateData.description = body.description || null;
            if (body.color)
                updateData.color = body.color;
            await groupRef.update(updateData);
            return {
                ok: true,
                message: 'Group updated successfully',
            };
        }
        catch (error) {
            console.error('[GROUPS] Error updating group:', error);
            return reply.code(500).send({
                error: 'Failed to update group',
                details: error.message,
            });
        }
    });
    fastify.delete('/orgs/:orgId/groups/:groupId', async (request, reply) => {
        try {
            const { orgId, groupId } = request.params;
            await requireOrgMember(request, reply, orgId);
            const { uid } = request.user;
            const db = getFirestore();
            const groupRef = db.doc(`${COLLECTIONS.SPECIALIST_GROUPS(uid)}/${groupId}`);
            const groupSnap = await groupRef.get();
            if (!groupSnap.exists) {
                return reply.code(404).send({ error: 'Group not found' });
            }
            const groupData = groupSnap.data();
            if (!verifyGroupOwnership(groupData, orgId)) {
                return reply.code(403).send({
                    error: 'Group does not belong to this organization',
                });
            }
            const parentsSnapshot = await db.collection(COLLECTIONS.GROUP_PARENTS(uid, groupId)).get();
            const deletePromises = parentsSnapshot.docs.map((doc) => doc.ref.delete());
            await Promise.all(deletePromises);
            await groupRef.delete();
            return {
                ok: true,
                message: 'Group deleted successfully',
            };
        }
        catch (error) {
            console.error('[GROUPS] Error deleting group:', error);
            return reply.code(500).send({
                error: 'Failed to delete group',
                details: error.message,
            });
        }
    });
};
//# sourceMappingURL=groups.js.map