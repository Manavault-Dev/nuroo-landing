import admin from 'firebase-admin'
import {
  getFirestore,
  getSpecialistRef,
  getOrganizationsRef,
  getOrgMemberRef,
} from '../../infrastructure/database/collections.js'
import { nowTimestamp } from '../../shared/utils/timestamp.js'

export interface SpecialistData {
  uid: string
  email: string
  fullName: string
  name: string
  createdAt: admin.firestore.Timestamp
  updatedAt: admin.firestore.Timestamp
}

export async function findSpecialist(uid: string) {
  const specialistRef = getSpecialistRef(uid)
  const snap = await specialistRef.get()
  return snap.exists ? snap.data() : null
}

export async function createSpecialist(uid: string, email: string, name: string) {
  const specialistRef = getSpecialistRef(uid)
  const now = nowTimestamp()

  const data: SpecialistData = {
    uid,
    email,
    fullName: name,
    name,
    createdAt: now,
    updatedAt: now,
  }

  await specialistRef.set(data)
  return data
}

export async function updateSpecialist(uid: string, updates: { name?: string }) {
  const specialistRef = getSpecialistRef(uid)
  const updateData: Record<string, unknown> = {
    updatedAt: nowTimestamp(),
  }

  if (updates.name) {
    updateData.fullName = updates.name
    updateData.name = updates.name
  }

  await specialistRef.update(updateData)
  return (await specialistRef.get()).data()
}

export async function findUserOrganizations(uid: string) {
  const db = getFirestore()
  const orgsSnapshot = await getOrganizationsRef().get()
  const organizations: Array<{ orgId: string; orgName: string; role: 'admin' | 'specialist' }> = []

  for (const orgDoc of orgsSnapshot.docs) {
    const orgId = orgDoc.id
    const orgData = orgDoc.data()

    const memberRef = getOrgMemberRef(orgId, uid)
    const memberSnap = await memberRef.get()

    if (!memberSnap.exists) continue

    const memberData = memberSnap.data()
    if (memberData?.status !== 'active') continue

    const role = memberData.role === 'org_admin' ? 'admin' : 'specialist'

    organizations.push({
      orgId,
      orgName: orgData.name || orgId,
      role,
    })
  }

  return organizations
}

export async function findFirstActiveOrganization(uid: string): Promise<string | null> {
  const orgsSnapshot = await getOrganizationsRef().get()

  for (const orgDoc of orgsSnapshot.docs) {
    const orgId = orgDoc.id
    const memberRef = getOrgMemberRef(orgId, uid)
    const memberSnap = await memberRef.get()

    if (memberSnap.exists && memberSnap.data()?.status === 'active') {
      return orgId
    }
  }

  return null
}
