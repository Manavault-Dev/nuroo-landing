import admin from 'firebase-admin'
import {
  getFirestore,
  getOrgInviteRef,
  getParentInviteRef,
  getInviteRef,
  getOrganizationRef,
  getOrganizationsRef,
  getOrgMemberRef,
  getSpecialistRef,
  getChildRef,
  getOrgChildRef,
  getParentRef,
} from '../../infrastructure/database/collections.js'
import { nowTimestamp, futureTimestamp, isExpired } from '../../shared/utils/timestamp.js'

export async function createOrgInvite(
  orgId: string,
  role: 'specialist' | 'admin',
  createdBy: string,
  expiresInDays: number,
  maxUses?: number
) {
  const inviteCode = `${orgId}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  const inviteRef = getOrgInviteRef(inviteCode)

  await inviteRef.set({
    orgId,
    role,
    maxUses: maxUses || null,
    usedCount: 0,
    expiresAt: futureTimestamp(expiresInDays),
    createdBy,
    createdAt: nowTimestamp(),
  })

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  return {
    inviteCode,
    expiresAt: expiresAt.toISOString(),
    role,
    maxUses: maxUses || null,
  }
}

export async function findOrgInvite(code: string) {
  const inviteRef = getOrgInviteRef(code.trim())
  const inviteSnap = await inviteRef.get()
  return inviteSnap.exists ? { ref: inviteRef, data: inviteSnap.data()! } : null
}

export async function findInvite(code: string) {
  const inviteRef = getInviteRef(code.trim().toUpperCase())
  const inviteSnap = await inviteRef.get()
  return inviteSnap.exists ? { ref: inviteRef, data: inviteSnap.data()! } : null
}

export async function findParentInvite(code: string) {
  const normalizedCode = code.trim().toUpperCase()
  const inviteRef = getParentInviteRef(normalizedCode)
  const inviteSnap = await inviteRef.get()
  return inviteSnap.exists ? { ref: inviteRef, data: inviteSnap.data()! } : null
}

export async function incrementInviteUsage(ref: admin.firestore.DocumentReference) {
  try {
    await ref.update({ usedCount: admin.firestore.FieldValue.increment(1) })
  } catch {
    // Ignore errors
  }
}

export async function createParentInvite(specialistId: string, orgId: string) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let inviteCode = ''
  for (let i = 0; i < 6; i++) {
    inviteCode += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  const inviteRef = getParentInviteRef(inviteCode)

  await inviteRef.set({
    specialistId,
    orgId,
    maxUses: null,
    usedCount: 0,
    expiresAt: futureTimestamp(365),
    createdAt: nowTimestamp(),
  })

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 365)

  return {
    inviteCode,
    expiresAt: expiresAt.toISOString(),
    orgId,
  }
}

export async function findOrganization(orgId: string) {
  const orgRef = getOrganizationRef(orgId)
  const orgSnap = await orgRef.get()
  return orgSnap.exists ? { ref: orgRef, data: orgSnap.data()! } : null
}

export async function findOrgMember(orgId: string, uid: string) {
  const memberRef = getOrgMemberRef(orgId, uid)
  const memberSnap = await memberRef.get()
  return memberSnap.exists ? { ref: memberRef, data: memberSnap.data()! } : null
}

export async function createOrgMembership(orgId: string, uid: string, role: string) {
  const memberRef = getOrgMemberRef(orgId, uid)
  await memberRef.set({
    role,
    status: 'active',
    joinedAt: nowTimestamp(),
  })
}

export async function upsertSpecialist(uid: string, email: string, orgId: string, role: string) {
  const specialistRef = getSpecialistRef(uid)
  const specialistSnap = await specialistRef.get()
  const now = nowTimestamp()

  if (specialistSnap.exists) {
    await specialistRef.update({
      orgId,
      role,
      updatedAt: now,
    })
  } else {
    await specialistRef.set({
      uid,
      email,
      fullName: email.split('@')[0] || 'Specialist',
      name: email.split('@')[0] || 'Specialist',
      orgId,
      role,
      createdAt: now,
      updatedAt: now,
    })
  }
}

export async function linkChildToOrg(
  childId: string,
  orgId: string,
  parentUid: string,
  specialistId: string
) {
  const orgChildRef = getOrgChildRef(orgId, childId)
  const orgChildSnap = await orgChildRef.get()
  const now = nowTimestamp()

  // Store parent UID and specialist ID in org child link
  if (!orgChildSnap.exists) {
    await orgChildRef.set({
      assigned: true,
      assignedAt: now,
      childId,
      parentUid,
      assignedSpecialistId: specialistId,
    })
  } else {
    await orgChildRef.update({
      assigned: true,
      assignedAt: now,
      parentUid,
      assignedSpecialistId: specialistId,
    })
  }

  // Update child's organizationId and parentUid
  const childRef = getChildRef(childId)
  const childSnap = await childRef.get()

  if (childSnap.exists) {
    await childRef.update({
      organizationId: orgId,
      parentUid,
      updatedAt: now,
    })
  }

  // Create/update authenticated parent record
  await upsertParent(parentUid, orgId, childId)
}

export async function upsertParent(parentUid: string, orgId: string, childId: string) {
  const parentRef = getParentRef(parentUid)
  const parentSnap = await parentRef.get()
  const now = nowTimestamp()

  // Get organization name
  const org = await findOrganization(orgId)
  const orgName = org?.data?.name || 'Organization'

  if (parentSnap.exists) {
    const parentData = parentSnap.data()!
    const linkedOrgs = parentData.linkedOrganizations || []
    const linkedChildren = parentData.linkedChildren || []

    // Check if org is already linked
    const orgAlreadyLinked = linkedOrgs.some((o: any) => o.orgId === orgId)
    if (!orgAlreadyLinked) {
      linkedOrgs.push({
        orgId,
        orgName,
        linkedAt: now,
      })
    }

    // Check if child is already linked
    if (!linkedChildren.includes(childId)) {
      linkedChildren.push(childId)
    }

    await parentRef.update({
      linkedOrganizations: linkedOrgs,
      linkedChildren,
      updatedAt: now,
    })
  } else {
    await parentRef.set({
      uid: parentUid,
      linkedOrganizations: [
        {
          orgId,
          orgName,
          linkedAt: now,
        },
      ],
      linkedChildren: [childId],
      createdAt: now,
      updatedAt: now,
    })
  }
}

export async function findOrCreatePersonalOrg(uid: string, name: string, email: string) {
  const db = getFirestore()
  const orgsSnapshot = await getOrganizationsRef().where('ownerId', '==', uid).limit(1).get()

  if (!orgsSnapshot.empty) {
    return orgsSnapshot.docs[0].id
  }

  const now = nowTimestamp()
  const orgRef = getOrganizationsRef().doc()
  const orgId = orgRef.id

  await orgRef.set({
    name: `${name}'s Practice`,
    type: 'personal',
    ownerId: uid,
    createdAt: now,
    updatedAt: now,
  })

  // Create membership
  const memberRef = orgRef.collection('members').doc(uid)
  await memberRef.set({
    role: 'admin',
    status: 'active',
    joinedAt: now,
  })

  return orgId
}
