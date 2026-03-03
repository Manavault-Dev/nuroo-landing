import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import admin from 'firebase-admin'

import { getFirestore } from '../infrastructure/database/firebase.js'
import { config } from '../config.js'
import type { SpecialistProfile } from '../types.js'
import { z } from 'zod'

const COLLECTIONS = {
  SPECIALISTS: 'specialists',
  ORGANIZATIONS: 'organizations',
  ORG_MEMBERS: (orgId: string) => `organizations/${orgId}/members`,
} as const

const DEV_SUPER_ADMIN_WHITELIST = ['nuroo@gmail.com']

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

function isSuperAdmin(request: FastifyRequest): boolean {
  if (!request.user) return false

  const userEmail = (request.user.email || '').toLowerCase().trim()
  const hasClaim = request.user.claims?.superAdmin === true

  const isWhitelisted =
    config.NODE_ENV !== 'production' &&
    DEV_SUPER_ADMIN_WHITELIST.some((email) => email.toLowerCase().trim() === userEmail)

  return hasClaim || isWhitelisted
}

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

  if (isUserSuperAdmin) {
    const createdOrgsSnapshot = await db
      .collection(COLLECTIONS.ORGANIZATIONS)
      .where('createdBy', '==', uid)
      .get()

    for (const orgDoc of createdOrgsSnapshot.docs) {
      addOrganization(orgDoc.id, orgDoc.data(), 'admin')
    }
  }

  try {
    const membershipsSnapshot = await db
      .collectionGroup('members')
      .where(admin.firestore.FieldPath.documentId(), '==', uid)
      .get()

    const orgEntries = await Promise.all(
      membershipsSnapshot.docs.map(async (memberDoc) => {
        const memberData = memberDoc.data()
        if (memberData?.status !== 'active') return null

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
    }
  } catch (error) {
    console.warn('[ME] Falling back to full organization scan:', error)

    const orgsSnapshot = await db.collection(COLLECTIONS.ORGANIZATIONS).get()

    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id
      if (seenOrgIds.has(orgId)) continue

      const memberRef = db.doc(`${COLLECTIONS.ORG_MEMBERS(orgId)}/${uid}`)
      const memberSnap = await memberRef.get()

      if (!memberSnap.exists) continue

      const memberData = memberSnap.data()
      if (memberData?.status !== 'active') continue

      addOrganization(orgId, orgDoc.data(), normalizeRole(memberData.role))
    }
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

    const userIsSuperAdmin = isSuperAdmin(request)
    const organizations = await findOrganizationsForUser(db, uid, userIsSuperAdmin)

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
