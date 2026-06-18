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
    const specialistSnap = await db.doc(`${COLLECTIONS.SPECIALISTS}/${uid}`).get()
    const orgId = specialistSnap.data()?.orgId as string | undefined

    if (orgId) {
      const [orgSnap, memberSnap] = await Promise.all([
        db.doc(`${COLLECTIONS.ORGANIZATIONS}/${orgId}`).get(),
        db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${uid}`).get(),
      ])

      if (orgSnap.exists) {
        const memberData = memberSnap.exists ? memberSnap.data() : null
        const role =
          memberData?.status === 'active'
            ? memberData.role || 'specialist'
            : orgSnap.data()?.createdBy === uid
              ? 'org_admin'
              : null

        if (role) {
          await Promise.allSettled([
            db
              .doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${uid}`)
              .set({ uid, role, status: 'active' }, { merge: true }),
            db.doc(`${COLLECTIONS.USER_ORGS(uid)}/${orgId}`).set(
              {
                orgId,
                orgName: orgSnap.data()?.name || orgId,
                country: orgSnap.data()?.country ?? null,
                role,
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
    console.warn('[session] specialist org pointer lookup failed:', err)
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
