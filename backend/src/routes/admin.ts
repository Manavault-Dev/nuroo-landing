import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { getFirestore } from '../infrastructure/database/firebase.js'
import { requireSuperAdmin } from '../plugins/superAdmin.js'
import { config } from '../config.js'
import { z } from 'zod'

const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  country: z.string().max(100).optional(),
})

const createInviteSchema = z.object({
  orgId: z.string().min(1),
  role: z.enum(['org_admin', 'specialist', 'parent']),
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().min(1).max(1000).optional(),
})

/**
 * Generate a random invite code (8 characters, alphanumeric uppercase)
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude confusing chars like 0, O, I, 1
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export const adminRoute: FastifyPluginAsync = async (fastify) => {
  // GET /admin/organizations - List organizations created by current Super Admin
  fastify.get('/admin/organizations', async (request, reply) => {
    await requireSuperAdmin(request, reply)

    const db = getFirestore()
    const { uid } = request.user!

    console.log(`🔍 [ADMIN] Fetching organizations for Super Admin: ${uid}`)

    try {
      // Try with orderBy first, if it fails, fallback to without orderBy
      let orgsSnapshot
      try {
        orgsSnapshot = await db
          .collection('organizations')
          .where('createdBy', '==', uid)
          .orderBy('createdAt', 'desc')
          .get()
      } catch (error: any) {
        // If orderBy fails (missing index), try without orderBy
        if (error.code === 9 || error.message?.includes('index')) {
          console.warn('⚠️ [ADMIN] Index missing, fetching without orderBy')
          orgsSnapshot = await db.collection('organizations').where('createdBy', '==', uid).get()

          // Sort manually
          const docs = orgsSnapshot.docs.sort(
            (
              a: admin.firestore.QueryDocumentSnapshot,
              b: admin.firestore.QueryDocumentSnapshot
            ) => {
              const aTime = a.data().createdAt?.toDate?.()?.getTime() || 0
              const bTime = b.data().createdAt?.toDate?.()?.getTime() || 0
              return bTime - aTime
            }
          )
          orgsSnapshot = { docs } as any
        } else {
          throw error
        }
      }

      const organizations = orgsSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => {
        const data = doc.data()
        return {
          orgId: doc.id,
          name: data.name || 'Unnamed Organization',
          country: data.country || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          createdBy: data.createdBy || null,
          isActive: data.isActive !== false,
        }
      })

      console.log(`✅ [ADMIN] Listed ${organizations.length} organizations for Super Admin ${uid}`)

      return {
        ok: true,
        organizations,
        count: organizations.length,
      }
    } catch (error: any) {
      console.error('❌ [ADMIN] Error fetching organizations:', error)
      return reply.code(500).send({
        error: 'Failed to fetch organizations',
        details: error.message,
      })
    }
  })

  // POST /admin/organizations - Create a new organization (super admin only)
  fastify.post<{ Body: z.infer<typeof createOrgSchema> }>(
    '/admin/organizations',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      const db = getFirestore()
      const { uid } = request.user!
      const body = createOrgSchema.parse(request.body)
      const now = new Date()

      // Check if org with same name already exists (only for this Super Admin's organizations)
      const existingOrgs = await db
        .collection('organizations')
        .where('name', '==', body.name)
        .where('createdBy', '==', uid)
        .limit(1)
        .get()

      if (!existingOrgs.empty) {
        return reply.code(400).send({ error: 'You already have an organization with this name' })
      }

      // Create organization
      const orgRef = db.collection('organizations').doc()
      const orgId = orgRef.id

      const orgData = {
        name: body.name,
        country: body.country || null,
        createdAt: admin.firestore.Timestamp.fromDate(now),
        createdBy: uid,
        isActive: true,
        billingPlan: null,
      }

      await orgRef.set(orgData)

      console.log(`✅ [ADMIN] Created organization: ${orgId} (${body.name}) by ${uid}`)
      console.log(`📋 [ADMIN] Organization data:`, {
        orgId,
        ...orgData,
        createdAt: orgData.createdAt.toDate().toISOString(),
      })

      return {
        ok: true,
        orgId,
        name: body.name,
        country: body.country || null,
      }
    }
  )

  // POST /admin/invites - Create an invite code (super admin only)
  fastify.post<{ Body: z.infer<typeof createInviteSchema> }>(
    '/admin/invites',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      const db = getFirestore()
      const { uid } = request.user!
      const body = createInviteSchema.parse(request.body)
      const now = new Date()

      // Verify organization exists and belongs to this Super Admin
      const orgRef = db.doc(`organizations/${body.orgId}`)
      const orgSnap = await orgRef.get()

      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found' })
      }

      const orgData = orgSnap.data()!

      // Check if organization belongs to this Super Admin
      if (orgData.createdBy !== uid) {
        return reply
          .code(403)
          .send({ error: 'You can only create invites for organizations you created' })
      }

      if (!orgData.isActive) {
        return reply.code(400).send({ error: 'Organization is not active' })
      }

      // Generate unique invite code
      let code: string
      let attempts = 0
      do {
        code = generateInviteCode()
        const existingInvite = await db.doc(`invites/${code}`).get()
        if (!existingInvite.exists) break
        attempts++
        if (attempts > 10) {
          return reply.code(500).send({ error: 'Failed to generate unique invite code' })
        }
      } while (attempts <= 10)

      // Parse expiresAt if provided
      let expiresAt: admin.firestore.Timestamp | null = null
      if (body.expiresAt) {
        expiresAt = admin.firestore.Timestamp.fromDate(new Date(body.expiresAt))
      }

      // Create invite
      const inviteRef = db.doc(`invites/${code}`)
      await inviteRef.set({
        orgId: body.orgId,
        role: body.role,
        createdBy: uid,
        createdAt: admin.firestore.Timestamp.fromDate(now),
        expiresAt,
        maxUses: body.maxUses || null,
        usedCount: 0,
        isActive: true,
      })

      const frontendUrl = process.env.NEXT_PUBLIC_B2B_URL || 'http://localhost:3000'
      const inviteLink = `${frontendUrl}/b2b/register?code=${code}`

      console.log(
        `✅ [ADMIN] Created invite: ${code} for org ${body.orgId} (${body.role}) by ${uid}`
      )

      return {
        ok: true,
        code,
        inviteLink,
        orgId: body.orgId,
        orgName: orgData.name,
        role: body.role,
        expiresAt: expiresAt?.toDate().toISOString() || null,
        maxUses: body.maxUses || null,
      }
    }
  )

  // GET /admin/invites - List invite codes for organizations created by current Super Admin
  fastify.get('/admin/invites', async (request, reply) => {
    try {
      await requireSuperAdmin(request, reply)

      const db = getFirestore()
      const { uid } = request.user!
      const limit = 50 // Limit to recent 50 invites

      console.log(`🔍 [ADMIN] Fetching invites for Super Admin: ${uid}`)

      // First, get all organizations created by this Super Admin
      let orgsSnapshot
      try {
        orgsSnapshot = await db.collection('organizations').where('createdBy', '==', uid).get()
      } catch (error: any) {
        console.error('❌ [ADMIN] Error fetching organizations:', error)
        return reply.code(500).send({
          error: 'Failed to fetch organizations',
          details: error.message,
        })
      }

      const orgIds = orgsSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => doc.id)

      console.log(`📋 [ADMIN] Found ${orgIds.length} organizations for Super Admin ${uid}`)

      if (orgIds.length === 0) {
        console.log(`✅ [ADMIN] No organizations found, returning empty invites list`)
        return {
          ok: true,
          invites: [],
          count: 0,
        }
      }

      // Get invites for these organizations
      // Note: Firestore doesn't support 'in' queries with more than 10 items
      // So we'll fetch all invites and filter client-side, or use multiple queries
      const invitesPromises = orgIds.map(async (orgId) => {
        try {
          // Try with orderBy first
          let invitesSnapshot
          try {
            invitesSnapshot = await db
              .collection('invites')
              .where('orgId', '==', orgId)
              .orderBy('createdAt', 'desc')
              .limit(limit)
              .get()
          } catch (error: any) {
            // If orderBy fails (missing index), try without orderBy
            if (error.code === 9 || error.message?.includes('index')) {
              console.warn(
                `⚠️ [ADMIN] Index missing for invites query (orgId: ${orgId}), fetching without orderBy`
              )
              invitesSnapshot = await db
                .collection('invites')
                .where('orgId', '==', orgId)
                .limit(limit)
                .get()
            } else {
              throw error
            }
          }
          return invitesSnapshot.docs
        } catch (error: any) {
          console.error(`❌ [ADMIN] Error fetching invites for org ${orgId}:`, error)
          return [] // Return empty array on error
        }
      })

      const invitesDocs = (await Promise.all(invitesPromises)).flat()

      // Sort by createdAt descending
      invitesDocs.sort((a, b) => {
        const aTime = a.data().createdAt?.toDate?.()?.getTime() || 0
        const bTime = b.data().createdAt?.toDate?.()?.getTime() || 0
        return bTime - aTime
      })

      // Limit to most recent 50
      const limitedDocs = invitesDocs.slice(0, limit)

      const frontendUrl = process.env.NEXT_PUBLIC_B2B_URL || 'http://localhost:3000'

      const invites = await Promise.all(
        limitedDocs.map(async (doc: admin.firestore.QueryDocumentSnapshot) => {
          try {
            const data = doc.data()
            const orgRef = db.doc(`organizations/${data.orgId}`)
            const orgSnap = await orgRef.get()
            const orgName = orgSnap.exists ? orgSnap.data()?.name || 'Unknown' : 'Unknown'

            return {
              code: doc.id,
              inviteLink: `${frontendUrl}/b2b/register?code=${doc.id}`,
              orgId: data.orgId,
              orgName,
              role: data.role,
              expiresAt: data.expiresAt?.toDate?.()?.toISOString() || null,
              maxUses: data.maxUses || null,
              usedCount: data.usedCount || 0,
              isActive: data.isActive !== false,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            }
          } catch (error: any) {
            console.error(`❌ [ADMIN] Error processing invite ${doc.id}:`, error)
            // Return a basic invite object even if org lookup fails
            const data = doc.data()
            return {
              code: doc.id,
              inviteLink: `${frontendUrl}/b2b/register?code=${doc.id}`,
              orgId: data.orgId || 'unknown',
              orgName: 'Unknown',
              role: data.role || 'unknown',
              expiresAt: data.expiresAt?.toDate?.()?.toISOString() || null,
              maxUses: data.maxUses || null,
              usedCount: data.usedCount || 0,
              isActive: data.isActive !== false,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            }
          }
        })
      )

      console.log(`✅ [ADMIN] Listed ${invites.length} invite codes for Super Admin ${uid}`)

      return {
        ok: true,
        invites,
        count: invites.length,
      }
    } catch (error: any) {
      console.error('❌ [ADMIN] Error in GET /admin/invites:', error)
      console.error('❌ [ADMIN] Error stack:', error.stack)
      return reply.code(500).send({
        error: 'Internal server error',
        message: error.message,
        details: config.NODE_ENV === 'development' ? error.stack : undefined,
      })
    }
  })

  // GET /admin/orgs/:orgId/specialists - List specialists in an organization (Super Admin only)
  fastify.get<{ Params: { orgId: string } }>(
    '/admin/orgs/:orgId/specialists',
    async (request, reply) => {
      try {
        await requireSuperAdmin(request, reply)

        const db = getFirestore()
        const { uid } = request.user!
        const { orgId } = request.params

        console.log(`🔍 [ADMIN] Fetching specialists for org ${orgId} by Super Admin ${uid}`)

        // Verify organization exists and belongs to this Super Admin
        const orgRef = db.doc(`organizations/${orgId}`)
        const orgSnap = await orgRef.get()

        if (!orgSnap.exists) {
          return reply.code(404).send({ error: 'Organization not found' })
        }

        const orgData = orgSnap.data()!

        // Check if organization belongs to this Super Admin
        if (orgData.createdBy !== uid) {
          return reply
            .code(403)
            .send({ error: 'You can only view specialists for organizations you created' })
        }

        // Get all members of the organization
        // Note: Some members might not have 'status' field, so we'll get all and filter client-side
        const membersSnapshot = await db.collection(`organizations/${orgId}/members`).get()

        console.log(`📋 [ADMIN] Found ${membersSnapshot.docs.length} total members in org ${orgId}`)
        console.log(
          `📋 [ADMIN] Member details:`,
          membersSnapshot.docs.map((doc) => ({
            uid: doc.id,
            role: doc.data().role,
            status: doc.data().status,
            hasStatus: !!doc.data().status,
          }))
        )

        const allSpecialists = await Promise.all(
          membersSnapshot.docs.map(async (doc) => {
            const memberData = doc.data()
            const specialistUid = doc.id

            // Get specialist profile
            const specialistRef = db.doc(`specialists/${specialistUid}`)
            const specialistSnap = await specialistRef.get()

            const specialistData = specialistSnap.exists ? specialistSnap.data() : null

            return {
              uid: specialistUid,
              email: specialistData?.email || '',
              name: specialistData?.fullName || specialistData?.name || 'Unknown',
              role: memberData.role || 'specialist',
              status: memberData.status || null,
              joinedAt:
                memberData.joinedAt?.toDate?.()?.toISOString() ||
                memberData.addedAt?.toDate?.()?.toISOString() ||
                null,
              createdAt: specialistData?.createdAt?.toDate?.()?.toISOString() || null,
            }
          })
        )

        // Filter: Include if status is 'active' or if status field doesn't exist (backward compatibility)
        // Also include org_admin role
        const specialists = allSpecialists.filter((spec) => {
          const hasActiveStatus = !spec.status || spec.status === 'active'
          const isOrgAdmin = spec.role === 'org_admin'
          return hasActiveStatus || isOrgAdmin
        })

        console.log(
          `✅ [ADMIN] Listed ${specialists.length} specialists (filtered from ${allSpecialists.length} total) for org ${orgId}`
        )
        console.log(
          `📋 [ADMIN] Specialists:`,
          specialists.map((s) => ({ uid: s.uid, name: s.name, role: s.role, status: s.status }))
        )

        return {
          ok: true,
          specialists,
          count: specialists.length,
        }
      } catch (error: any) {
        console.error('❌ [ADMIN] Error in GET /admin/orgs/:orgId/specialists:', error)
        return reply.code(500).send({
          error: 'Internal server error',
          message: error.message,
          details: config.NODE_ENV === 'development' ? error.stack : undefined,
        })
      }
    }
  )

  // GET /admin/orgs/:orgId/parents - List parents in an organization (Super Admin only)
  fastify.get<{ Params: { orgId: string } }>(
    '/admin/orgs/:orgId/parents',
    async (request, reply) => {
      try {
        await requireSuperAdmin(request, reply)

        const db = getFirestore()
        const { uid } = request.user!
        const { orgId } = request.params

        console.log(`🔍 [ADMIN] Fetching parents for org ${orgId} by Super Admin ${uid}`)

        // Verify organization exists and belongs to this Super Admin
        const orgRef = db.doc(`organizations/${orgId}`)
        const orgSnap = await orgRef.get()

        if (!orgSnap.exists) {
          return reply.code(404).send({ error: 'Organization not found' })
        }

        const orgData = orgSnap.data()!

        // Check if organization belongs to this Super Admin
        if (orgData.createdBy !== uid) {
          return reply
            .code(403)
            .send({ error: 'You can only view parents for organizations you created' })
        }

        // Get all parents linked to the organization
        // Check both collections: organizations/{orgId}/parents and orgParents/{orgId}/parents
        const parentsSnapshot1 = await db.collection(`organizations/${orgId}/parents`).get()

        console.log(
          `📋 [ADMIN] Found ${parentsSnapshot1.docs.length} parents in organizations/${orgId}/parents`
        )

        // Also check orgParents collection (for mobile app linked parents)
        let parentsSnapshot2
        try {
          parentsSnapshot2 = await db.collection(`orgParents/${orgId}/parents`).get()
          console.log(
            `📋 [ADMIN] Found ${parentsSnapshot2.docs.length} parents in orgParents/${orgId}/parents`
          )
        } catch (error: any) {
          console.log(
            `⚠️ [ADMIN] Could not fetch from orgParents collection (might not exist):`,
            error.message
          )
          parentsSnapshot2 = { docs: [] }
        }

        // Combine both collections, but deduplicate by parent UID
        const parentMap = new Map<string, admin.firestore.QueryDocumentSnapshot>()

        // Add parents from organizations/{orgId}/parents
        parentsSnapshot1.docs.forEach((doc) => {
          parentMap.set(doc.id, doc)
        })

        // Add parents from orgParents/{orgId}/parents (may have different structure)
        parentsSnapshot2.docs.forEach((doc) => {
          if (!parentMap.has(doc.id)) {
            parentMap.set(doc.id, doc)
          }
        })

        console.log(`📋 [ADMIN] Total unique parents (after deduplication): ${parentMap.size}`)

        // Get parent user data from Firebase Auth for each parent
        const parents = await Promise.all(
          Array.from(parentMap.values()).map(async (doc: admin.firestore.QueryDocumentSnapshot) => {
            const data = doc.data()
            const parentUid = doc.id

            // Try to get parent user info from Firebase Auth
            let parentEmail: string | null = null
            let parentDisplayName: string | null = null
            try {
              const auth = admin.auth()
              const parentUser = await auth.getUser(parentUid)
              parentEmail = parentUser.email || null
              parentDisplayName = parentUser.displayName || null
            } catch (error: any) {
              console.log(
                `⚠️ [ADMIN] Could not fetch parent user ${parentUid} from Auth:`,
                error.message
              )
            }

            // Get linked children for this parent
            const childrenSnapshot = await db
              .collection(`organizations/${orgId}/children`)
              .where('parentUserId', '==', parentUid)
              .get()

            console.log(
              `📋 [ADMIN] Found ${childrenSnapshot.docs.length} children for parent ${parentUid}`
            )

            // Get full child details
            const linkedChildren = await Promise.all(
              childrenSnapshot.docs.map(async (childDoc) => {
                const childId = childDoc.id
                const linkData = childDoc.data()

                // Get child details from children collection
                const childRef = db.doc(`children/${childId}`)
                const childSnap = await childRef.get()

                if (!childSnap.exists) {
                  return {
                    id: childId,
                    name: 'Unknown',
                    age: undefined,
                  }
                }

                const childData = childSnap.data()!
                return {
                  id: childId,
                  name: childData.name || childData.childName || 'Unknown',
                  age: childData.age || childData.childAge,
                }
              })
            )

            return {
              id: parentUid,
              name: data.name || data.displayName || parentDisplayName || 'Unknown',
              email: data.email || parentEmail || null,
              phone: data.phone || null,
              linkedChildren,
              linkedSpecialistUid: data.linkedSpecialistUid || null,
              createdAt:
                data.createdAt?.toDate?.()?.toISOString() ||
                data.joinedAt?.toDate?.()?.toISOString() ||
                null,
              updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
            }
          })
        )

        console.log(`✅ [ADMIN] Listed ${parents.length} parents for org ${orgId}`)
        console.log(
          `📋 [ADMIN] Parents:`,
          parents.map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            childrenCount: p.linkedChildren.length,
          }))
        )

        return {
          ok: true,
          parents,
          count: parents.length,
        }
      } catch (error: any) {
        console.error('❌ [ADMIN] Error in GET /admin/orgs/:orgId/parents:', error)
        return reply.code(500).send({
          error: 'Internal server error',
          message: error.message,
          details: config.NODE_ENV === 'development' ? error.stack : undefined,
        })
      }
    }
  )

  // GET /admin/orgs/:orgId/children - List children in an organization (Super Admin only)
  // Note: Children are now shown within parent information, but we keep this endpoint for backward compatibility
  fastify.get<{ Params: { orgId: string } }>(
    '/admin/orgs/:orgId/children',
    async (request, reply) => {
      try {
        await requireSuperAdmin(request, reply)

        const db = getFirestore()
        const { uid } = request.user!
        const { orgId } = request.params

        console.log(`🔍 [ADMIN] Fetching children for org ${orgId} by Super Admin ${uid}`)

        // Verify organization exists and belongs to this Super Admin
        const orgRef = db.doc(`organizations/${orgId}`)
        const orgSnap = await orgRef.get()

        if (!orgSnap.exists) {
          return reply.code(404).send({ error: 'Organization not found' })
        }

        const orgData = orgSnap.data()!

        // Check if organization belongs to this Super Admin
        if (orgData.createdBy !== uid) {
          return reply
            .code(403)
            .send({ error: 'You can only view children for organizations you created' })
        }

        // Get all children assigned to the organization (through parent links)
        const childrenSnapshot = await db
          .collection(`organizations/${orgId}/children`)
          .where('assigned', '==', true)
          .get()

        console.log(
          `📋 [ADMIN] Found ${childrenSnapshot.docs.length} child links in organizations/${orgId}/children`
        )

        const childIds = childrenSnapshot.docs.map(
          (doc: admin.firestore.QueryDocumentSnapshot) => doc.id
        )

        const children = await Promise.all(
          childIds.map(async (childId) => {
            const childRef = db.doc(`children/${childId}`)
            const childSnap = await childRef.get()

            const linkData = childrenSnapshot.docs.find((d) => d.id === childId)?.data()

            if (!childSnap.exists) {
              return {
                id: childId,
                name: 'Unknown',
                age: undefined,
                parentUserId: linkData?.parentUserId || null,
                assignedAt: linkData?.assignedAt?.toDate?.()?.toISOString() || null,
              }
            }

            const childData = childSnap.data()!
            return {
              id: childId,
              name: childData.name || childData.childName || 'Unknown',
              age: childData.age || childData.childAge,
              parentUserId: linkData?.parentUserId || null,
              assignedAt: linkData?.assignedAt?.toDate?.()?.toISOString() || null,
            }
          })
        )

        console.log(`✅ [ADMIN] Listed ${children.length} children for org ${orgId}`)

        return {
          ok: true,
          children,
          count: children.length,
        }
      } catch (error: any) {
        console.error('❌ [ADMIN] Error in GET /admin/orgs/:orgId/children:', error)
        return reply.code(500).send({
          error: 'Internal server error',
          message: error.message,
          details: config.NODE_ENV === 'development' ? error.stack : undefined,
        })
      }
    }
  )
}
