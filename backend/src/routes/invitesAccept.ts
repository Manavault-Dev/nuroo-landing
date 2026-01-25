import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { getFirestore } from '../firebaseAdmin.js'
import { z } from 'zod'

const acceptInviteSchema = z.object({
  code: z.string().min(1).max(20),
})

/**
 * POST /invites/accept
 * Accept an invite code and assign user to organization
 * Requires authentication (user must be logged in)
 */
export const invitesAcceptRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof acceptInviteSchema> }>(
    '/invites/accept',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const db = getFirestore()
      const { uid, email } = request.user
      const body = acceptInviteSchema.parse(request.body)
      const code = body.code.trim().toUpperCase()
      const now = new Date()

      console.log(`🔍 [INVITES] User ${uid} attempting to accept code: ${code}`)

      // Get invite
      const inviteRef = db.doc(`invites/${code}`)
      const inviteSnap = await inviteRef.get()

      if (!inviteSnap.exists) {
        console.log(`❌ [INVITES] Code not found: ${code}`)
        return reply.code(404).send({ error: 'Invalid invite code' })
      }

      const inviteData = inviteSnap.data()!

      // Check if invite is active
      if (!inviteData.isActive) {
        console.log(`❌ [INVITES] Code inactive: ${code}`)
        return reply.code(400).send({ error: 'Invite code is no longer active' })
      }

      // Check expiration
      if (inviteData.expiresAt) {
        const expiresAt = inviteData.expiresAt.toDate()
        if (new Date() > expiresAt) {
          console.log(`❌ [INVITES] Code expired: ${code}`)
          return reply.code(400).send({ error: 'Invite code has expired' })
        }
      }

      // Check max uses
      if (inviteData.maxUses && inviteData.usedCount >= inviteData.maxUses) {
        console.log(`❌ [INVITES] Code max uses reached: ${code}`)
        return reply.code(400).send({ error: 'Invite code has reached maximum uses' })
      }

      const { orgId, role } = inviteData

      // Verify organization exists and is active
      const orgRef = db.doc(`organizations/${orgId}`)
      const orgSnap = await orgRef.get()

      if (!orgSnap.exists) {
        console.log(`❌ [INVITES] Organization not found: ${orgId}`)
        return reply.code(404).send({ error: 'Organization not found' })
      }

      const orgData = orgSnap.data()!
      if (!orgData.isActive) {
        console.log(`❌ [INVITES] Organization inactive: ${orgId}`)
        return reply.code(400).send({ error: 'Organization is not active' })
      }

      // Check if user already has membership
      const memberRef = db.doc(`organizations/${orgId}/members/${uid}`)
      const memberSnap = await memberRef.get()

      if (memberSnap.exists) {
        const memberData = memberSnap.data()!
        if (memberData.status === 'active') {
          console.log(`⚠️  [INVITES] User ${uid} already member of org ${orgId}`)
          return {
            ok: true,
            orgId,
            role: memberData.role,
            message: 'Already a member of this organization',
          }
        }
      }

      // Handle different roles
      if (role === 'org_admin' || role === 'specialist') {
        // These roles require Firebase Auth (user is already authenticated)
        // Create/update membership
        await memberRef.set({
          role: role === 'org_admin' ? 'org_admin' : 'specialist',
          status: 'active',
          joinedAt: admin.firestore.Timestamp.fromDate(now),
        })

        // Upsert specialist profile
        const specialistRef = db.doc(`specialists/${uid}`)
        const specialistSnap = await specialistRef.get()

        if (specialistSnap.exists) {
          await specialistRef.update({
            orgId,
            role: role === 'org_admin' ? 'org_admin' : 'specialist',
            updatedAt: admin.firestore.Timestamp.fromDate(now),
          })
        } else {
          await specialistRef.set({
            uid,
            email: email || '',
            fullName: email?.split('@')[0] || 'Specialist',
            orgId,
            role: role === 'org_admin' ? 'org_admin' : 'specialist',
            createdAt: admin.firestore.Timestamp.fromDate(now),
            updatedAt: admin.firestore.Timestamp.fromDate(now),
          })
        }

        console.log(`✅ [INVITES] User ${uid} joined org ${orgId} as ${role}`)
      } else if (role === 'parent') {
        // Parents are CONTACT ONLY - no authentication
        // Parent invite codes should be used differently (not through /invites/accept with auth)
        // For now, we'll return an error - parent contacts should be created by Org Admin
        return reply.code(400).send({ 
          error: 'Parent invites cannot be accepted through this endpoint. Parents are contact-only and do not authenticate. Please contact your organization admin to add parent contacts.' 
        })
      } else {
        return reply.code(400).send({ error: 'Invalid role in invite' })
      }

      // Increment used count
      await inviteRef.update({
        usedCount: admin.firestore.FieldValue.increment(1),
      })

      return {
        ok: true,
        orgId,
        role,
        orgName: orgData.name,
      }
    }
  )
}
