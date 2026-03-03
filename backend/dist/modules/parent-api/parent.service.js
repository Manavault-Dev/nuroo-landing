import { getChildSpecialists, getChildNotesForParent, getParentLinkedOrganizations, getParentChildren, verifyParentChildAccess, } from './parent.repository.js';
/**
 * Get specialists with access to a child
 */
export async function listChildSpecialists(childId, parentUid) {
    return getChildSpecialists(childId, parentUid);
}
/**
 * Get notes for a child visible to parent
 */
export async function listChildNotes(childId, parentUid) {
    return getChildNotesForParent(childId, parentUid);
}
/**
 * Get all organizations linked to a parent
 */
export async function listParentOrganizations(parentUid) {
    return getParentLinkedOrganizations(parentUid);
}
/**
 * Get all children linked to a parent
 */
export async function listParentLinkedChildren(parentUid) {
    return getParentChildren(parentUid);
}
/**
 * Verify parent has access to child
 */
export async function verifyAccess(childId, parentUid) {
    return verifyParentChildAccess(childId, parentUid);
}
//# sourceMappingURL=parent.service.js.map