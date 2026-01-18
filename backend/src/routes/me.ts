import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { getFirestore } from '../firebaseAdmin.js'
import type { SpecialistProfile } from '../types.js'
import { z } from 'zod'

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

export const meRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid, email } = request.user

    const specialistRef = db.doc(`specialists/${uid}`)
    const specialistSnap = await specialistRef.get()
    
    let name = email?.split('@')[0] || 'Specialist'
    if (specialistSnap.exists) {
      name = specialistSnap.data()?.name || name
    }

    const orgsSnapshot = await db.collection('organizations').get()
    const organizations: Array<{ orgId: string; orgName: string; role: 'specialist' | 'admin' }> = []
    
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id
      const orgData = orgDoc.data()
      const memberRef = db.doc(`organizations/${orgId}/members/${uid}`)
      const memberSnap = await memberRef.get()
      
      if (!memberSnap.exists) continue
      
      const memberData = memberSnap.data()
      if (memberData?.status !== 'active') continue

      organizations.push({
        orgId,
        orgName: orgData.name || orgId,
        role: memberData.role === 'admin' ? 'admin' : 'specialist',
      })
    }

    const profile: SpecialistProfile = { uid, email: email || '', name, organizations }
    return profile
  })

  fastify.post<{ Body: z.infer<typeof updateProfileSchema> }>('/me', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid, email } = request.user
    const body = updateProfileSchema.parse(request.body)

    const specialistRef = db.doc(`specialists/${uid}`)
    const specialistSnap = await specialistRef.get()
    const now = new Date()

    if (specialistSnap.exists) {
      const updateData: Record<string, unknown> = { updatedAt: admin.firestore.Timestamp.fromDate(now) }
      if (body.name) updateData.name = body.name
      await specialistRef.update(updateData)
      const data = (await specialistRef.get()).data()
      return {
        ok: true,
        specialist: { uid, email: email || '', name: data?.name || email?.split('@')[0] || 'Specialist' },
        orgId: data?.orgId || null,
      }
    }

    const newData = {
      uid,
      email: email || '',
      name: body.name || email?.split('@')[0] || 'Specialist',
      createdAt: admin.firestore.Timestamp.fromDate(now),
      updatedAt: admin.firestore.Timestamp.fromDate(now),
    }
    await specialistRef.set(newData)

    const orgsSnapshot = await db.collection('organizations').where('ownerId', '==', uid).limit(1).get()
    let personalOrgId: string | null = null

    if (orgsSnapshot.empty) {
      const personalOrgName = `${newData.name}'s Practice`
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

    return { 
      ok: true, 
      specialist: { uid, email: email || '', name: newData.name }, 
      orgId: personalOrgId 
    }
  })
}
