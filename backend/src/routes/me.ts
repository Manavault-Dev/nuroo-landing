import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'

import { getFirestore } from '../infrastructure/database/firebase.js'
import type { SpecialistProfile } from '../types.js'
import { z } from 'zod'

const COLLECTIONS = {
  SPECIALISTS: 'specialists',
  ORGANIZATIONS: 'organizations',
  ORG_MEMBERS: (orgId: string) => `organizations/${orgId}/members`,
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
  return role === 'org_admin' ? 'admin' : 'specialist'
}

async function findOrganizationsForUser(
  db: admin.firestore.Firestore,
  uid: string
): Promise<Array<{ orgId: string; orgName: string; role: 'admin' | 'specialist' }>> {
  const orgsSnapshot = await db.collection(COLLECTIONS.ORGANIZATIONS).get()
  const organizations: Array<{ orgId: string; orgName: string; role: 'admin' | 'specialist' }> = []

  for (const orgDoc of orgsSnapshot.docs) {
    const orgId = orgDoc.id
    const orgData = orgDoc.data()

    const memberRef = db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${uid}`)
    const memberSnap = await memberRef.get()

    if (!memberSnap.exists) continue

    const memberData = memberSnap.data()
    if (memberData?.status !== 'active') continue

    organizations.push({
      orgId,
      orgName: orgData.name || orgId,
      role: normalizeRole(memberData.role),
    })
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

    const organizations = await findOrganizationsForUser(db, uid)

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
