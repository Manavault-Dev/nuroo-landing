import {
  getFirestore,
  getChildRef,
  getChildNotesRef,
  getOrgChildrenRef,
  getOrganizationRef,
  getSpecialistRef,
  getParentRef,
} from '../../infrastructure/database/collections.js'
import admin from 'firebase-admin'
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

export async function verifyParentChildAccess(
  childId: string,
  parentUid: string
): Promise<boolean> {
  const childRef = getChildRef(childId)
  const childSnap = await childRef.get()

  if (!childSnap.exists) {
    return false
  }

  const childData = childSnap.data()!

  if (childData.parentUid === parentUid) {
    return true
  }

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

  return linkedOrgs.map(
    (org: { orgId: string; orgName?: string; linkedAt?: admin.firestore.Timestamp }) => ({
      orgId: org.orgId,
      orgName: org.orgName ?? '',
      linkedAt: org.linkedAt?.toDate() ?? new Date(),
    })
  )
}

export async function getChildSpecialists(
  childId: string,
  parentUid: string
): Promise<LinkedSpecialist[]> {
  const hasAccess = await verifyParentChildAccess(childId, parentUid)
  if (!hasAccess) {
    throw new Error('Access denied: You do not have access to this child')
  }

  const specialists: LinkedSpecialist[] = []
  const _db = getFirestore()

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

  const orgRef = getOrganizationRef(orgId)
  const orgSnap = await orgRef.get()
  const orgName = orgSnap.exists ? orgSnap.data()!.name : 'Organization'

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

export async function getChildNotesForParent(
  childId: string,
  parentUid: string
): Promise<SpecialistNote[]> {
  const hasAccess = await verifyParentChildAccess(childId, parentUid)
  if (!hasAccess) {
    throw new Error('Access denied: You do not have access to this child')
  }

  const notesRef = getChildNotesRef(childId)

  const notesSnapshot = await notesRef.orderBy('createdAt', 'desc').get()

  return notesSnapshot.docs
    .filter((doc) => {
      const data = doc.data()

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

export async function getParentChildren(parentUid: string): Promise<string[]> {
  const parentRef = getParentRef(parentUid)
  const parentSnap = await parentRef.get()

  if (!parentSnap.exists) {
    return []
  }

  const parentData = parentSnap.data()!
  return parentData.linkedChildren || []
}
