import { findSpecialist, createSpecialist, updateSpecialist, findUserOrganizations, findFirstActiveOrganization, } from './users.repository.js';
export async function getProfile(uid, email) {
    const specialist = await findSpecialist(uid);
    let name = email?.split('@')[0] || 'Specialist';
    if (specialist) {
        name = specialist.fullName || specialist.name || name;
    }
    const organizations = await findUserOrganizations(uid);
    console.log(`[ME] Found ${organizations.length} organization(s) for uid: ${uid}`);
    return {
        uid,
        email: email || '',
        name,
        organizations,
    };
}
export async function updateProfile(uid, email, input) {
    const existingSpecialist = await findSpecialist(uid);
    if (existingSpecialist) {
        const updated = await updateSpecialist(uid, { name: input.name });
        return {
            specialist: {
                uid,
                email: email || '',
                name: updated?.fullName || updated?.name || email?.split('@')[0] || 'Specialist',
            },
        };
    }
    const name = input.name || email?.split('@')[0] || 'Specialist';
    await createSpecialist(uid, email || '', name);
    console.log(`[ME] Created profile for uid: ${uid} (no organization - must use invite code)`);
    return {
        specialist: { uid, email: email || '', name },
    };
}
export async function getSession(uid) {
    const specialist = await findSpecialist(uid);
    if (!specialist) {
        return { hasOrg: false };
    }
    const orgId = await findFirstActiveOrganization(uid);
    if (orgId) {
        return { hasOrg: true, orgId };
    }
    return { hasOrg: false };
}
//# sourceMappingURL=users.service.js.map