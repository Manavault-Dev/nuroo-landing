import { getFirestore, getSpecialistRef, getOrganizationsRef, getOrgMemberRef, } from '../../infrastructure/database/collections.js';
import { nowTimestamp } from '../../shared/utils/timestamp.js';
export async function findSpecialist(uid) {
    const specialistRef = getSpecialistRef(uid);
    const snap = await specialistRef.get();
    return snap.exists ? snap.data() : null;
}
export async function createSpecialist(uid, email, name) {
    const specialistRef = getSpecialistRef(uid);
    const now = nowTimestamp();
    const data = {
        uid,
        email,
        fullName: name,
        name,
        createdAt: now,
        updatedAt: now,
    };
    await specialistRef.set(data);
    return data;
}
export async function updateSpecialist(uid, updates) {
    const specialistRef = getSpecialistRef(uid);
    const updateData = {
        updatedAt: nowTimestamp(),
    };
    if (updates.name) {
        updateData.fullName = updates.name;
        updateData.name = updates.name;
    }
    await specialistRef.update(updateData);
    return (await specialistRef.get()).data();
}
export async function findUserOrganizations(uid) {
    const db = getFirestore();
    const orgsSnapshot = await getOrganizationsRef().get();
    const organizations = [];
    for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id;
        const orgData = orgDoc.data();
        const memberRef = getOrgMemberRef(orgId, uid);
        const memberSnap = await memberRef.get();
        if (!memberSnap.exists)
            continue;
        const memberData = memberSnap.data();
        if (memberData?.status !== 'active')
            continue;
        const role = memberData.role === 'org_admin' ? 'admin' : 'specialist';
        organizations.push({
            orgId,
            orgName: orgData.name || orgId,
            role,
        });
    }
    return organizations;
}
export async function findFirstActiveOrganization(uid) {
    const orgsSnapshot = await getOrganizationsRef().get();
    for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id;
        const memberRef = getOrgMemberRef(orgId, uid);
        const memberSnap = await memberRef.get();
        if (memberSnap.exists && memberSnap.data()?.status === 'active') {
            return orgId;
        }
    }
    return null;
}
//# sourceMappingURL=users.repository.js.map