import { getFirestore } from './firebase.js'

// Re-export getFirestore for convenience
export { getFirestore }

// Collection name constants
export const COLLECTIONS = {
  ORGANIZATIONS: 'organizations',
  SPECIALISTS: 'specialists',
  CHILDREN: 'children',
  INVITES: 'invites',
  ORG_INVITES: 'orgInvites',
  PARENT_INVITES: 'parentInvites',
  PARENTS: 'parents',
} as const

// Collection reference helpers
export function getOrganizationsRef() {
  return getFirestore().collection(COLLECTIONS.ORGANIZATIONS)
}

export function getOrganizationRef(orgId: string) {
  return getFirestore().doc(`${COLLECTIONS.ORGANIZATIONS}/${orgId}`)
}

export function getOrgMembersRef(orgId: string) {
  return getFirestore().collection(`${COLLECTIONS.ORGANIZATIONS}/${orgId}/members`)
}

export function getOrgMemberRef(orgId: string, uid: string) {
  return getFirestore().doc(`${COLLECTIONS.ORGANIZATIONS}/${orgId}/members/${uid}`)
}

export function getOrgChildrenRef(orgId: string) {
  return getFirestore().collection(`${COLLECTIONS.ORGANIZATIONS}/${orgId}/children`)
}

export function getOrgChildRef(orgId: string, childId: string) {
  return getFirestore().doc(`${COLLECTIONS.ORGANIZATIONS}/${orgId}/children/${childId}`)
}

export function getOrgParentsRef(orgId: string) {
  return getFirestore().collection(`${COLLECTIONS.ORGANIZATIONS}/${orgId}/parents`)
}

export function getSpecialistsRef() {
  return getFirestore().collection(COLLECTIONS.SPECIALISTS)
}

export function getSpecialistRef(uid: string) {
  return getFirestore().doc(`${COLLECTIONS.SPECIALISTS}/${uid}`)
}

export function getChildrenRef() {
  return getFirestore().collection(COLLECTIONS.CHILDREN)
}

export function getChildRef(childId: string) {
  return getFirestore().doc(`${COLLECTIONS.CHILDREN}/${childId}`)
}

export function getChildNotesRef(childId: string) {
  return getFirestore().collection(`${COLLECTIONS.CHILDREN}/${childId}/specialistNotes`)
}

export function getChildTasksRef(childId: string) {
  return getFirestore().collection(`${COLLECTIONS.CHILDREN}/${childId}/tasks`)
}

export function getChildProgressRef(childId: string) {
  return getFirestore().doc(`${COLLECTIONS.CHILDREN}/${childId}/progress/speech`)
}

export function getChildFeedbackRef(childId: string) {
  return getFirestore().collection(`${COLLECTIONS.CHILDREN}/${childId}/feedback`)
}

export function getInvitesRef() {
  return getFirestore().collection(COLLECTIONS.INVITES)
}

export function getInviteRef(code: string) {
  return getFirestore().doc(`${COLLECTIONS.INVITES}/${code}`)
}

export function getOrgInviteRef(code: string) {
  return getFirestore().doc(`${COLLECTIONS.ORG_INVITES}/${code}`)
}

export function getParentInviteRef(code: string) {
  return getFirestore().doc(`${COLLECTIONS.PARENT_INVITES}/${code}`)
}

export function getParentsRef() {
  return getFirestore().collection(COLLECTIONS.PARENTS)
}

export function getParentRef(parentUid: string) {
  return getFirestore().doc(`${COLLECTIONS.PARENTS}/${parentUid}`)
}
