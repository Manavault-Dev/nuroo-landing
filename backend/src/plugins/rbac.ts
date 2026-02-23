import { FastifyRequest, FastifyReply } from 'fastify'
import { getFirestore } from '../infrastructure/database/firebase.js'
import type { OrgMember } from '../types.js'
import { config } from '../config/index.js'

// TEMPORARY: Whitelist for dev mode
const DEV_SUPER_ADMIN_WHITELIST = ['nuroo@gmail.com']

/**
 * Check if user is Super Admin (by custom claim or whitelist)
 */
function isSuperAdmin(request: FastifyRequest): boolean {
  if (!request.user) return false

  const userEmail = (request.user.email || '').toLowerCase().trim()
  const hasClaim = request.user.claims?.superAdmin === true

  const isWhitelisted =
    config.NODE_ENV !== 'production' &&
    DEV_SUPER_ADMIN_WHITELIST.some((email) => email.toLowerCase().trim() === userEmail)

  return hasClaim || isWhitelisted
}

/**
 * Check if user is the creator of an organization
 */
async function isOrgCreator(orgId: string, uid: string): Promise<boolean> {
  const db = getFirestore()
  const orgRef = db.doc(`organizations/${orgId}`)
  const orgSnap = await orgRef.get()

  if (!orgSnap.exists) return false

  const orgData = orgSnap.data()
  return orgData?.createdBy === uid
}

export async function requireOrgMember(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string
): Promise<OrgMember> {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' }) as never
  }

  const db = getFirestore()
  const { uid } = request.user

  // Check if user is Super Admin and creator of this organization
  if (isSuperAdmin(request)) {
    const isCreator = await isOrgCreator(orgId, uid)
    if (isCreator) {
      console.log(`✅ [RBAC] Super Admin ${uid} is creator of org ${orgId}, granting full access`)
      // Return as org_admin for full access
      return {
        uid,
        role: 'org_admin',
        status: 'active',
        addedAt: new Date(),
      }
    }
  }

  // Normal membership check
  const memberRef = db.doc(`organizations/${orgId}/members/${uid}`)
  const memberSnap = await memberRef.get()

  if (!memberSnap.exists) {
    return reply.code(403).send({ error: 'Not a member of this organization' }) as never
  }

  const data = memberSnap.data()
  if (data?.status !== 'active') {
    return reply.code(403).send({ error: 'Member account is not active' }) as never
  }

  return {
    uid: request.user.uid,
    role: data.role || 'specialist',
    status: data.status,
    addedAt: data.addedAt?.toDate() || new Date(),
  }
}

/**
 * Check if user can access a child
 * Rules:
 * - Org Admin: Can access ALL children in their org
 * - Specialist: Can only access children assigned to them (assignedSpecialistId === their uid)
 */
export async function requireChildAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  childId: string
): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' }) as never
  }

  const db = getFirestore()
  const { uid } = request.user

  // Check if user is Super Admin and creator of this organization
  if (isSuperAdmin(request)) {
    const isCreator = await isOrgCreator(orgId, uid)
    if (isCreator) {
      console.log(`✅ [RBAC] Super Admin ${uid} is creator of org ${orgId}, granting child access`)
      // Verify child is assigned to org
      const childAssignmentRef = db.doc(`organizations/${orgId}/children/${childId}`)
      const assignmentSnap = await childAssignmentRef.get()

      if (!assignmentSnap.exists || assignmentSnap.data()?.assigned !== true) {
        return reply.code(404).send({ error: 'Child not assigned to this organization' }) as never
      }

      return // Super Admin creator has access
    }
  }

  // First check membership
  const memberRef = db.doc(`organizations/${orgId}/members/${uid}`)
  const memberSnap = await memberRef.get()

  if (!memberSnap.exists) {
    return reply.code(403).send({ error: 'Not a member of this organization' }) as never
  }

  const memberData = memberSnap.data()
  if (memberData?.status !== 'active') {
    return reply.code(403).send({ error: 'Member account is not active' }) as never
  }

  const role = memberData.role || 'specialist'

  // Org Admin can access all children
  if (role === 'org_admin') {
    // Verify child is assigned to org
    const childAssignmentRef = db.doc(`organizations/${orgId}/children/${childId}`)
    const assignmentSnap = await childAssignmentRef.get()

    if (!assignmentSnap.exists || assignmentSnap.data()?.assigned !== true) {
      return reply.code(404).send({ error: 'Child not assigned to this organization' }) as never
    }

    return // Org Admin has access
  }

  // Specialist: Check if child is assigned to them
  if (role === 'specialist') {
    const childAssignmentRef = db.doc(`organizations/${orgId}/children/${childId}`)
    const assignmentSnap = await childAssignmentRef.get()

    if (!assignmentSnap.exists) {
      return reply.code(404).send({ error: 'Child not assigned to this organization' }) as never
    }

    const assignmentData = assignmentSnap.data()
    if (assignmentData?.assigned !== true) {
      return reply.code(403).send({ error: 'Child assignment is inactive' }) as never
    }

    // Check if assigned to this specialist
    const assignedSpecialistId = assignmentData.assignedSpecialistId
    if (assignedSpecialistId && assignedSpecialistId !== uid) {
      return reply.code(403).send({ error: 'Child is not assigned to you' }) as never
    }

    // If no assignedSpecialistId, only Org Admin can access
    if (!assignedSpecialistId) {
      return reply.code(403).send({
        error: 'Child is not assigned to any specialist. Please contact your organization admin.',
      }) as never
    }

    return // Specialist has access
  }

  // Unknown role
  return reply.code(403).send({ error: 'Invalid role' }) as never
}

/**
 * @deprecated Use requireChildAccess instead
 * Kept for backward compatibility
 */
export async function requireChildAssigned(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  childId: string
): Promise<void> {
  return requireChildAccess(request, reply, orgId, childId)
}
