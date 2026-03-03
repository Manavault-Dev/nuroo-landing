import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../infrastructure/database/firebase.js'
import { requireOrgMember } from '../plugins/rbac.js'

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

/**
 * Self-serve organization creation.
 *
 * This is the "Organizer" flow:
 * - authenticated user creates an org
 * - user becomes `org_admin` of that org
 */
export const orgsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof createOrgSchema> }>('/orgs', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid, email } = request.user
    const body = createOrgSchema.parse(request.body)
    const now = new Date()

    // Prevent duplicate org names for the same creator (simple UX guard).
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
    })

    // Make requester an org admin.
    await orgRef
      .collection('members')
      .doc(uid)
      .set({
        role: 'org_admin',
        status: 'active',
        joinedAt: admin.firestore.Timestamp.fromDate(now),
      })

    // Ensure specialist profile exists (session endpoint requires it).
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
