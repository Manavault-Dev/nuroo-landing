import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { getFirestore } from '../infrastructure/database/firebase.js'
import { requireOrgMember } from '../plugins/rbac.js'
import { z } from 'zod'

const createInviteSchema = z.object({
  role: z.enum(['specialist', 'admin']).default('specialist'),
  maxUses: z.number().min(1).max(1000).optional(),
  expiresInDays: z.number().min(1).max(365).default(30),
})

export const invitesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof createInviteSchema> }>(
    '/orgs/:orgId/invites',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const db = getFirestore()
      const { orgId } = request.params
      const { uid } = request.user

      const member = await requireOrgMember(request, reply, orgId)

      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only organization admins can create invite codes' })
      }

      const body = createInviteSchema.parse(request.body)
      const inviteCode = `${orgId}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + body.expiresInDays)

      const inviteRef = db.doc(`orgInvites/${inviteCode}`)
      await inviteRef.set({
        orgId,
        role: body.role,
        maxUses: body.maxUses || null,
        usedCount: 0,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdBy: uid,
        createdAt: admin.firestore.Timestamp.fromDate(new Date()),
      })

      return {
        ok: true,
        inviteCode,
        expiresAt: expiresAt.toISOString(),
        role: body.role,
        maxUses: body.maxUses || null,
      }
    }
  )

  // POST /orgs/:orgId/parent-invites - Create parent invite code for a specific organization (Specialist only)
  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/parent-invites',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      try {
        const db = getFirestore()
        const { orgId } = request.params
        const { uid } = request.user

        // Verify user is a member of the organization
        const member = await requireOrgMember(request, reply, orgId)

        // Only specialists can create parent invites
        if (member.role !== 'specialist' && member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only specialists can create parent invite codes' })
        }

        const now = new Date()

        // Generate 6-character invite code
        let inviteCode = ''
        for (let i = 0; i < 6; i++) {
          inviteCode += Math.random().toString(36).charAt(2).toUpperCase()
        }
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 365) // 1 year expiration

        const inviteRef = db.doc(`parentInvites/${inviteCode}`)
        await inviteRef.set({
          specialistId: uid,
          orgId,
          maxUses: null,
          usedCount: 0,
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          createdAt: admin.firestore.Timestamp.fromDate(now),
        })

        console.log(
          `✅ [INVITES] Created parent invite code ${inviteCode} for specialist ${uid} in org ${orgId}`
        )

        return {
          ok: true,
          inviteCode,
          expiresAt: expiresAt.toISOString(),
          orgId,
        }
      } catch (error: any) {
        console.error('❌ [INVITES] Error creating parent invite:', error)
        return reply.code(500).send({ error: error.message || 'Failed to create invite code' })
      }
    }
  )

  // POST /specialists/invites - Create parent invite for personal organization (legacy endpoint)
  fastify.post('/specialists/invites', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()
      const { uid, email } = request.user

      const specialistRef = db.doc(`specialists/${uid}`)
      const specialistSnap = await specialistRef.get()

      const now = new Date()
      let specialistName = email?.split('@')[0] || 'Specialist'
      if (specialistSnap.exists) {
        specialistName = specialistSnap.data()?.name || specialistName
      } else {
        await specialistRef.set({
          uid,
          email: email || '',
          name: specialistName,
          createdAt: admin.firestore.Timestamp.fromDate(now),
          updatedAt: admin.firestore.Timestamp.fromDate(now),
        })
      }
      const orgsSnapshot = await db
        .collection('organizations')
        .where('ownerId', '==', uid)
        .limit(1)
        .get()

      let personalOrgId: string
      if (orgsSnapshot.empty) {
        const personalOrgName = `${specialistName}'s Practice`
        const orgRef = db.collection('organizations').doc()
        personalOrgId = orgRef.id

        await orgRef.set({
          name: personalOrgName,
          type: 'personal',
          ownerId: uid,
          createdAt: admin.firestore.Timestamp.fromDate(now),
          updatedAt: admin.firestore.Timestamp.fromDate(now),
        })

        const memberRef = orgRef.collection('members').doc(uid)
        await memberRef.set({
          role: 'admin',
          status: 'active',
          joinedAt: admin.firestore.Timestamp.fromDate(now),
        })
      } else {
        personalOrgId = orgsSnapshot.docs[0].id
      }

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let inviteCode = ''
      for (let i = 0; i < 6; i++) {
        inviteCode += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 365)

      const inviteRef = db.doc(`parentInvites/${inviteCode}`)
      await inviteRef.set({
        specialistId: uid,
        orgId: personalOrgId,
        maxUses: null,
        usedCount: 0,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: admin.firestore.Timestamp.fromDate(now),
      })

      return {
        ok: true,
        inviteCode,
        expiresAt: expiresAt.toISOString(),
        orgId: personalOrgId,
      }
    } catch (error: any) {
      console.error('Error creating parent invite:', error)
      return reply.code(500).send({ error: error.message || 'Failed to create invite code' })
    }
  })

  const validateInviteSchema = z.object({
    inviteCode: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(100).optional(),
  })

  fastify.post<{
    Body?: z.infer<typeof validateInviteSchema>
    Querystring?: { inviteCode?: string; code?: string }
  }>('/api/org/parent-invites/validate', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()

      let inviteCode: string | undefined

      const body = request.body as any
      if (body) {
        inviteCode = body.inviteCode || body.code || body.invite_code
      }

      if (!inviteCode) {
        const query = request.query as any
        inviteCode = query?.inviteCode || query?.code || query?.invite_code
      }

      if (!inviteCode || typeof inviteCode !== 'string') {
        return reply.code(400).send({ error: 'Invite code is required' })
      }

      const normalizedCode = inviteCode.trim().toUpperCase()
      const inviteRef = db.doc(`parentInvites/${normalizedCode}`)
      const inviteSnap = await inviteRef.get()

      if (!inviteSnap.exists) {
        return reply.code(404).send({ error: 'Invalid invite code' })
      }

      const inviteData = inviteSnap.data()!

      if (inviteData.expiresAt) {
        const expiresAt = inviteData.expiresAt.toDate()
        if (new Date() > expiresAt) {
          return reply.code(400).send({ error: 'Invite code has expired' })
        }
      }

      const specialistRef = db.doc(`specialists/${inviteData.specialistId}`)
      const specialistSnap = await specialistRef.get()

      if (!specialistSnap.exists) {
        return reply.code(404).send({ error: 'Specialist not found' })
      }

      const specialistData = specialistSnap.data()!
      const orgRef = db.doc(`organizations/${inviteData.orgId}`)
      const orgSnap = await orgRef.get()

      return {
        ok: true,
        valid: true,
        specialistId: inviteData.specialistId,
        specialistName: specialistData.name || 'Specialist',
        orgId: inviteData.orgId,
        orgName: orgSnap.exists ? orgSnap.data()?.name : 'Organization',
      }
    } catch (error: any) {
      console.error('Error validating parent invite:', error)
      return reply.code(500).send({ error: error.message || 'Failed to validate invite code' })
    }
  })

  const useInviteSchema = z.object({
    inviteCode: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(100).optional(),
    childId: z.string().min(1),
  })

  fastify.post<{
    Body?: z.infer<typeof useInviteSchema>
    Querystring?: { inviteCode?: string; code?: string; childId?: string }
  }>('/api/org/parent-invites/use', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()

      let inviteCode: string | undefined
      let childId: string | undefined

      const body = request.body as any
      if (body) {
        inviteCode = body.inviteCode || body.code || body.invite_code
        childId = body.childId || body.child_id
      }

      if (!inviteCode || !childId) {
        const query = request.query as any
        if (!inviteCode) {
          inviteCode = query?.inviteCode || query?.code || query?.invite_code
        }
        if (!childId) {
          childId = query?.childId || query?.child_id
        }
      }

      if (!inviteCode || typeof inviteCode !== 'string') {
        return reply.code(400).send({ error: 'Invite code is required' })
      }

      if (!childId || typeof childId !== 'string') {
        return reply.code(400).send({ error: 'Child ID is required' })
      }

      const normalizedCode = inviteCode.trim().toUpperCase()
      const inviteRef = db.doc(`parentInvites/${normalizedCode}`)
      const inviteSnap = await inviteRef.get()

      if (!inviteSnap.exists) {
        return reply.code(404).send({ error: 'Invalid invite code' })
      }

      const inviteData = inviteSnap.data()!

      if (inviteData.expiresAt) {
        const expiresAt = inviteData.expiresAt.toDate()
        if (new Date() > expiresAt) {
          return reply.code(400).send({ error: 'Invite code has expired' })
        }
      }

      const orgId = inviteData.orgId as string
      const childRef = db.doc(`children/${childId}`)
      const childSnap = await childRef.get()

      if (!childSnap.exists) {
        return reply.code(404).send({ error: 'Child not found' })
      }

      const orgChildrenRef = db.doc(`organizations/${orgId}/children/${childId}`)
      const orgChildrenSnap = await orgChildrenRef.get()

      const now = new Date()

      if (!orgChildrenSnap.exists) {
        await orgChildrenRef.set({
          assigned: true,
          assignedAt: admin.firestore.Timestamp.fromDate(now),
        })
      } else {
        await orgChildrenRef.update({
          assigned: true,
          assignedAt: admin.firestore.Timestamp.fromDate(now),
        })
      }

      await childRef.update({
        organizationId: orgId,
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      })

      try {
        await inviteRef.update({ usedCount: (inviteData.usedCount || 0) + 1 })
      } catch {
        // Non-critical: ignore count update failure
      }

      return {
        ok: true,
        orgId,
        childId,
        message: 'Child successfully connected to specialist',
      }
    } catch (error: any) {
      console.error('Error using parent invite:', error)
      return reply.code(500).send({ error: error.message || 'Failed to use invite code' })
    }
  })

  fastify.post<{
    Body?: z.infer<typeof useInviteSchema>
    Querystring?: { inviteCode?: string; code?: string; childId?: string }
  }>('/api/org/parent-invites/accept', async (request, reply) => {
    console.log('🔍 /api/org/parent-invites/accept called', {
      body: request.body,
      query: request.query,
      hasUser: !!request.user,
    })

    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()

      let inviteCode: string | undefined
      let childId: string | undefined

      const body = request.body as any
      if (body) {
        inviteCode = body.inviteCode || body.code || body.invite_code
        childId = body.childId || body.child_id
      }

      if (!inviteCode || !childId) {
        const query = request.query as any
        if (!inviteCode) {
          inviteCode = query?.inviteCode || query?.code || query?.invite_code
        }
        if (!childId) {
          childId = query?.childId || query?.child_id
        }
      }

      if (!inviteCode || typeof inviteCode !== 'string') {
        return reply.code(400).send({ error: 'Invite code is required' })
      }

      if (!childId || typeof childId !== 'string') {
        return reply.code(400).send({ error: 'Child ID is required' })
      }

      const normalizedCode = inviteCode.trim().toUpperCase()
      console.log(
        '🔍 [ACCEPT] Looking for invite code:',
        normalizedCode,
        'in collection: parentInvites'
      )
      const inviteRef = db.doc(`parentInvites/${normalizedCode}`)
      const inviteSnap = await inviteRef.get()

      console.log('🔍 [ACCEPT] Invite exists:', inviteSnap.exists)
      if (!inviteSnap.exists) {
        console.log('❌ [ACCEPT] Invite code not found:', normalizedCode)
        try {
          const allInvites = await db.collection('parentInvites').limit(5).get()
          console.log(
            '📋 [ACCEPT] Sample invite codes in DB:',
            allInvites.docs.map((d) => d.id)
          )
        } catch (e) {
          console.error('Error listing invites:', e)
        }
        return reply.code(404).send({ error: 'Invalid invite code', code: normalizedCode })
      }

      const inviteData = inviteSnap.data()!
      console.log('✅ [ACCEPT] Invite found:', {
        orgId: inviteData.orgId,
        specialistId: inviteData.specialistId,
      })

      if (inviteData.expiresAt) {
        const expiresAt = inviteData.expiresAt.toDate()
        if (new Date() > expiresAt) {
          return reply.code(400).send({ error: 'Invite code has expired' })
        }
      }

      const orgId = inviteData.orgId as string
      const specialistId = inviteData.specialistId as string | undefined
      console.log('🔍 [ACCEPT] Looking for child:', childId)
      console.log('🔍 [ACCEPT] Organization:', orgId, 'Specialist:', specialistId)
      console.log('🔍 [ACCEPT] Invite data:', {
        orgId: inviteData.orgId,
        specialistId: inviteData.specialistId,
        hasSpecialistId: !!inviteData.specialistId,
      })
      const childRef = db.doc(`children/${childId}`)
      const childSnap = await childRef.get()

      console.log('🔍 [ACCEPT] Child exists:', childSnap.exists)

      const now = new Date()

      // Get parent user ID from request (mobile app user)
      const parentUid = request.user?.uid
      if (!parentUid) {
        return reply.code(401).send({ error: 'Parent user ID required' })
      }

      // Save parent link in orgParents collection
      if (parentUid) {
        const orgParentRef = db.doc(`orgParents/${orgId}/parents/${parentUid}`)
        const orgParentSnap = await orgParentRef.get()

        if (!orgParentSnap.exists) {
          console.log('📝 [ACCEPT] Creating parent-org link')
          await orgParentRef.set({
            linkedSpecialistUid: specialistId || null,
            joinedAt: admin.firestore.Timestamp.fromDate(now),
          })
        } else {
          console.log('📝 [ACCEPT] Parent-org link already exists, updating')
          await orgParentRef.update({
            linkedSpecialistUid: specialistId || null,
          })
        }
      }

      const orgChildrenRef = db.doc(`organizations/${orgId}/children/${childId}`)
      const orgChildrenSnap = await orgChildrenRef.get()

      const childLinkData: any = {
        assigned: true,
        assignedAt: admin.firestore.Timestamp.fromDate(now),
        childId,
        parentUserId: parentUid, // Save parentUserId for faster lookups
      }

      // If specialistId is provided, assign child to that specialist
      // Otherwise, child is available to all specialists in the org (Org Admin can see all)
      if (specialistId) {
        childLinkData.assignedSpecialistId = specialistId
        console.log('📝 [ACCEPT] Assigning child to specialist:', specialistId)
        console.log('📝 [ACCEPT] Child link data will be:', childLinkData)
      } else {
        console.log(
          '⚠️  [ACCEPT] No specialistId in invite! Child will NOT be visible to specialists, only to Org Admin'
        )
        console.log('⚠️  [ACCEPT] Invite data:', inviteData)
      }

      if (!orgChildrenSnap.exists) {
        console.log('📝 [ACCEPT] Creating child-org link')
        await orgChildrenRef.set(childLinkData)
        console.log('✅ [ACCEPT] Child-org link created:', childLinkData)

        // Verify data was saved
        const verifySnap = await orgChildrenRef.get()
        if (verifySnap.exists) {
          console.log('✅ [ACCEPT] Verification - Data saved correctly:', verifySnap.data())
        } else {
          console.error('❌ [ACCEPT] Verification FAILED - Data was not saved!')
        }
      } else {
        console.log('📝 [ACCEPT] Updating child-org link')
        await orgChildrenRef.update(childLinkData)
        console.log('✅ [ACCEPT] Child-org link updated:', childLinkData)

        // Verify data was updated
        const verifySnap = await orgChildrenRef.get()
        if (verifySnap.exists) {
          console.log('✅ [ACCEPT] Verification - Data updated correctly:', verifySnap.data())
        } else {
          console.error('❌ [ACCEPT] Verification FAILED - Data was not updated!')
        }
      }

      if (childSnap.exists) {
        console.log('✅ [ACCEPT] Updating child organizationId')
        await childRef.update({
          organizationId: orgId,
          updatedAt: admin.firestore.Timestamp.fromDate(now),
        })
      } else {
        console.log('ℹ️  [ACCEPT] Child not yet created in Firestore, will be linked when created')
      }

      try {
        await inviteRef.update({ usedCount: (inviteData.usedCount || 0) + 1 })
      } catch {
        // Non-critical: ignore count update failure
      }

      console.log('✅ [ACCEPT] Successfully connected child to specialist')
      return {
        ok: true,
        orgId,
        childId,
        message: 'Child successfully connected to specialist',
      }
    } catch (error: any) {
      console.error('❌ [ACCEPT] Error accepting parent invite:', error)
      return reply.code(500).send({ error: error.message || 'Failed to accept invite code' })
    }
  })

  // GET /api/org/parent-connection/status - Check parent connection status (for mobile app)
  fastify.get('/api/org/parent-connection/status', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()
      const parentUid = request.user.uid

      console.log('🔍 [CONNECTION] Checking connection status for parent:', parentUid)

      // Check if parent is linked to any organization
      const orgsSnapshot = await db.collection('organizations').get()
      const connections: Array<{
        orgId: string
        orgName: string
        specialistId: string | null
        joinedAt: string | null
      }> = []

      for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id
        const orgData = orgDoc.data()

        // Check orgParents collection
        const orgParentRef = db.doc(`orgParents/${orgId}/parents/${parentUid}`)
        const orgParentSnap = await orgParentRef.get()

        if (orgParentSnap.exists) {
          const parentData = orgParentSnap.data()!
          connections.push({
            orgId,
            orgName: orgData.name || orgId,
            specialistId: parentData.linkedSpecialistUid || null,
            joinedAt: parentData.joinedAt?.toDate?.()?.toISOString() || null,
          })
        }
      }

      console.log(
        `✅ [CONNECTION] Found ${connections.length} connection(s) for parent ${parentUid}`
      )

      return {
        ok: true,
        connected: connections.length > 0,
        connections,
      }
    } catch (error: any) {
      console.error('❌ [CONNECTION] Error checking connection status:', error)
      return reply.code(500).send({
        error: 'Failed to check connection status',
        message: error.message,
      })
    }
  })

  // GET /api/specialist/connections - Get parent connections for specialist (mobile app compatibility)
  fastify.get<{ Querystring: { orgId?: string } }>(
    '/api/specialist/connections',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      try {
        const db = getFirestore()
        const specialistUid = request.user.uid
        const orgId = request.query.orgId

        console.log(
          '🔍 [SPECIALIST_CONNECTIONS] Getting connections for specialist:',
          specialistUid,
          'orgId:',
          orgId
        )

        if (!orgId) {
          // If no orgId provided, get all organizations where specialist is a member
          const orgsSnapshot = await db.collection('organizations').get()
          const allConnections: any[] = []

          for (const orgDoc of orgsSnapshot.docs) {
            const orgId = orgDoc.id
            const memberRef = db.doc(`organizations/${orgId}/members/${specialistUid}`)
            const memberSnap = await memberRef.get()

            if (memberSnap.exists) {
              // Get connections for this org
              const connections = await getConnectionsForSpecialist(db, orgId, specialistUid)
              allConnections.push(
                ...connections.map((conn) => ({
                  ...conn,
                  orgId,
                  orgName: orgDoc.data().name || orgId,
                }))
              )
            }
          }

          return {
            ok: true,
            connections: allConnections,
            count: allConnections.length,
          }
        } else {
          // Get connections for specific org
          const connections = await getConnectionsForSpecialist(db, orgId, specialistUid)
          return {
            ok: true,
            connections,
            count: connections.length,
          }
        }
      } catch (error: any) {
        console.error('❌ [SPECIALIST_CONNECTIONS] Error getting connections:', error)
        return reply.code(500).send({
          error: 'Failed to get connections',
          message: error.message,
        })
      }
    }
  )

  // Helper function to get connections for specialist
  async function getConnectionsForSpecialist(
    db: admin.firestore.Firestore,
    orgId: string,
    specialistUid: string
  ) {
    // Get all children assigned to this specialist
    const orgChildrenRef = db.collection(`organizations/${orgId}/children`)
    const assignedChildrenSnap = await orgChildrenRef
      .where('assigned', '==', true)
      .where('assignedSpecialistId', '==', specialistUid)
      .get()

    console.log(
      `📋 [SPECIALIST_CONNECTIONS] Found ${assignedChildrenSnap.docs.length} children for specialist ${specialistUid} in org ${orgId}`
    )

    // Group children by parentUserId
    const parentMap = new Map<
      string,
      Array<{
        childId: string
        childName: string
        childAge?: number
        assignedAt: string | null
      }>
    >()

    for (const childDoc of assignedChildrenSnap.docs) {
      const linkData = childDoc.data()
      const childId = childDoc.id
      const parentUserId = linkData.parentUserId

      if (!parentUserId) {
        console.warn(`⚠️ [SPECIALIST_CONNECTIONS] Child ${childId} has no parentUserId`)
        continue
      }

      // Get child details
      const childRef = db.doc(`children/${childId}`)
      const childSnap = await childRef.get()

      let childName = 'Unknown'
      let childAge: number | undefined

      if (childSnap.exists) {
        const childData = childSnap.data()!
        childName = childData.name || childData.childName || 'Unknown'
        childAge = childData.age || childData.childAge
      }

      if (!parentMap.has(parentUserId)) {
        parentMap.set(parentUserId, [])
      }

      parentMap.get(parentUserId)!.push({
        childId,
        childName,
        childAge,
        assignedAt: linkData.assignedAt?.toDate?.()?.toISOString() || null,
      })
    }

    // Get parent details
    const connections = await Promise.all(
      Array.from(parentMap.entries()).map(async ([parentUserId, children]) => {
        // Get parent info from Auth
        let parentEmail: string | null = null
        let parentDisplayName: string | null = null
        try {
          const auth = admin.auth()
          const parentUser = await auth.getUser(parentUserId)
          parentEmail = parentUser.email || null
          parentDisplayName = parentUser.displayName || null
        } catch (error: any) {
          console.log(
            `⚠️ [SPECIALIST_CONNECTIONS] Could not fetch parent user ${parentUserId} from Auth:`,
            error.message
          )
        }

        // Get parent info from orgParents collection
        const orgParentRef = db.doc(`orgParents/${orgId}/parents/${parentUserId}`)
        const orgParentSnap = await orgParentRef.get()
        const orgParentData = orgParentSnap.exists ? orgParentSnap.data() : null

        return {
          parentUserId,
          parentName: parentDisplayName || 'Unknown',
          parentEmail,
          specialistId: orgParentData?.linkedSpecialistUid || null,
          joinedAt: orgParentData?.joinedAt?.toDate?.()?.toISOString() || null,
          children,
        }
      })
    )

    return connections
  }

  // GET /api/parent/organizations - Get linked organizations for parent (mobile app compatibility)
  fastify.get('/api/parent/organizations', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()
      const parentUid = request.user.uid

      console.log('🔍 [PARENT] Getting linked organizations for parent:', parentUid)

      // Check if parent is linked to any organization
      const orgsSnapshot = await db.collection('organizations').get()
      const organizations: Array<{
        orgId: string
        orgName: string
        specialistId: string | null
        specialistName: string | null
        joinedAt: string | null
      }> = []

      for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id
        const orgData = orgDoc.data()

        // Check orgParents collection
        const orgParentRef = db.doc(`orgParents/${orgId}/parents/${parentUid}`)
        const orgParentSnap = await orgParentRef.get()

        if (orgParentSnap.exists) {
          const parentData = orgParentSnap.data()!
          const specialistId = parentData.linkedSpecialistUid || null
          let specialistName: string | null = null

          // Get specialist name if specialistId exists
          if (specialistId) {
            const specialistRef = db.doc(`specialists/${specialistId}`)
            const specialistSnap = await specialistRef.get()
            if (specialistSnap.exists) {
              const specialistData = specialistSnap.data()!
              specialistName = specialistData.fullName || specialistData.name || null
            }
          }

          organizations.push({
            orgId,
            orgName: orgData.name || orgId,
            specialistId,
            specialistName,
            joinedAt: parentData.joinedAt?.toDate?.()?.toISOString() || null,
          })
        }
      }

      console.log(
        `✅ [PARENT] Found ${organizations.length} organization(s) for parent ${parentUid}`
      )

      return {
        ok: true,
        organizations,
        count: organizations.length,
      }
    } catch (error: any) {
      console.error('❌ [PARENT] Error getting linked organizations:', error)
      return reply.code(500).send({
        error: 'Failed to get linked organizations',
        message: error.message,
      })
    }
  })
}
