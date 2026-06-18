import { FastifyRequest, FastifyReply } from 'fastify'
import {
  getFirestore,
  getOrganizationRef,
  getOrgMemberRef,
} from '../../infrastructure/database/collections.js'
import type { OrgMember } from '../types/common.js'

function normalizeOrgRole(role: unknown): OrgMember['role'] {
  return role === 'org_admin' || role === 'admin' ? 'org_admin' : 'specialist'
}

async function recoverIndexedMembership(orgId: string, uid: string): Promise<OrgMember | null> {
  const now = new Date()
  const db = getFirestore()
  const memberRef = getOrgMemberRef(orgId, uid)

  const orgSnap = await getOrganizationRef(orgId).get()
  if (orgSnap.exists && orgSnap.data()?.createdBy === uid) {
    await memberRef.set(
      {
        uid,
        role: 'org_admin',
        status: 'active',
        addedAt: now,
        updatedAt: now,
      },
      { merge: true }
    )

    return { uid, role: 'org_admin', status: 'active', addedAt: now }
  }

  const userOrgSnap = await db.doc(`specialists/${uid}/organizations/${orgId}`).get()
  const userOrgData = userOrgSnap.exists ? userOrgSnap.data() : null
  if (userOrgData?.status === 'active') {
    const role = normalizeOrgRole(userOrgData.role)
    const existingSnap = await memberRef.get()
    const existingRole = existingSnap.exists ? normalizeOrgRole(existingSnap.data()?.role) : null
    const finalRole: OrgMember['role'] = existingRole === 'org_admin' ? 'org_admin' : role
    await memberRef.set(
      { uid, role: finalRole, status: 'active', addedAt: now, updatedAt: now },
      { merge: true }
    )
    return { uid, role: finalRole, status: 'active', addedAt: now }
  }

  return null
}

export async function requireOrgMember(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string
): Promise<OrgMember> {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' }) as never
  }

  if (request.user.claims?.superAdmin === true) {
    return {
      uid: request.user.uid,
      role: 'org_admin',
      status: 'active',
      addedAt: new Date(),
    }
  }

  const memberRef = getOrgMemberRef(orgId, request.user.uid)
  const memberSnap = await memberRef.get()

  if (!memberSnap.exists) {
    const recoveredMember = await recoverIndexedMembership(orgId, request.user.uid)
    if (recoveredMember) return recoveredMember

    request.log.warn(
      { orgId, uid: request.user.uid },
      '[ORG_MEMBER_FORBIDDEN] User is not indexed as an organization member'
    )
    return reply.code(403).send({ error: 'Not a member of this organization' }) as never
  }

  const data = memberSnap.data()
  if (data?.status !== 'active') {
    const recoveredMember = await recoverIndexedMembership(orgId, request.user.uid)
    if (recoveredMember) return recoveredMember

    return reply.code(403).send({ error: 'Member account is not active' }) as never
  }

  const role = normalizeOrgRole(data.role)
  if (role !== 'org_admin') {
    const recoveredMember = await recoverIndexedMembership(orgId, request.user.uid)
    if (recoveredMember?.role === 'org_admin') return recoveredMember
  }

  return {
    uid: request.user.uid,
    role,
    status: data.status,
    addedAt: data.addedAt?.toDate() || new Date(),
  }
}

export async function requireOrgAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string
): Promise<OrgMember> {
  const member = await requireOrgMember(request, reply, orgId)

  if (member.role !== 'org_admin') {
    return reply
      .code(403)
      .send({ error: 'Only organization admins can perform this action' }) as never
  }

  return member
}
