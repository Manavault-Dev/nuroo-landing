import {
  createOrgInvite,
  findOrgInvite,
  findInvite,
  findParentInvite,
  incrementInviteUsage,
  createParentInvite,
  findOrganization,
  findOrgMember,
  createOrgMembership,
  upsertSpecialist,
  linkChildToOrg,
  findOrCreatePersonalOrg,
} from './invites.repository.js'
import { findSpecialist, createSpecialist } from '../users/users.repository.js'
import { getSpecialistRef } from '../../infrastructure/database/collections.js'
import { isExpired } from '../../shared/utils/timestamp.js'
import type { CreateOrgInviteInput, JoinOrgInput, AcceptInviteInput } from './invites.schema.js'

export async function createSpecialistOrgInvite(
  orgId: string,
  createdBy: string,
  input: CreateOrgInviteInput
) {
  return createOrgInvite(orgId, input.role, createdBy, input.expiresInDays, input.maxUses)
}

export async function joinOrganization(uid: string, email: string, input: JoinOrgInput) {
  const invite = await findOrgInvite(input.inviteCode)

  if (!invite) {
    return { error: 'Invalid invite code', code: 404 }
  }

  const { data: inviteData, ref: inviteRef } = invite
  const orgId = inviteData.orgId as string
  const role = (inviteData.role as 'specialist' | 'admin') || 'specialist'

  // Check expiration
  if (inviteData.expiresAt && isExpired(inviteData.expiresAt)) {
    return { error: 'Invite code has expired', code: 400 }
  }

  // Check max uses
  const maxUses = inviteData.maxUses as number | undefined
  const usedCount = (inviteData.usedCount as number) || 0
  if (maxUses !== undefined && usedCount >= maxUses) {
    return { error: 'Invite code has reached maximum usage', code: 400 }
  }

  // Verify org exists
  const org = await findOrganization(orgId)
  if (!org) {
    return { error: 'Organization not found', code: 404 }
  }

  // Check if already a member
  const member = await findOrgMember(orgId, uid)
  if (member) {
    return { ok: true, orgId }
  }

  // Create membership
  await createOrgMembership(orgId, uid, role)

  // Upsert specialist
  await upsertSpecialist(uid, email || '', orgId, 'specialist')

  // Increment usage
  await incrementInviteUsage(inviteRef)

  return { ok: true, orgId }
}

export async function acceptInviteCode(uid: string, email: string, input: AcceptInviteInput) {
  const code = input.code.trim().toUpperCase()
  console.log(`[INVITES] User ${uid} attempting to accept code: ${code}`)

  const invite = await findInvite(code)

  if (!invite) {
    console.log(`[INVITES] Code not found: ${code}`)
    return { error: 'Invalid invite code', code: 404 }
  }

  const { data: inviteData, ref: inviteRef } = invite

  // Check if active
  if (!inviteData.isActive) {
    console.log(`[INVITES] Code inactive: ${code}`)
    return { error: 'Invite code is no longer active', code: 400 }
  }

  // Check expiration
  if (inviteData.expiresAt && isExpired(inviteData.expiresAt)) {
    console.log(`[INVITES] Code expired: ${code}`)
    return { error: 'Invite code has expired', code: 400 }
  }

  // Check max uses
  if (inviteData.maxUses && inviteData.usedCount >= inviteData.maxUses) {
    console.log(`[INVITES] Code max uses reached: ${code}`)
    return { error: 'Invite code has reached maximum uses', code: 400 }
  }

  const { orgId, role } = inviteData

  // Verify org exists and is active
  const org = await findOrganization(orgId)

  if (!org) {
    console.log(`[INVITES] Organization not found: ${orgId}`)
    return { error: 'Organization not found', code: 404 }
  }

  if (!org.data.isActive) {
    console.log(`[INVITES] Organization inactive: ${orgId}`)
    return { error: 'Organization is not active', code: 400 }
  }

  // Check existing membership
  const member = await findOrgMember(orgId, uid)

  if (member && member.data.status === 'active') {
    console.log(`[INVITES] User ${uid} already member of org ${orgId}`)
    return {
      ok: true,
      orgId,
      role: member.data.role,
      orgName: org.data.name,
      message: 'Already a member of this organization',
    }
  }

  // Handle role-based joining
  if (role === 'org_admin' || role === 'specialist') {
    await createOrgMembership(orgId, uid, role === 'org_admin' ? 'org_admin' : 'specialist')
    await upsertSpecialist(
      uid,
      email || '',
      orgId,
      role === 'org_admin' ? 'org_admin' : 'specialist'
    )

    console.log(`[INVITES] User ${uid} joined org ${orgId} as ${role}`)
  } else if (role === 'parent') {
    return {
      error:
        'Parent invites cannot be accepted through this endpoint. Parents are contact-only and do not authenticate. Please contact your organization admin to add parent contacts.',
      code: 400,
    }
  } else {
    return { error: 'Invalid role in invite', code: 400 }
  }

  // Increment usage
  await incrementInviteUsage(inviteRef)

  return {
    ok: true,
    orgId,
    role,
    orgName: org.data.name,
  }
}

export async function createSpecialistParentInvite(uid: string, email: string) {
  // Get or create specialist profile
  const specialist = await findSpecialist(uid)
  let specialistName = email?.split('@')[0] || 'Specialist'

  if (specialist) {
    specialistName = specialist.name || specialistName
  } else {
    await createSpecialist(uid, email || '', specialistName)
  }

  // Find or create personal org
  const orgId = await findOrCreatePersonalOrg(uid, specialistName, email || '')

  // Create parent invite
  const invite = await createParentInvite(uid, orgId)

  return { ok: true, ...invite }
}

export async function validateParentInviteCode(code: string) {
  const normalizedCode = code.trim().toUpperCase()
  const invite = await findParentInvite(normalizedCode)

  if (!invite) {
    return { error: 'Invalid invite code', code: 404 }
  }

  const { data: inviteData } = invite

  if (inviteData.expiresAt && isExpired(inviteData.expiresAt)) {
    return { error: 'Invite code has expired', code: 400 }
  }

  const specialistRef = getSpecialistRef(inviteData.specialistId)
  const specialistSnap = await specialistRef.get()

  if (!specialistSnap.exists) {
    return { error: 'Specialist not found', code: 404 }
  }

  const specialistData = specialistSnap.data()!
  const org = await findOrganization(inviteData.orgId)

  return {
    ok: true,
    valid: true,
    specialistId: inviteData.specialistId,
    specialistName: specialistData.name || 'Specialist',
    orgId: inviteData.orgId,
    orgName: org?.data?.name || 'Organization',
  }
}

export async function useParentInviteCode(code: string, childId: string, parentUid: string) {
  const normalizedCode = code.trim().toUpperCase()
  console.log('[ACCEPT] Looking for invite code:', normalizedCode, 'in collection: parentInvites')
  console.log('[ACCEPT] Parent UID:', parentUid, 'Child ID:', childId)

  const invite = await findParentInvite(normalizedCode)

  if (!invite) {
    console.log('[ACCEPT] Invite code not found:', normalizedCode)
    return { error: 'Invalid invite code', code: 404 }
  }

  const { data: inviteData, ref: inviteRef } = invite
  const specialistId = inviteData.specialistId as string
  console.log('[ACCEPT] Invite found:', { orgId: inviteData.orgId, specialistId })

  if (inviteData.expiresAt && isExpired(inviteData.expiresAt)) {
    return { error: 'Invite code has expired', code: 400 }
  }

  const orgId = inviteData.orgId as string

  // Link child to org with parent UID and specialist ID
  await linkChildToOrg(childId, orgId, parentUid, specialistId)

  // Increment usage
  await incrementInviteUsage(inviteRef)

  console.log('[ACCEPT] Successfully connected child to specialist with parentUid:', parentUid)

  return {
    ok: true,
    orgId,
    childId,
    parentUid,
    message: 'Child successfully connected to specialist',
  }
}
