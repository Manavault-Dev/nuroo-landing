import admin from 'firebase-admin'
import {
  getOrganizationsRef,
  getOrganizationRef,
  getInvitesRef,
  getInviteRef,
} from '../../infrastructure/database/collections.js'
import { getAuth } from '../../infrastructure/database/firebase.js'
import { nowTimestamp, toISOString, toTimestamp } from '../../shared/utils/timestamp.js'
import { generateInviteCode } from '../../shared/utils/inviteCode.js'
import type { CreateOrgInput, CreateAdminInviteInput } from './admin.schema.js'

export async function findOrganizationsByCreator(uid: string) {
  let orgsSnapshot

  interface OrgData {
    name: string
    country?: string | null
    createdAt: admin.firestore.Timestamp | null
    createdBy?: string | null
    isActive?: boolean
  }

  try {
    orgsSnapshot = await getOrganizationsRef()
      .where('createdBy', '==', uid)
      .orderBy('createdAt', 'desc')
      .get()
  } catch (error: unknown) {
    // If orderBy fails (missing index), try without orderBy
    const err = error as { code?: number; message?: string }
    if (err.code === 9 || err.message?.includes('index')) {
      console.warn('[ADMIN] Index missing, fetching without orderBy')
      orgsSnapshot = await getOrganizationsRef().where('createdBy', '==', uid).get()

      // Sort manually
      const docs = orgsSnapshot.docs.sort((a, b) => {
        const aTime = a.data().createdAt?.toDate?.()?.getTime() || 0
        const bTime = b.data().createdAt?.toDate?.()?.getTime() || 0
        return bTime - aTime
      })
      orgsSnapshot = { docs } as admin.firestore.QuerySnapshot<admin.firestore.DocumentData>
    } else {
      throw error
    }
  }

  return orgsSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot<OrgData>) => {
    const data = doc.data()
    return {
      orgId: doc.id,
      name: data.name || 'Unnamed Organization',
      country: data.country || null,
      createdAt: toISOString(data.createdAt),
      createdBy: data.createdBy || null,
      isActive: data.isActive !== false,
    }
  })
}

export async function createOrganization(uid: string, input: CreateOrgInput) {
  // Check if org with same name already exists for this admin
  const existingOrgs = await getOrganizationsRef()
    .where('name', '==', input.name)
    .where('createdBy', '==', uid)
    .limit(1)
    .get()

  if (!existingOrgs.empty) {
    return { error: 'You already have an organization with this name', code: 400 }
  }

  const orgRef = getOrganizationsRef().doc()
  const orgId = orgRef.id
  const now = nowTimestamp()

  const orgData = {
    name: input.name,
    country: input.country || null,
    createdAt: now,
    createdBy: uid,
    isActive: true,
    billingPlan: null,
  }

  await orgRef.set(orgData)

  console.log(`[ADMIN] Created organization: ${orgId} (${input.name}) by ${uid}`)

  return {
    ok: true,
    orgId,
    name: input.name,
    country: input.country || null,
  }
}

export async function findOrganization(orgId: string) {
  const orgRef = getOrganizationRef(orgId)
  const orgSnap = await orgRef.get()
  return orgSnap.exists ? orgSnap.data()! : null
}

export async function createAdminInvite(
  uid: string,
  input: CreateAdminInviteInput,
  frontendUrl: string
) {
  const org = await findOrganization(input.orgId)

  if (!org) {
    return { error: 'Organization not found', code: 404 }
  }

  if (org.createdBy !== uid) {
    return { error: 'You can only create invites for organizations you created', code: 403 }
  }

  if (!org.isActive) {
    return { error: 'Organization is not active', code: 400 }
  }

  // Generate unique invite code
  let code: string
  let attempts = 0
  let isUnique = false
  while (!isUnique) {
    code = generateInviteCode()
    const existingInvite = await getInviteRef(code).get()
    if (!existingInvite.exists) {
      isUnique = true
      break
    }
    attempts++
    if (attempts > 10) {
      return { error: 'Failed to generate unique invite code', code: 500 }
    }
  }

  // Parse expiresAt if provided
  let expiresAt: admin.firestore.Timestamp | null = null
  if (input.expiresAt) {
    expiresAt = toTimestamp(new Date(input.expiresAt))
  }

  const inviteRef = getInviteRef(code)
  await inviteRef.set({
    orgId: input.orgId,
    role: input.role,
    createdBy: uid,
    createdAt: nowTimestamp(),
    expiresAt,
    maxUses: input.maxUses || null,
    usedCount: 0,
    isActive: true,
  })

  const inviteLink = `${frontendUrl}/b2b/register?code=${code}`

  console.log(`[ADMIN] Created invite: ${code} for org ${input.orgId} (${input.role}) by ${uid}`)

  return {
    ok: true,
    code,
    inviteLink,
    orgId: input.orgId,
    orgName: org.name,
    role: input.role,
    expiresAt: expiresAt?.toDate().toISOString() || null,
    maxUses: input.maxUses || null,
  }
}

export async function findInvitesByOrgIds(
  orgIds: string[],
  frontendUrl: string,
  limit: number = 50
) {
  if (orgIds.length === 0) {
    return []
  }

  const invitesPromises = orgIds.map(async (orgId) => {
    const invitesSnapshot = await getInvitesRef()
      .where('orgId', '==', orgId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    return invitesSnapshot.docs
  })

  const invitesDocs = (await Promise.all(invitesPromises)).flat()

  // Sort by createdAt descending
  invitesDocs.sort((a, b) => {
    const aTime = a.data().createdAt?.toDate?.()?.getTime() || 0
    const bTime = b.data().createdAt?.toDate?.()?.getTime() || 0
    return bTime - aTime
  })

  // Limit to most recent
  const limitedDocs = invitesDocs.slice(0, limit)

  const invites = await Promise.all(
    limitedDocs.map(async (doc) => {
      const data = doc.data()
      const org = await findOrganization(data.orgId)

      return {
        code: doc.id,
        inviteLink: `${frontendUrl}/b2b/register?code=${doc.id}`,
        orgId: data.orgId,
        orgName: org?.name || 'Unknown',
        role: data.role,
        expiresAt: toISOString(data.expiresAt),
        maxUses: data.maxUses || null,
        usedCount: data.usedCount || 0,
        isActive: data.isActive !== false,
        createdAt: toISOString(data.createdAt),
      }
    })
  )

  return invites
}

export async function listSuperAdmins() {
  const auth = getAuth()
  const listUsersResult = await auth.listUsers(1000)

  return listUsersResult.users
    .filter((user) => user.customClaims?.superAdmin === true)
    .map((user) => ({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || null,
      createdAt: user.metadata.creationTime,
      lastSignIn: user.metadata.lastSignInTime,
    }))
}

export async function grantSuperAdmin(email: string) {
  const auth = getAuth()
  const user = await auth.getUserByEmail(email)
  await auth.setCustomUserClaims(user.uid, { superAdmin: true })

  return {
    uid: user.uid,
    email: user.email,
  }
}

export async function revokeSuperAdmin(uid: string) {
  const auth = getAuth()
  const user = await auth.getUser(uid)

  const currentClaims = user.customClaims || {}
  if (!currentClaims.superAdmin) {
    return { error: 'User is not a Super Admin', code: 400 }
  }

  const { superAdmin: _superAdmin, ...restClaims } = currentClaims
  await auth.setCustomUserClaims(uid, restClaims)

  return {
    uid,
    email: user.email,
  }
}
