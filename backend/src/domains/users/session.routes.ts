import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'

import { getFirestore } from '../../infrastructure/database/firebase.js'

const COLLECTIONS = {
  SPECIALISTS: 'specialists',
  ORGANIZATIONS: 'organizations',
  ORG_MEMBERS: (orgId: string) => `organizations/${orgId}/members`,
  USER_ORGS: (uid: string) => `specialists/${uid}/organizations`,
} as const

async function findActiveOrganization(
  db: admin.firestore.Firestore,
  uid: string
): Promise<string | null> {
  const indexedSnapshot = await db
    .collection(COLLECTIONS.USER_ORGS(uid))
    .where('status', '==', 'active')
    .limit(1)
    .get()

  if (!indexedSnapshot.empty) {
    return (
      (indexedSnapshot.docs[0].data().orgId as string | undefined) || indexedSnapshot.docs[0].id
    )
  }

  try {
    const memberSnapshot = await db
      .collectionGroup('members')
      .where('uid', '==', uid)
      .limit(1)
      .get()
    const activeMemberDoc = memberSnapshot.docs.find((doc) => doc.data().status === 'active')

    if (activeMemberDoc) {
      const orgRef = activeMemberDoc.ref.parent.parent
      if (orgRef) {
        const orgSnap = await orgRef.get()
        if (orgSnap.exists) {
          const orgId = orgSnap.id
          const data = activeMemberDoc.data()
          await Promise.allSettled([
            db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${uid}`).set({ uid }, { merge: true }),
            db.doc(`${COLLECTIONS.USER_ORGS(uid)}/${orgId}`).set(
              {
                orgId,
                orgName: orgSnap.data()?.name || orgId,
                country: orgSnap.data()?.country ?? null,
                role: data.role || 'specialist',
                status: 'active',
                updatedAt: admin.firestore.Timestamp.now(),
              },
              { merge: true }
            ),
          ])
          return orgId
        }
      }
    }
  } catch (err) {
    console.warn('[session] uid-only member lookup failed:', err)
  }

  const orgsSnapshot = await db.collection(COLLECTIONS.ORGANIZATIONS).get()

  for (const orgDoc of orgsSnapshot.docs) {
    const orgId = orgDoc.id
    const memberRef = db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${uid}`)
    const memberSnap = await memberRef.get()

    if (memberSnap.exists && memberSnap.data()?.status === 'active') {
      const data = memberSnap.data()!
      await Promise.allSettled([
        memberRef.set({ uid }, { merge: true }),
        db.doc(`${COLLECTIONS.USER_ORGS(uid)}/${orgId}`).set(
          {
            orgId,
            orgName: orgDoc.data().name || orgId,
            country: orgDoc.data().country ?? null,
            role: data.role || 'specialist',
            status: 'active',
            updatedAt: admin.firestore.Timestamp.now(),
          },
          { merge: true }
        ),
      ])
      return orgId
    }
  }

  return null
}

export const sessionRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/session', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid } = request.user

    const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${uid}`)
    const specialistSnap = await specialistRef.get()

    if (!specialistSnap.exists) {
      return { ok: true, hasOrg: false }
    }

    const orgId = await findActiveOrganization(db, uid)

    if (orgId) {
      return { ok: true, orgId, hasOrg: true }
    }

    return { ok: true, hasOrg: false }
  })
}
