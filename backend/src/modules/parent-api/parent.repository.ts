import {
  getFirestore,
  getChildRef,
  getChildNotesRef,
  getOrgChildrenRef,
  getOrganizationRef,
  getSpecialistRef,
  getParentRef,
} from '../../infrastructure/database/collections.js'
import type { SpecialistNote } from '../../shared/types/common.js'

export interface LinkedSpecialist {
  uid: string
  name: string
  email?: string
  orgId: string
  orgName: string
  linkedAt: Date
}

export interface LinkedOrganization {
  orgId: string
  orgName: string
  linkedAt: Date
}

/**
 * Verify that the parent has access to this child
 */
export async function verifyParentChildAccess(
  childId: string,
  parentUid: string
): Promise<boolean> {
  // Check if child document has this parentUid
  const childRef = getChildRef(childId)
  const childSnap = await childRef.get()

  if (!childSnap.exists) {
    return false
  }

  const childData = childSnap.data()!

  // Check if the child's parentUid matches
  if (childData.parentUid === parentUid) {
    return true
  }

  // Also check the parent's linkedChildren array
  const parentRef = getParentRef(parentUid)
  const parentSnap = await parentRef.get()

  if (parentSnap.exists) {
    const parentData = parentSnap.data()!
    const linkedChildren = parentData.linkedChildren || []
    if (linkedChildren.includes(childId)) {
      return true
    }
  }

  return false
}

/**
 * Get linked organizations for a parent
 */
export async function getParentLinkedOrganizations(
  parentUid: string
): Promise<LinkedOrganization[]> {
  const parentRef = getParentRef(parentUid)
  const parentSnap = await parentRef.get()

  if (!parentSnap.exists) {
    return []
  }

  const parentData = parentSnap.data()!
  const linkedOrgs = parentData.linkedOrganizations || []

  return linkedOrgs.map((org: any) => ({
    orgId: org.orgId,
    orgName: org.orgName,
    linkedAt: org.linkedAt?.toDate() || new Date(),
  }))
}

/**
 * Get specialists that have access to a child
 */
export async function getChildSpecialists(
  childId: string,
  parentUid: string
): Promise<LinkedSpecialist[]> {
  // First verify parent has access
  const hasAccess = await verifyParentChildAccess(childId, parentUid)
  if (!hasAccess) {
    throw new Error('Access denied: You do not have access to this child')
  }

  const specialists: LinkedSpecialist[] = []
  const db = getFirestore()

  // Get all organizations the child is linked to
  const childRef = getChildRef(childId)
  const childSnap = await childRef.get()

  if (!childSnap.exists) {
    return []
  }

  const childData = childSnap.data()!
  const orgId = childData.organizationId

  if (!orgId) {
    return []
  }

  // Get organization info
  const orgRef = getOrganizationRef(orgId)
  const orgSnap = await orgRef.get()
  const orgName = orgSnap.exists ? orgSnap.data()!.name : 'Organization'

  // Find the child's entry in the org to get specialist info
  const orgChildrenRef = getOrgChildrenRef(orgId)
  const orgChildSnap = await orgChildrenRef.doc(childId).get()

  if (orgChildSnap.exists) {
    const orgChildData = orgChildSnap.data()!
    const specialistId = orgChildData.assignedSpecialistId

    if (specialistId) {
      const specialistRef = getSpecialistRef(specialistId)
      const specialistSnap = await specialistRef.get()

      if (specialistSnap.exists) {
        const specialistData = specialistSnap.data()!
        specialists.push({
          uid: specialistId,
          name: specialistData.name || specialistData.fullName || 'Specialist',
          email: specialistData.email,
          orgId,
          orgName,
          linkedAt: orgChildData.assignedAt?.toDate() || new Date(),
        })
      }
    }
  }

  return specialists
}

/**
 * Get notes for a child that are visible to the parent
 */
export async function getChildNotesForParent(
  childId: string,
  parentUid: string
): Promise<SpecialistNote[]> {
  // First verify parent has access
  const hasAccess = await verifyParentChildAccess(childId, parentUid)
  if (!hasAccess) {
    throw new Error('Access denied: You do not have access to this child')
  }

  const notesRef = getChildNotesRef(childId)
  // Get notes that are visible to parent (default: true)
  const notesSnapshot = await notesRef.orderBy('createdAt', 'desc').get()

  return notesSnapshot.docs
    .filter((doc) => {
      const data = doc.data()
      // If visibleToParent is not set, default to true
      return data.visibleToParent !== false
    })
    .map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        childId,
        orgId: data.orgId,
        specialistId: data.specialistId,
        specialistName: data.specialistName || 'Specialist',
        text: data.text || data.content || '',
        tags: data.tags || [],
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || data.createdAt?.toDate() || new Date(),
      }
    })
}

/**
 * Get all children linked to a parent
 */
export async function getParentChildren(parentUid: string): Promise<string[]> {
  const parentRef = getParentRef(parentUid)
  const parentSnap = await parentRef.get()

  if (!parentSnap.exists) {
    return []
  }

  const parentData = parentSnap.data()!
  return parentData.linkedChildren || []
}
