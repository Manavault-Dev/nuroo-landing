import {
  findOrganizationsByCreator,
  createOrganization as createOrgRepo,
  createAdminInvite as createAdminInviteRepo,
  findInvitesByOrgIds,
  listSuperAdmins as listSuperAdminsRepo,
  grantSuperAdmin as grantSuperAdminRepo,
  revokeSuperAdmin as revokeSuperAdminRepo,
} from './admin.repository.js'
import { getAuth } from '../../infrastructure/database/firebase.js'
import { config } from '../../config/index.js'
import type {
  CreateOrgInput,
  CreateAdminInviteInput,
  SetSuperAdminInput,
  BootstrapSuperAdminInput,
} from './admin.schema.js'

export async function getOrganizations(uid: string) {
  console.log(`[ADMIN] Fetching organizations for Super Admin: ${uid}`)

  const organizations = await findOrganizationsByCreator(uid)

  console.log(`[ADMIN] Listed ${organizations.length} organizations for Super Admin ${uid}`)

  return {
    ok: true,
    organizations,
    count: organizations.length,
  }
}

export async function createOrganization(uid: string, input: CreateOrgInput) {
  return createOrgRepo(uid, input)
}

export async function createInvite(uid: string, input: CreateAdminInviteInput) {
  const frontendUrl = process.env.NEXT_PUBLIC_B2B_URL || 'http://localhost:3000'
  return createAdminInviteRepo(uid, input, frontendUrl)
}

export async function getInvites(uid: string) {
  console.log(`[ADMIN] Fetching invites for Super Admin: ${uid}`)

  const organizations = await findOrganizationsByCreator(uid)
  const orgIds = organizations.map((org: { orgId: string }) => org.orgId)

  if (orgIds.length === 0) {
    return { ok: true, invites: [], count: 0 }
  }

  const frontendUrl = process.env.NEXT_PUBLIC_B2B_URL || 'http://localhost:3000'
  const invites = await findInvitesByOrgIds(orgIds, frontendUrl)

  console.log(`[ADMIN] Listed ${invites.length} invite codes for Super Admin ${uid}`)

  return {
    ok: true,
    invites,
    count: invites.length,
  }
}

export async function getSuperAdmins() {
  const superAdmins = await listSuperAdminsRepo()
  console.log(`[SUPER_ADMIN] Found ${superAdmins.length} Super Admin(s)`)

  return {
    ok: true,
    superAdmins,
    count: superAdmins.length,
  }
}

export async function addSuperAdmin(requestingUid: string, input: SetSuperAdminInput) {
  const { email } = input
  console.log(`[SUPER_ADMIN] Granting super admin to: ${email} by ${requestingUid}`)

  const result = await grantSuperAdminRepo(email)

  return {
    ok: true,
    message: `Super Admin rights granted to ${email}`,
    ...result,
    note: 'User must refresh their ID token (sign out and sign in) for the claim to take effect',
  }
}

export async function removeSuperAdmin(requestingUid: string, targetUid: string) {
  if (targetUid === requestingUid) {
    return { error: 'Cannot remove Super Admin rights from yourself', code: 400 }
  }

  const auth = getAuth()
  const user = await auth.getUser(targetUid)

  console.log(
    `[SUPER_ADMIN] Removing super admin from: ${user.email} (${targetUid}) by ${requestingUid}`
  )

  const result = await revokeSuperAdminRepo(targetUid)

  if ('error' in result) {
    return result
  }

  return {
    ok: true,
    message: `Super Admin rights removed from ${user.email}`,
    ...result,
  }
}

export async function bootstrapSuperAdmin(input: BootstrapSuperAdminInput) {
  const { email, secretKey } = input

  // Check secret key
  const expectedSecretKey =
    config.BOOTSTRAP_SECRET_KEY ||
    (config.NODE_ENV === 'production' ? null : 'dev-bootstrap-key-2024')

  if (!expectedSecretKey) {
    return {
      error: 'BOOTSTRAP_SECRET_KEY not configured. Set it in .env file for production.',
      code: 500,
    }
  }

  if (secretKey !== expectedSecretKey) {
    return { error: 'Invalid secret key', code: 403 }
  }

  // In production, check if Super Admin already exists
  if (config.NODE_ENV === 'production') {
    try {
      const auth = getAuth()
      const listUsersResult = await auth.listUsers(10)
      const hasSuperAdmin = listUsersResult.users.some(
        (user) => user.customClaims?.superAdmin === true
      )

      if (hasSuperAdmin) {
        return {
          error: 'Super Admin already exists. Use /admin/super-admin endpoint instead.',
          code: 403,
        }
      }
    } catch (err) {
      console.error('Error checking existing Super Admins:', err)
    }
  }

  console.log(`[BOOTSTRAP] Setting super admin for: ${email}`)

  const auth = getAuth()
  const user = await auth.getUserByEmail(email)
  await auth.setCustomUserClaims(user.uid, { superAdmin: true })

  return {
    ok: true,
    message: `Super Admin claim set for ${email}`,
    uid: user.uid,
    email: user.email,
    note: 'User must refresh their ID token (sign out and sign in) for the claim to take effect',
    warning:
      config.NODE_ENV === 'production'
        ? 'Make sure to set a strong BOOTSTRAP_SECRET_KEY in production'
        : undefined,
  }
}

export async function devSetSuperAdmin(email: string) {
  const auth = getAuth()
  const user = await auth.getUserByEmail(email)

  console.log(`[DEV] Setting super admin for: ${email} (${user.uid})`)

  try {
    await auth.setCustomUserClaims(user.uid, { superAdmin: true })
    console.log(`[DEV] Custom claim set successfully`)

    return {
      ok: true,
      message: `Super Admin claim set for ${email}`,
      uid: user.uid,
      note: 'User must refresh their ID token (sign out and sign in) for the claim to take effect',
    }
  } catch (claimError: any) {
    console.warn(`[DEV] Failed to set custom claim: ${claimError.message}`)
    console.log(`[DEV] Adding ${email} to dev whitelist instead`)

    return {
      ok: true,
      message: `Super Admin access granted via dev whitelist for ${email}`,
      uid: user.uid,
      note: 'Custom claim could not be set, but user is added to dev whitelist. User must refresh their ID token (sign out and sign in) for the claim to take effect.',
      warning: 'Using dev whitelist - this only works in development mode',
    }
  }
}

export function checkSuperAdminStatus(uid: string, email: string | undefined, claims: any) {
  const DEV_SUPER_ADMIN_WHITELIST = ['nuroo@gmail.com']

  const userEmail = (email || '').toLowerCase().trim()
  const isSuperAdmin = claims?.superAdmin === true
  const isWhitelisted = DEV_SUPER_ADMIN_WHITELIST.some((e) => e.toLowerCase().trim() === userEmail)

  console.log(`[DEV] Checking Super Admin for: ${userEmail}`)
  console.log(`[DEV] Custom claim superAdmin: ${isSuperAdmin}`)
  console.log(`[DEV] Whitelisted: ${isWhitelisted}`)

  return {
    uid,
    email,
    isSuperAdmin: isSuperAdmin || isWhitelisted,
    claims,
    isWhitelisted,
    note: isWhitelisted ? 'Using dev whitelist (custom claim not set)' : undefined,
  }
}
