import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../firebaseAdmin.js'
import { requireOrgMember } from '../plugins/rbac.js'

const COLLECTIONS = {
  ORG_PARENTS: (orgId: string) => `organizations/${orgId}/parents`,
  ORG_PARENTS_REAL: (orgId: string) => `orgParents/${orgId}/parents`,
  ORG_CHILDREN: (orgId: string) => `organizations/${orgId}/children`,
} as const

async function fetchParentAuthData(parentUid: string) {
  try {
    const auth = admin.auth()
    const parentUser = await auth.getUser(parentUid)
    return {
      email: parentUser.email || null,
      displayName: parentUser.displayName || null,
    }
  } catch (error: any) {
    return {
      email: null,
      displayName: null,
    }
  }
}

async function countLinkedChildren(
  db: admin.firestore.Firestore,
  orgId: string,
  parentUid: string
) {
  const childrenSnapshot = await db
    .collection(COLLECTIONS.ORG_CHILDREN(orgId))
    .where('parentUserId', '==', parentUid)
    .get()

  return childrenSnapshot.docs.length
}

function transformLegacyParent(doc: admin.firestore.QueryDocumentSnapshot) {
  const data = doc.data()
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate()?.toISOString() || null,
  }
}

async function transformRealParent(
  db: admin.firestore.Firestore,
  orgId: string,
  doc: admin.firestore.QueryDocumentSnapshot
) {
  const data = doc.data()
  const parentUid = doc.id
  const authData = await fetchParentAuthData(parentUid)
  const linkedChildrenCount = await countLinkedChildren(db, orgId, parentUid)

  return {
    id: parentUid,
    parentUserId: parentUid,
    name: authData.displayName || data.name || 'Unknown',
    email: authData.email || data.email || null,
    phone: data.phone || null,
    linkedSpecialistUid: data.linkedSpecialistUid || null,
    linkedChildrenCount,
    joinedAt: data.joinedAt?.toDate?.()?.toISOString() || null,
    createdAt:
      data.createdAt?.toDate?.()?.toISOString() || data.joinedAt?.toDate?.()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
  }
}

function mergeParents(realParents: any[], legacyParents: any[]) {
  const realParentIds = new Set(realParents.map((p) => p.id))
  const uniqueLegacyParents = legacyParents.filter((p) => !realParentIds.has(p.id))
  return [...realParents, ...uniqueLegacyParents]
}

export const parentsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/parents', async (request, reply) => {
    try {
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)

      const db = getFirestore()

      const legacyParentsSnap = await db.collection(COLLECTIONS.ORG_PARENTS(orgId)).get()

      const legacyParents = legacyParentsSnap.docs.map(transformLegacyParent)

      let realParentsSnap
      try {
        realParentsSnap = await db.collection(COLLECTIONS.ORG_PARENTS_REAL(orgId)).get()
      } catch (error: any) {
        realParentsSnap = { docs: [] }
      }

      const realParents = await Promise.all(
        realParentsSnap.docs.map((doc) => transformRealParent(db, orgId, doc))
      )

      const allParents = mergeParents(realParents, legacyParents)

      return { ok: true, parents: allParents }
    } catch (error: any) {
      console.error('[PARENTS] Error fetching parents:', error)
      return reply.code(500).send({
        error: 'Failed to fetch parent contacts',
        details: error.message,
      })
    }
  })
}
