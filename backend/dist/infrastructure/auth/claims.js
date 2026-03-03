import { getAuth } from '../database/firebase.js';
export async function setSuperAdminClaim(uid, value = true) {
    const auth = getAuth();
    const user = await auth.getUser(uid);
    const currentClaims = user.customClaims || {};
    if (value) {
        await auth.setCustomUserClaims(uid, { ...currentClaims, superAdmin: true });
    }
    else {
        const { superAdmin, ...restClaims } = currentClaims;
        await auth.setCustomUserClaims(uid, restClaims);
    }
}
export async function getSuperAdminClaim(uid) {
    const auth = getAuth();
    const user = await auth.getUser(uid);
    return user.customClaims?.superAdmin === true;
}
export async function getUserByEmail(email) {
    const auth = getAuth();
    return auth.getUserByEmail(email);
}
export async function listUsersWithClaim(claimKey, claimValue, maxResults = 1000) {
    const auth = getAuth();
    const listUsersResult = await auth.listUsers(maxResults);
    return listUsersResult.users.filter((user) => user.customClaims?.[claimKey] === claimValue);
}
//# sourceMappingURL=claims.js.map