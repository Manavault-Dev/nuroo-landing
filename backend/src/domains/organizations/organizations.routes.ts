import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../plugins/rbac.js'
import { FREE_TRIAL_DAYS, FREE_TRIAL_PLAN_ID } from '../../modules/payments/planLimits.js'
import { checkOrgHasFeature } from '../../modules/payments/planLimits.js'

// ─── orgs.ts ──────────────────────────────────────────────────────────────────

const createOrgSchema = z.object({
  name: z.string().trim().min(1).max(200),
  country: z.string().trim().max(100).optional(),
})

const updateOrgSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    country: z.string().trim().max(100).optional(),
  })
  .refine((body) => body.name !== undefined || body.country !== undefined, {
    message: 'At least one field (name or country) must be provided',
  })

export const orgsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof createOrgSchema> }>('/orgs', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid, email } = request.user
    const body = createOrgSchema.parse(request.body)
    const now = new Date()
    const trialExpiresAt = new Date(now)
    trialExpiresAt.setDate(trialExpiresAt.getDate() + FREE_TRIAL_DAYS)

    const existing = await db
      .collection('organizations')
      .where('createdBy', '==', uid)
      .where('name', '==', body.name)
      .limit(1)
      .get()

    if (!existing.empty) {
      return reply.code(400).send({ error: 'You already have an organization with this name' })
    }

    const orgRef = db.collection('organizations').doc()
    const orgId = orgRef.id

    await orgRef.set({
      name: body.name,
      country: body.country || null,
      createdAt: admin.firestore.Timestamp.fromDate(now),
      createdBy: uid,
      isActive: true,
      billingPlan: null,
      freeTrial: {
        planId: FREE_TRIAL_PLAN_ID,
        startedAt: admin.firestore.Timestamp.fromDate(now),
        expiresAt: admin.firestore.Timestamp.fromDate(trialExpiresAt),
      },
    })

    await orgRef
      .collection('members')
      .doc(uid)
      .set({
        uid,
        role: 'org_admin',
        status: 'active',
        joinedAt: admin.firestore.Timestamp.fromDate(now),
      })

    const specialistRef = db.doc(`specialists/${uid}`)
    const specialistSnap = await specialistRef.get()
    if (specialistSnap.exists) {
      await specialistRef.update({
        orgId,
        role: 'org_admin',
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      })
    } else {
      await specialistRef.set({
        uid,
        email: email || '',
        fullName: email?.split('@')[0] || 'Specialist',
        orgId,
        role: 'org_admin',
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      })
    }

    return {
      ok: true,
      orgId,
      name: body.name,
      country: body.country || null,
      role: 'org_admin',
    }
  })

  fastify.patch<{
    Params: { orgId: string }
    Body: z.infer<typeof updateOrgSchema>
  }>('/orgs/:orgId', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { orgId } = request.params
    const member = await requireOrgMember(request, reply, orgId)
    if (reply.sent) return

    if (member.role !== 'org_admin') {
      return reply.code(403).send({ error: 'Only organization admins can perform this action' })
    }

    const body = updateOrgSchema.parse(request.body)
    const db = getFirestore()
    const orgRef = db.doc(`organizations/${orgId}`)
    const orgSnap = await orgRef.get()

    if (!orgSnap.exists) {
      return reply.code(404).send({ error: 'Organization not found' })
    }

    const updateData: Record<string, unknown> = {
      updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
    }

    if (body.name !== undefined) updateData.name = body.name
    if (body.country !== undefined) updateData.country = body.country || null

    await orgRef.update(updateData)

    const updatedSnap = await orgRef.get()
    const data = updatedSnap.data()!

    return {
      ok: true,
      org: {
        id: updatedSnap.id,
        name: data.name,
        country: data.country ?? null,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        isActive: data.isActive ?? true,
        billingPlan: data.billingPlan ?? null,
      },
    }
  })
}

// ─── branches.ts ──────────────────────────────────────────────────────────────

const ORG_BRANCHES = (orgId: string) => `organizations/${orgId}/branches`

const branchSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  contactPerson: z.string().max(200).optional(),
})

function transformBranch(doc: admin.firestore.QueryDocumentSnapshot) {
  const data = doc.data()
  return {
    id: doc.id,
    name: data.name,
    address: data.address || null,
    phone: data.phone || null,
    contactPerson: data.contactPerson || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
  }
}

export const branchesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/branches', async (request, reply) => {
    try {
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)

      const db = getFirestore()
      let snapshot: admin.firestore.QuerySnapshot

      try {
        snapshot = await db.collection(ORG_BRANCHES(orgId)).orderBy('createdAt', 'desc').get()
      } catch {
        snapshot = await db.collection(ORG_BRANCHES(orgId)).get()
      }

      const branches = snapshot.docs.map(transformBranch)

      return { ok: true, branches, count: branches.length }
    } catch (error: any) {
      console.error('[BRANCHES] Error listing branches:', error)
      return reply.code(500).send({ error: 'Failed to list branches', details: error.message })
    }
  })

  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof branchSchema> }>(
    '/orgs/:orgId/branches',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const member = await requireOrgMember(request, reply, orgId)

        if (member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only org admins can create branches' })
        }

        const featureCheck = await checkOrgHasFeature(orgId, 'branches')
        if (!featureCheck.ok) {
          return reply.code(403).send({ error: featureCheck.error, upgradeRequired: true })
        }

        const body = branchSchema.parse(request.body)
        const now = new Date()
        const db = getFirestore()

        const branchRef = db.collection(ORG_BRANCHES(orgId)).doc()
        const branchData = {
          name: body.name,
          address: body.address || null,
          phone: body.phone || null,
          contactPerson: body.contactPerson || null,
          createdAt: admin.firestore.Timestamp.fromDate(now),
          updatedAt: admin.firestore.Timestamp.fromDate(now),
        }

        await branchRef.set(branchData)

        return {
          ok: true,
          branch: {
            id: branchRef.id,
            ...branchData,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        }
      } catch (error: any) {
        console.error('[BRANCHES] Error creating branch:', error)
        return reply.code(500).send({ error: 'Failed to create branch', details: error.message })
      }
    }
  )

  fastify.patch<{
    Params: { orgId: string; branchId: string }
    Body: Partial<z.infer<typeof branchSchema>>
  }>('/orgs/:orgId/branches/:branchId', async (request, reply) => {
    try {
      const { orgId, branchId } = request.params
      const member = await requireOrgMember(request, reply, orgId)

      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only org admins can update branches' })
      }

      const db = getFirestore()
      const branchRef = db.doc(`${ORG_BRANCHES(orgId)}/${branchId}`)
      const snap = await branchRef.get()

      if (!snap.exists) {
        return reply.code(404).send({ error: 'Branch not found' })
      }

      const now = new Date()
      const body = request.body as any
      const updateData: any = {
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      }

      if (body.name !== undefined) updateData.name = body.name
      if (body.address !== undefined) updateData.address = body.address || null
      if (body.phone !== undefined) updateData.phone = body.phone || null
      if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson || null

      await branchRef.update(updateData)

      return { ok: true, message: 'Branch updated successfully' }
    } catch (error: any) {
      console.error('[BRANCHES] Error updating branch:', error)
      return reply.code(500).send({ error: 'Failed to update branch', details: error.message })
    }
  })

  fastify.delete<{ Params: { orgId: string; branchId: string } }>(
    '/orgs/:orgId/branches/:branchId',
    async (request, reply) => {
      try {
        const { orgId, branchId } = request.params
        const member = await requireOrgMember(request, reply, orgId)

        if (member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only org admins can delete branches' })
        }

        const db = getFirestore()
        const branchRef = db.doc(`${ORG_BRANCHES(orgId)}/${branchId}`)
        const snap = await branchRef.get()

        if (!snap.exists) {
          return reply.code(404).send({ error: 'Branch not found' })
        }

        await branchRef.delete()

        return { ok: true, message: 'Branch deleted successfully' }
      } catch (error: any) {
        console.error('[BRANCHES] Error deleting branch:', error)
        return reply.code(500).send({ error: 'Failed to delete branch', details: error.message })
      }
    }
  )
}

// ─── team.ts ──────────────────────────────────────────────────────────────────

const TEAM_COLLECTIONS = {
  ORG_MEMBERS: (orgId: string) => `organizations/${orgId}/members`,
  SPECIALISTS: 'specialists',
} as const

const updateMemberRoleSchema = z.object({
  role: z.enum(['org_admin', 'specialist']),
})

function isActiveMember(memberData: admin.firestore.DocumentData): boolean {
  return !memberData.status || memberData.status === 'active'
}

function normalizeTeamRole(role: string): 'admin' | 'specialist' {
  return role === 'org_admin' ? 'admin' : 'specialist'
}

function extractJoinedAt(memberData: admin.firestore.DocumentData): Date {
  return memberData.joinedAt?.toDate?.() || memberData.addedAt?.toDate?.() || new Date()
}

async function getSpecialistProfile(
  db: admin.firestore.Firestore,
  specialistUid: string
): Promise<admin.firestore.DocumentData | null> {
  const specialistRef = db.doc(`${TEAM_COLLECTIONS.SPECIALISTS}/${specialistUid}`)
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
    role: normalizeTeamRole(memberData.role) as 'admin' | 'specialist',
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
      const membersSnapshot = await db.collection(TEAM_COLLECTIONS.ORG_MEMBERS(orgId)).get()

      const activeMembers = membersSnapshot.docs.filter((doc) => isActiveMember(doc.data()))

      const teamMembers = await Promise.all(
        activeMembers.map(async (doc) => {
          const specialistUid = doc.id
          const specialistData = await getSpecialistProfile(db, specialistUid)
          return transformTeamMember(doc, specialistData)
        })
      )

      return teamMembers
    } catch (error: unknown) {
      const err = error as { message?: string; stack?: string }
      console.error('[TEAM] Error fetching team members:', error)
      return reply.code(500).send({
        error: 'Failed to fetch team members',
        message: err.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      })
    }
  })

  fastify.patch<{
    Params: { orgId: string; uid: string }
    Body: z.infer<typeof updateMemberRoleSchema>
  }>('/orgs/:orgId/members/:uid', async (request, reply) => {
    try {
      const { orgId, uid: targetUid } = request.params
      const member = await requireOrgMember(request, reply, orgId)

      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only organization admins can update member roles' })
      }

      const currentUid = request.user!.uid
      if (targetUid === currentUid) {
        return reply.code(400).send({
          error: 'Cannot change your own role. Transfer admin rights to another member first.',
        })
      }

      const body = updateMemberRoleSchema.parse(request.body)
      const db = getFirestore()

      const memberRef = db.doc(`${TEAM_COLLECTIONS.ORG_MEMBERS(orgId)}/${targetUid}`)
      const memberSnap = await memberRef.get()
      if (!memberSnap.exists) {
        return reply.code(404).send({ error: 'Member not found' })
      }

      await memberRef.update({
        role: body.role,
        updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
      })

      const specialistRef = db.doc(`${TEAM_COLLECTIONS.SPECIALISTS}/${targetUid}`)
      const specialistSnap = await specialistRef.get()
      if (specialistSnap.exists) {
        await specialistRef.update({
          orgId,
          role: body.role,
          updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
        })
      }

      return { ok: true, role: body.role }
    } catch (error: unknown) {
      const err = error as { message?: string; stack?: string }
      console.error('[TEAM] Error updating member role:', error)
      return reply.code(500).send({
        error: 'Failed to update member role',
        message: err.message || 'Unknown error',
      })
    }
  })

  fastify.delete<{ Params: { orgId: string; uid: string } }>(
    '/orgs/:orgId/members/:uid',
    async (request, reply) => {
      try {
        const { orgId, uid: targetUid } = request.params
        const member = await requireOrgMember(request, reply, orgId)

        if (member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only organization admins can remove members' })
        }

        const currentUid = request.user!.uid
        if (targetUid === currentUid) {
          return reply.code(400).send({
            error: 'Cannot remove yourself. Transfer admin rights to another member first.',
          })
        }

        const db = getFirestore()

        const memberRef = db.doc(`${TEAM_COLLECTIONS.ORG_MEMBERS(orgId)}/${targetUid}`)
        const memberSnap = await memberRef.get()
        if (!memberSnap.exists) {
          return reply.code(404).send({ error: 'Member not found' })
        }

        await memberRef.update({
          status: 'inactive',
          removedAt: admin.firestore.Timestamp.fromDate(new Date()),
          removedBy: currentUid,
        })

        const specialistRef = db.doc(`${TEAM_COLLECTIONS.SPECIALISTS}/${targetUid}`)
        const specialistSnap = await specialistRef.get()
        if (specialistSnap.exists) {
          await specialistRef.update({
            orgId: admin.firestore.FieldValue.delete(),
            role: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
          })
        }

        return { ok: true }
      } catch (error: unknown) {
        const err = error as { message?: string; stack?: string }
        console.error('[TEAM] Error removing member:', error)
        return reply.code(500).send({
          error: 'Failed to remove member',
          message: err.message || 'Unknown error',
        })
      }
    }
  )
}

// ─── branding.ts ──────────────────────────────────────────────────────────────

const brandingSchema = z.object({
  logo: z.string().url().max(2000).optional().nullable(),
  logoPositionX: z.number().min(0).max(100).optional().nullable(),
  logoPositionY: z.number().min(0).max(100).optional().nullable(),
  logoScale: z.number().min(1).max(2).optional().nullable(),
  name: z.string().max(120).optional().nullable(),
  description: z.string().max(300).optional().nullable(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  welcomeMessage: z.string().max(400).optional().nullable(),
  coverImage: z.string().url().max(2000).optional().nullable(),
  coverPositionX: z.number().min(0).max(100).optional().nullable(),
  coverPositionY: z.number().min(0).max(100).optional().nullable(),
  coverScale: z.number().min(1).max(2).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  website: z.string().url().max(2000).optional().nullable(),
})

type BrandingData = z.infer<typeof brandingSchema>

function cleanBranding(data: BrandingData): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) result[key] = value ?? null
  }
  return result
}

export const brandingRoute: FastifyPluginAsync = async (fastify) => {
  // GET /public/orgs/:orgId/branding — no auth required (used by parent connect page)
  fastify.get<{ Params: { orgId: string } }>(
    '/public/orgs/:orgId/branding',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const db = getFirestore()
        const orgSnap = await db.doc(`organizations/${orgId}`).get()

        if (!orgSnap.exists) {
          return reply.code(404).send({ error: 'Organization not found' })
        }

        const data = orgSnap.data()!
        const branding = (data.branding as BrandingData) || null
        // Return only safe public fields — org name always included
        return {
          ok: true,
          orgName: data.name as string,
          branding: branding
            ? {
                logo: branding.logo ?? null,
                logoPositionX: branding.logoPositionX ?? null,
                logoPositionY: branding.logoPositionY ?? null,
                logoScale: branding.logoScale ?? null,
                name: branding.name ?? null,
                description: branding.description ?? null,
                primaryColor: branding.primaryColor ?? null,
                welcomeMessage: branding.welcomeMessage ?? null,
                coverImage: branding.coverImage ?? null,
                coverPositionX: branding.coverPositionX ?? null,
                coverPositionY: branding.coverPositionY ?? null,
                coverScale: branding.coverScale ?? null,
              }
            : null,
        }
      } catch (error: any) {
        fastify.log.error(error, '[BRANDING] Public GET error')
        return reply.code(500).send({ error: 'Failed to fetch organization' })
      }
    }
  )

  // GET /orgs/:orgId/branding — any org member can read
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/branding', async (request, reply) => {
    try {
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)
      if (reply.sent) return

      const db = getFirestore()
      const orgSnap = await db.doc(`organizations/${orgId}`).get()

      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found' })
      }

      const branding = (orgSnap.data()?.branding as BrandingData) || null
      return { ok: true, branding }
    } catch (error: any) {
      fastify.log.error(error, '[BRANDING] GET error')
      return reply.code(500).send({ error: 'Failed to fetch branding' })
    }
  })

  // PUT /orgs/:orgId/branding — org admin only
  fastify.put<{ Params: { orgId: string }; Body: BrandingData }>(
    '/orgs/:orgId/branding',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const member = await requireOrgMember(request, reply, orgId)
        if (reply.sent) return

        if (member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only organization admins can update branding' })
        }

        const featureCheck = await checkOrgHasFeature(orgId, 'branding')
        if (!featureCheck.ok) {
          return reply.code(403).send({ error: featureCheck.error, upgradeRequired: true })
        }

        const body = brandingSchema.parse(request.body)
        const db = getFirestore()
        const orgRef = db.doc(`organizations/${orgId}`)
        const orgSnap = await orgRef.get()

        if (!orgSnap.exists) {
          return reply.code(404).send({ error: 'Organization not found' })
        }

        const current = (orgSnap.data()?.branding as BrandingData) || {}
        const merged = { ...current, ...cleanBranding(body) }

        await orgRef.update({
          branding: merged,
          updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
        })

        return { ok: true, branding: merged }
      } catch (error: any) {
        if (error?.name === 'ZodError') {
          return reply.code(400).send({ error: 'Invalid branding data', details: error.issues })
        }
        fastify.log.error(error, '[BRANDING] PUT error')
        return reply.code(500).send({ error: 'Failed to update branding' })
      }
    }
  )
}
