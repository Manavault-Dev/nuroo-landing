import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../infrastructure/database/firebase.js'

const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  country: z.string().max(100).optional(),
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
}
