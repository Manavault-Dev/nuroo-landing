import { getFirestore } from './firebase.js';
// Re-export getFirestore for convenience
export { getFirestore };
// Collection name constants
export const COLLECTIONS = {
    ORGANIZATIONS: 'organizations',
    SPECIALISTS: 'specialists',
    CHILDREN: 'children',
    INVITES: 'invites',
    ORG_INVITES: 'orgInvites',
    PARENT_INVITES: 'parentInvites',
    PARENTS: 'parents',
};
// Collection reference helpers
export function getOrganizationsRef() {
    return getFirestore().collection(COLLECTIONS.ORGANIZATIONS);
}
export function getOrganizationRef(orgId) {
    return getFirestore().doc(`${COLLECTIONS.ORGANIZATIONS}/${orgId}`);
}
export function getOrgMembersRef(orgId) {
    return getFirestore().collection(`${COLLECTIONS.ORGANIZATIONS}/${orgId}/members`);
}
export function getOrgMemberRef(orgId, uid) {
    return getFirestore().doc(`${COLLECTIONS.ORGANIZATIONS}/${orgId}/members/${uid}`);
}
export function getOrgChildrenRef(orgId) {
    return getFirestore().collection(`${COLLECTIONS.ORGANIZATIONS}/${orgId}/children`);
}
export function getOrgChildRef(orgId, childId) {
    return getFirestore().doc(`${COLLECTIONS.ORGANIZATIONS}/${orgId}/children/${childId}`);
}
export function getOrgParentsRef(orgId) {
    return getFirestore().collection(`${COLLECTIONS.ORGANIZATIONS}/${orgId}/parents`);
}
export function getSpecialistsRef() {
    return getFirestore().collection(COLLECTIONS.SPECIALISTS);
}
export function getSpecialistRef(uid) {
    return getFirestore().doc(`${COLLECTIONS.SPECIALISTS}/${uid}`);
}
export function getChildrenRef() {
    return getFirestore().collection(COLLECTIONS.CHILDREN);
}
export function getChildRef(childId) {
    return getFirestore().doc(`${COLLECTIONS.CHILDREN}/${childId}`);
}
export function getChildNotesRef(childId) {
    return getFirestore().collection(`${COLLECTIONS.CHILDREN}/${childId}/specialistNotes`);
}
export function getChildTasksRef(childId) {
    return getFirestore().collection(`${COLLECTIONS.CHILDREN}/${childId}/tasks`);
}
export function getChildProgressRef(childId) {
    return getFirestore().doc(`${COLLECTIONS.CHILDREN}/${childId}/progress/speech`);
}
export function getChildFeedbackRef(childId) {
    return getFirestore().collection(`${COLLECTIONS.CHILDREN}/${childId}/feedback`);
}
export function getInvitesRef() {
    return getFirestore().collection(COLLECTIONS.INVITES);
}
export function getInviteRef(code) {
    return getFirestore().doc(`${COLLECTIONS.INVITES}/${code}`);
}
export function getOrgInviteRef(code) {
    return getFirestore().doc(`${COLLECTIONS.ORG_INVITES}/${code}`);
}
export function getParentInviteRef(code) {
    return getFirestore().doc(`${COLLECTIONS.PARENT_INVITES}/${code}`);
}
export function getParentsRef() {
    return getFirestore().collection(COLLECTIONS.PARENTS);
}
export function getParentRef(parentUid) {
    return getFirestore().doc(`${COLLECTIONS.PARENTS}/${parentUid}`);
}
//# sourceMappingURL=collections.js.map