import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import admin from 'firebase-admin'
import { getFirestore } from '../firebaseAdmin.js'
import type { SpecialistProfile } from '../types.js'
import { z } from 'zod'
import { config } from '../config.js'

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

// TEMPORARY: Whitelist for dev mode
const DEV_SUPER_ADMIN_WHITELIST = ['nuroo@gmail.com']

function isSuperAdmin(request: FastifyRequest): boolean {
  if (!request.user) return false

  const userEmail = (request.user.email || '').toLowerCase().trim()
  const hasClaim = request.user.claims?.superAdmin === true

  const isWhitelisted = config.NODE_ENV !== 'production' &&
    DEV_SUPER_ADMIN_WHITELIST.some(
      email => email.toLowerCase().trim() === userEmail
    )

  return hasClaim || isWhitelisted
}

export const meRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid, email } = request.user

    console.log(`🔍 [ME] Getting profile for uid: ${uid}`)

    // Get specialist profile if exists
    const specialistRef = db.doc(`specialists/${uid}`)
    const specialistSnap = await specialistRef.get()
    
    let name = email?.split('@')[0] || 'Specialist'
    if (specialistSnap.exists) {
      const specialistData = specialistSnap.data()
      name = specialistData?.fullName || specialistData?.name || name
    }

    // Check if user is Super Admin
    const userIsSuperAdmin = isSuperAdmin(request)

    // Find all organizations where user is a member OR creator (if Super Admin)
    const orgsSnapshot = await db.collection('organizations').get()
    const organizations: Array<{ orgId: string; orgName: string; role: 'admin' | 'specialist' }> = []
    
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id
      const orgData = orgDoc.data()
      
      // Check if Super Admin is creator of this organization
      if (userIsSuperAdmin && orgData.createdBy === uid) {
        console.log(`✅ [ME] Super Admin ${uid} is creator of org ${orgId}, adding with admin role`)
        organizations.push({
          orgId,
          orgName: orgData.name || orgId,
          role: 'admin', // Super Admin creator gets admin role
        })
        continue
      }
      
      // Check membership
      const memberRef = db.doc(`organizations/${orgId}/members/${uid}`)
      const memberSnap = await memberRef.get()
      
      if (!memberSnap.exists) continue
      
      const memberData = memberSnap.data()
      if (memberData?.status !== 'active') continue

      // Map org_admin to admin for backward compatibility
      const role = memberData.role === 'org_admin' ? 'admin' : 'specialist'

      organizations.push({
        orgId,
        orgName: orgData.name || orgId,
        role,
      })
    }

    console.log(`✅ [ME] Found ${organizations.length} organization(s) for uid: ${uid}`)

    const profile: SpecialistProfile = { 
      uid, 
      email: email || '', 
      name, 
      organizations 
    }
    
    return profile
  })

  // POST /me - Update profile (no longer creates organizations)
  // Organizations are now created only by super admin and assigned via invite codes
  fastify.post<{ Body: z.infer<typeof updateProfileSchema> }>('/me', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid, email } = request.user
    const body = updateProfileSchema.parse(request.body)
    const now = new Date()

    const specialistRef = db.doc(`specialists/${uid}`)
    const specialistSnap = await specialistRef.get()

    if (specialistSnap.exists) {
      // Update existing profile
      const updateData: Record<string, unknown> = { updatedAt: admin.firestore.Timestamp.fromDate(now) }
      if (body.name) {
        updateData.fullName = body.name
        updateData.name = body.name // Keep for backward compatibility
      }
      await specialistRef.update(updateData)
      
      const data = (await specialistRef.get()).data()
      return {
        ok: true,
        specialist: { 
          uid, 
          email: email || '', 
          name: data?.fullName || data?.name || email?.split('@')[0] || 'Specialist' 
        },
      }
    }

    // Create new profile (but no organization - must use invite code)
    const newData = {
      uid,
      email: email || '',
      fullName: body.name || email?.split('@')[0] || 'Specialist',
      name: body.name || email?.split('@')[0] || 'Specialist', // Keep for backward compatibility
      createdAt: admin.firestore.Timestamp.fromDate(now),
      updatedAt: admin.firestore.Timestamp.fromDate(now),
    }
    await specialistRef.set(newData)

    console.log(`✅ [ME] Created profile for uid: ${uid} (no organization - must use invite code)`)

    return { 
      ok: true, 
      specialist: { uid, email: email || '', name: newData.fullName }
    }
  })
}
