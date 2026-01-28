import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'

import { getFirestore } from '../firebaseAdmin.js'
import { requireOrgMember } from '../plugins/rbac.js'

const COLLECTIONS = {
  ORG_MEMBERS: (orgId: string) => `organizations/${orgId}/members`,
  SPECIALISTS: 'specialists',
} as const

function isActiveMember(memberData: admin.firestore.DocumentData): boolean {
  return !memberData.status || memberData.status === 'active'
}

function normalizeRole(role: string): 'admin' | 'specialist' {
  return role === 'org_admin' ? 'admin' : 'specialist'
}

function extractJoinedAt(memberData: admin.firestore.DocumentData): Date {
  return memberData.joinedAt?.toDate?.() || memberData.addedAt?.toDate?.() || new Date()
}

async function getSpecialistProfile(
  db: admin.firestore.Firestore,
  specialistUid: string
): Promise<admin.firestore.DocumentData | null> {
  const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${specialistUid}`)
  const specialistSnap = await specialistRef.get()
  return specialistSnap.exists ? specialistSnap.data() || null : null
}

function transformTeamMember(
  doc: admin.firestore.QueryDocumentSnapshot,
  specialistData: admin.firestore.DocumentData | null
) {
  const memberData = doc.data()
  const specialistUid = doc.id

  return {
    uid: specialistUid,
    email: specialistData?.email || '',
    name: specialistData?.fullName || specialistData?.name || 'Unknown',
    role: normalizeRole(memberData.role) as 'admin' | 'specialist',
    joinedAt: extractJoinedAt(memberData),
  }
}

export const teamRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/team', async (request, reply) => {
    try {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)

      if (member.role !== 'org_admin') {
        return reply.code(403).send({
          error: 'Only organization admins can view team members',
        })
      }

      const db = getFirestore()
      const membersSnapshot = await db.collection(COLLECTIONS.ORG_MEMBERS(orgId)).get()

      const activeMembers = membersSnapshot.docs.filter((doc) => isActiveMember(doc.data()))

      const teamMembers = await Promise.all(
        activeMembers.map(async (doc) => {
          const specialistUid = doc.id
          const specialistData = await getSpecialistProfile(db, specialistUid)
          return transformTeamMember(doc, specialistData)
        })
      )

      return teamMembers
    } catch (error: any) {
      console.error('[TEAM] Error fetching team members:', error)
      return reply.code(500).send({
        error: 'Failed to fetch team members',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      })
    }
  })
}
