import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import type { SpecialistProfile } from '../../types.js'
import { z } from 'zod'

const COLLECTIONS = {
  SPECIALISTS: 'specialists',
  ORGANIZATIONS: 'organizations',
  ORG_MEMBERS: (orgId: string) => `organizations/${orgId}/members`,
  USER_ORGS: (uid: string) => `specialists/${uid}/organizations`,
} as const

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

function extractName(
  specialistData: admin.firestore.DocumentData | null | undefined,
  email: string | undefined
): string {
  if (specialistData?.fullName) return specialistData.fullName
  if (specialistData?.name) return specialistData.name
  return email?.split('@')[0] || 'Specialist'
}

function normalizeRole(role: string): 'admin' | 'specialist' {
  return role === 'org_admin' || role === 'admin' ? 'admin' : 'specialist'
}

function denormalizeRole(role: 'admin' | 'specialist'): 'org_admin' | 'specialist' {
  return role === 'admin' ? 'org_admin' : 'specialist'
}

async function findOrganizationsForUser(
  db: admin.firestore.Firestore,
  uid: string,
  isUserSuperAdmin: boolean
): Promise<
  Array<{ orgId: string; orgName: string; country?: string | null; role: 'admin' | 'specialist' }>
> {
  const organizations: Array<{
    orgId: string
    orgName: string
    country?: string | null
    role: 'admin' | 'specialist'
  }> = []
  const seenOrgIds = new Set<string>()

  const addOrganization = (
    orgId: string,
    orgData: admin.firestore.DocumentData,
    role: 'admin' | 'specialist'
  ) => {
    if (seenOrgIds.has(orgId)) return
    seenOrgIds.add(orgId)
    organizations.push({
      orgId,
      orgName: orgData.name || orgId,
      country: orgData.country ?? null,
      role,
    })
  }

  const writeMembershipIndex = async (
    orgId: string,
    orgData: admin.firestore.DocumentData,
    role: 'admin' | 'specialist'
  ) => {
    const now = admin.firestore.Timestamp.now()
    await Promise.allSettled([
      db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${uid}`).set(
        {
          uid,
          role: denormalizeRole(role),
          status: 'active',
          updatedAt: now,
        },
        { merge: true }
      ),
      db.doc(`${COLLECTIONS.USER_ORGS(uid)}/${orgId}`).set(
        {
          orgId,
          orgName: orgData.name || orgId,
          country: orgData.country ?? null,
          role: denormalizeRole(role),
          status: 'active',
          updatedAt: now,
        },
        { merge: true }
      ),
    ])
  }

  if (isUserSuperAdmin) {
    const createdOrgsSnapshot = await db
      .collection(COLLECTIONS.ORGANIZATIONS)
      .where('createdBy', '==', uid)
      .get()

    for (const orgDoc of createdOrgsSnapshot.docs) {
      addOrganization(orgDoc.id, orgDoc.data(), 'admin')
    }
  }

  // Strategy 0: fast per-user membership index. Avoids collectionGroup and org scans.
  try {
    const indexedSnapshot = await db
      .collection(COLLECTIONS.USER_ORGS(uid))
      .where('status', '==', 'active')
      .get()

    if (!indexedSnapshot.empty) {
      const indexedEntries = await Promise.all(
        indexedSnapshot.docs.map(async (membershipDoc) => {
          const membershipData = membershipDoc.data()
          const orgId = (membershipData.orgId as string | undefined) || membershipDoc.id
          const orgSnap = await db.doc(`${COLLECTIONS.ORGANIZATIONS}/${orgId}`).get()
          if (!orgSnap.exists) return null

          return {
            orgId,
            orgData: orgSnap.data()!,
            role: normalizeRole(membershipData.role),
          }
        })
      )

      for (const entry of indexedEntries) {
        if (!entry) continue
        addOrganization(entry.orgId, entry.orgData, entry.role)
      }

      return organizations
    }
  } catch (err) {
    console.warn('[me] Strategy 0 (user org index) failed:', err)
  }

  // Strategy 1: efficient indexed query (requires uid field on member docs + composite index)
  let memberDocs: admin.firestore.QueryDocumentSnapshot[] = []
  try {
    const snapshot = await db
      .collectionGroup('members')
      .where('status', '==', 'active')
      .where('uid', '==', uid)
      .get()
    memberDocs = snapshot.docs
  } catch (err) {
    console.warn('[me] Strategy 1 (uid index) failed:', err)
  }

  // Strategy 2: status-only collection-group query, filter by doc.id in JS
  if (memberDocs.length === 0) {
    try {
      const snapshot = await db.collectionGroup('members').where('status', '==', 'active').get()
      memberDocs = snapshot.docs.filter((doc) => doc.id === uid)
    } catch (err) {
      console.warn('[me] Strategy 2 (status filter) failed:', err)
    }
  }

  // Strategy 3: scan all orgs and check each member sub-doc directly — no index needed
  if (memberDocs.length === 0) {
    console.warn('[me] Strategy 3: scanning organizations collection for uid:', uid)
    try {
      const orgsSnapshot = await db.collection(COLLECTIONS.ORGANIZATIONS).get()
      const directChecks = await Promise.all(
        orgsSnapshot.docs.map(async (orgDoc) => {
          const memberRef = db.doc(`${COLLECTIONS.ORGANIZATIONS}/${orgDoc.id}/members/${uid}`)
          const memberSnap = await memberRef.get()
          if (!memberSnap.exists) return null
          const data = memberSnap.data()!
          if (data.status !== 'active') return null
          return {
            orgId: orgDoc.id,
            orgData: orgDoc.data(),
            role: normalizeRole(data.role),
          }
        })
      )
      for (const entry of directChecks) {
        if (!entry) continue
        addOrganization(entry.orgId, entry.orgData, entry.role)
        await writeMembershipIndex(entry.orgId, entry.orgData, entry.role)
      }
    } catch (err) {
      console.error('[me] Strategy 3 (direct scan) failed:', err)
    }
    return organizations
  }

  const orgEntries = await Promise.all(
    memberDocs.map(async (memberDoc) => {
      const memberData = memberDoc.data()
      const orgRef = memberDoc.ref.parent.parent
      if (!orgRef) return null

      const orgSnap = await orgRef.get()
      if (!orgSnap.exists) return null

      return {
        orgId: orgSnap.id,
        orgData: orgSnap.data()!,
        role: normalizeRole(memberData.role),
      }
    })
  )

  for (const entry of orgEntries) {
    if (!entry) continue
    addOrganization(entry.orgId, entry.orgData, entry.role)
    await writeMembershipIndex(entry.orgId, entry.orgData, entry.role)
  }

  return organizations
}

function buildProfileUpdateData(name: string, now: Date) {
  return {
    fullName: name,
    name,
    updatedAt: admin.firestore.Timestamp.fromDate(now),
  }
}

function buildNewProfileData(uid: string, email: string | undefined, name: string, now: Date) {
  return {
    uid,
    email: email || '',
    fullName: name,
    name,
    createdAt: admin.firestore.Timestamp.fromDate(now),
    updatedAt: admin.firestore.Timestamp.fromDate(now),
  }
}

export const meRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid, email } = request.user

    const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${uid}`)
    const specialistSnap = await specialistRef.get()
    const specialistData = specialistSnap.exists ? specialistSnap.data() : null
    const name = extractName(specialistData, email)

    const isUserSuperAdmin = request.user?.claims?.superAdmin === true
    const organizations = await findOrganizationsForUser(db, uid, isUserSuperAdmin)

    const profile: SpecialistProfile = {
      uid,
      email: email || '',
      name,
      organizations,
    }

    return profile
  })

  fastify.post<{ Body: z.infer<typeof updateProfileSchema> }>('/me', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid, email } = request.user
    const body = updateProfileSchema.parse(request.body)
    const now = new Date()

    const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${uid}`)
    const specialistSnap = await specialistRef.get()

    if (specialistSnap.exists) {
      if (body.name) {
        await specialistRef.update(buildProfileUpdateData(body.name, now))
      }

      const data = (await specialistRef.get()).data()
      return {
        ok: true,
        specialist: {
          uid,
          email: email || '',
          name: extractName(data, email),
        },
      }
    }

    const name = body.name || email?.split('@')[0] || 'Specialist'
    const newData = buildNewProfileData(uid, email, name, now)
    await specialistRef.set(newData)

    return {
      ok: true,
      specialist: { uid, email: email || '', name: newData.fullName },
    }
  })
}
