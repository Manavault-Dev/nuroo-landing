import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { getFirestore } from '../firebaseAdmin.js'
import { requireOrgMember } from '../plugins/rbac.js'
import { z } from 'zod'

const createInviteSchema = z.object({
  role: z.enum(['specialist', 'admin']).default('specialist'),
  maxUses: z.number().min(1).max(1000).optional(),
  expiresInDays: z.number().min(1).max(365).default(30),
})

export const invitesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof createInviteSchema> }>('/orgs/:orgId/invites', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { orgId } = request.params
    const { uid } = request.user

    const member = await requireOrgMember(request, reply, orgId)

    if (member.role !== 'admin') {
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
  })

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
      const orgsSnapshot = await db.collection('organizations').where('ownerId', '==', uid).limit(1).get()
      
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
    Body?: z.infer<typeof useInviteSchema>
    Querystring?: { inviteCode?: string; code?: string; childId?: string }
  }>('/api/org/parent-invites/accept', async (request, reply) => {
    console.log('🔍 /api/org/parent-invites/accept called', {
      body: request.body,
      query: request.query,
      hasUser: !!request.user
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
      console.log('🔍 [ACCEPT] Looking for invite code:', normalizedCode, 'in collection: parentInvites')
      const inviteRef = db.doc(`parentInvites/${normalizedCode}`)
      const inviteSnap = await inviteRef.get()

      console.log('🔍 [ACCEPT] Invite exists:', inviteSnap.exists)
      if (!inviteSnap.exists) {
        console.log('❌ [ACCEPT] Invite code not found:', normalizedCode)
        try {
          const allInvites = await db.collection('parentInvites').limit(5).get()
          console.log('📋 [ACCEPT] Sample invite codes in DB:', allInvites.docs.map(d => d.id))
        } catch (e) {
          console.error('Error listing invites:', e)
        }
        return reply.code(404).send({ error: 'Invalid invite code', code: normalizedCode })
      }

      const inviteData = inviteSnap.data()!
      console.log('✅ [ACCEPT] Invite found:', { orgId: inviteData.orgId, specialistId: inviteData.specialistId })

      if (inviteData.expiresAt) {
        const expiresAt = inviteData.expiresAt.toDate()
        if (new Date() > expiresAt) {
          return reply.code(400).send({ error: 'Invite code has expired' })
        }
      }

      const orgId = inviteData.orgId as string
      console.log('🔍 [ACCEPT] Looking for child:', childId)
      const childRef = db.doc(`children/${childId}`)
      const childSnap = await childRef.get()

      console.log('🔍 [ACCEPT] Child exists:', childSnap.exists)

      const orgChildrenRef = db.doc(`organizations/${orgId}/children/${childId}`)
      const orgChildrenSnap = await orgChildrenRef.get()

      const now = new Date()

      if (!orgChildrenSnap.exists) {
        console.log('📝 [ACCEPT] Creating child-org link')
        await orgChildrenRef.set({
          assigned: true,
          assignedAt: admin.firestore.Timestamp.fromDate(now),
          childId,
        })
      } else {
        console.log('📝 [ACCEPT] Updating child-org link')
        await orgChildrenRef.update({
          assigned: true,
          assignedAt: admin.firestore.Timestamp.fromDate(now),
        })
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
      } catch {}

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
}

