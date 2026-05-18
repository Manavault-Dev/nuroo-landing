import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { randomInt } from 'crypto'
import { getFirestore } from '../infrastructure/database/firebase.js'
import { requireOrgMember } from '../plugins/rbac.js'
import { checkOrgCanAddChild } from '../modules/payments/planLimits.js'
import { z } from 'zod'

const createInviteSchema = z.object({
  role: z.enum(['specialist', 'org_admin', 'admin']).default('specialist'),
  maxUses: z.number().min(1).max(1000).optional(),
  expiresInDays: z.number().min(1).max(365).default(30),
})

function registeredChildDisplayName(
  childData: admin.firestore.DocumentData | null | undefined,
  userData?: admin.firestore.DocumentData | null | undefined
): string | undefined {
  const flat =
    childData?.childName ||
    childData?.name ||
    childData?.displayName ||
    childData?.fullName ||
    userData?.childName ||
    userData?.name ||
    userData?.displayName
  if (typeof flat === 'string' && flat.trim()) return flat.trim()
  if (childData?.firstName) {
    return childData.lastName
      ? `${childData.firstName} ${childData.lastName}`.trim()
      : String(childData.firstName).trim()
  }
  return undefined
}

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
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let inviteCode = ''
      for (let i = 0; i < 8; i++) {
        inviteCode += chars.charAt(randomInt(0, chars.length))
      }

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + body.expiresInDays)

      const normalizedRole = body.role === 'admin' ? 'org_admin' : body.role

      const inviteRef = db.doc(`invites/${inviteCode}`)
      await inviteRef.set({
        orgId,
        role: normalizedRole,
        isActive: true,
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
        role: normalizedRole,
        maxUses: body.maxUses || null,
      }
    }
  )

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

        const member = await requireOrgMember(request, reply, orgId)

        if (member.role !== 'specialist' && member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only specialists can create parent invite codes' })
        }

        const now = new Date()

        const parentInviteChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let inviteCode = ''
        for (let i = 0; i < 8; i++) {
          inviteCode += parentInviteChars.charAt(randomInt(0, parentInviteChars.length))
        }
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 365)

        const inviteRef = db.doc(`parentInvites/${inviteCode}`)
        await inviteRef.set({
          specialistId: uid,
          orgId,
          maxUses: null,
          usedCount: 0,
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          createdAt: admin.firestore.Timestamp.fromDate(now),
        })

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
      for (let i = 0; i < 8; i++) {
        inviteCode += chars.charAt(randomInt(0, chars.length))
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

  const _validateInviteSchema = z.object({
    inviteCode: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(100).optional(),
  })

  fastify.post<{
    Body?: z.infer<typeof _validateInviteSchema>
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

  const _useInviteSchema = z.object({
    inviteCode: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(100).optional(),
    childId: z.string().min(1),
  })

  fastify.post<{
    Body?: z.infer<typeof _useInviteSchema>
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
      const callerUid = request.user.uid
      const childRef = db.doc(`children/${childId}`)
      const childSnap = await childRef.get()

      if (!childSnap.exists) {
        return reply.code(404).send({ error: 'Child not found' })
      }

      const childData = childSnap.data()
      if (childData?.parentUserId && childData.parentUserId !== callerUid) {
        return reply.code(403).send({ error: 'Child does not belong to this account' })
      }

      const orgChildrenRef = db.doc(`organizations/${orgId}/children/${childId}`)
      const orgChildrenSnap = await orgChildrenRef.get()

      const now = new Date()

      const linkBase = {
        assigned: true,
        assignedAt: admin.firestore.Timestamp.fromDate(now),
      }
      const registeredName = registeredChildDisplayName(childData)
      const linkPayload = registeredName ? { ...linkBase, childName: registeredName } : linkBase

      if (!orgChildrenSnap.exists) {
        const canAdd = await checkOrgCanAddChild(orgId)
        if (!canAdd.ok) {
          return reply.code(403).send({ error: canAdd.error ?? 'Cannot add child.' })
        }
        await orgChildrenRef.set(linkPayload)
      } else {
        await orgChildrenRef.update(linkPayload)
      }

      await childRef.update({
        organizationId: orgId,
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      })

      try {
        await inviteRef.update({ usedCount: (inviteData.usedCount || 0) + 1 })
      } catch {}

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
    Body?: z.infer<typeof _useInviteSchema>
    Querystring?: { inviteCode?: string; code?: string; childId?: string }
  }>('/api/org/parent-invites/accept', async (request, reply) => {
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
        if (!inviteCode) inviteCode = query?.inviteCode || query?.code || query?.invite_code
        if (!childId) childId = query?.childId || query?.child_id
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
      const specialistId = inviteData.specialistId as string | undefined
      const childRef = db.doc(`children/${childId}`)
      const childSnap = await childRef.get()
      const now = new Date()

      const parentUid = request.user.uid

      const childData = childSnap.exists ? childSnap.data() : null
      if (childData?.parentUserId && childData.parentUserId !== parentUid) {
        return reply.code(403).send({ error: 'Child does not belong to this account' })
      }

      const orgParentRef = db.doc(`orgParents/${orgId}/parents/${parentUid}`)
      const orgParentSnap = await orgParentRef.get()

      if (!orgParentSnap.exists) {
        await orgParentRef.set({
          linkedSpecialistUid: specialistId || null,
          joinedAt: admin.firestore.Timestamp.fromDate(now),
        })
      } else {
        await orgParentRef.update({ linkedSpecialistUid: specialistId || null })
      }

      const orgChildrenRef = db.doc(`organizations/${orgId}/children/${childId}`)
      const orgChildrenSnap = await orgChildrenRef.get()

      const userSnapForName = await db.doc(`users/${childId}`).get()
      const userDataForName = userSnapForName.exists ? userSnapForName.data() : null
      const registeredName = registeredChildDisplayName(childData, userDataForName)

      const childLinkData: any = {
        assigned: true,
        assignedAt: admin.firestore.Timestamp.fromDate(now),
        childId,
        parentUserId: parentUid,
      }

      if (registeredName) {
        childLinkData.childName = registeredName
      }

      if (specialistId) {
        childLinkData.assignedSpecialistId = specialistId
      }

      if (!orgChildrenSnap.exists) {
        const canAdd = await checkOrgCanAddChild(orgId)
        if (!canAdd.ok) {
          return reply.code(403).send({ error: canAdd.error ?? 'Cannot add child.' })
        }
        await orgChildrenRef.set(childLinkData)
      } else {
        await orgChildrenRef.update(childLinkData)
      }

      if (childSnap.exists) {
        await childRef.update({
          organizationId: orgId,
          updatedAt: admin.firestore.Timestamp.fromDate(now),
        })
      }

      try {
        await inviteRef.update({ usedCount: (inviteData.usedCount || 0) + 1 })
      } catch {}

      return { ok: true, orgId, childId, message: 'Child successfully connected to specialist' }
    } catch (error: any) {
      fastify.log.error(error, '[ACCEPT] Error accepting parent invite')
      return reply.code(500).send({ error: 'Failed to accept invite code' })
    }
  })

  fastify.get('/api/org/parent-connection/status', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()
      const parentUid = request.user.uid

      console.log('🔍 [CONNECTION] Checking connection status for parent:', parentUid)

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
          const orgsSnapshot = await db.collection('organizations').get()
          const allConnections: any[] = []

          for (const orgDoc of orgsSnapshot.docs) {
            const orgId = orgDoc.id
            const memberRef = db.doc(`organizations/${orgId}/members/${specialistUid}`)
            const memberSnap = await memberRef.get()

            if (memberSnap.exists) {
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

  async function getConnectionsForSpecialist(
    db: admin.firestore.Firestore,
    orgId: string,
    specialistUid: string
  ) {
    const orgChildrenRef = db.collection(`organizations/${orgId}/children`)
    const assignedChildrenSnap = await orgChildrenRef
      .where('assigned', '==', true)
      .where('assignedSpecialistId', '==', specialistUid)
      .get()

    console.log(
      `📋 [SPECIALIST_CONNECTIONS] Found ${assignedChildrenSnap.docs.length} children for specialist ${specialistUid} in org ${orgId}`
    )

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

      const fromLink =
        (typeof linkData.childName === 'string' && linkData.childName.trim()) ||
        (typeof linkData.name === 'string' && linkData.name.trim()) ||
        ''

      const childRef = db.doc(`children/${childId}`)
      const childSnap = await childRef.get()
      const userRef = db.doc(`users/${childId}`)
      const userSnap = await userRef.get()

      let childName = fromLink || 'Unknown'
      let childAge: number | undefined

      if (childSnap.exists) {
        const childData = childSnap.data()!
        childName = childData.name || childData.childName || childName
        childAge = childData.age || childData.childAge
      }

      if (childName === 'Unknown' && userSnap.exists) {
        const userData = userSnap.data()!
        childName = userData.name || userData.childName || childName
        childAge = childAge || userData.age || userData.childAge
      }

      if (childName === 'Unknown') {
        for (const uid of [...new Set([childId, parentUserId])]) {
          try {
            const authUser = await admin.auth().getUser(uid)
            if (authUser.displayName) {
              childName = authUser.displayName
              break
            }
            if (authUser.email) {
              childName = authUser.email.split('@')[0]
              break
            }
          } catch {}
        }
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

    const connections = await Promise.all(
      Array.from(parentMap.entries()).map(async ([parentUserId, children]) => {
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

  fastify.get('/api/parent/organizations', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()
      const parentUid = request.user.uid

      console.log('🔍 [PARENT] Getting linked organizations for parent:', parentUid)

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

        const orgParentRef = db.doc(`orgParents/${orgId}/parents/${parentUid}`)
        const orgParentSnap = await orgParentRef.get()

        if (orgParentSnap.exists) {
          const parentData = orgParentSnap.data()!
          const specialistId = parentData.linkedSpecialistUid || null
          let specialistName: string | null = null

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
