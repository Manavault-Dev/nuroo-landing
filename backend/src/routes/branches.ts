import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../infrastructure/database/firebase.js'
import { requireOrgMember } from '../plugins/rbac.js'
import { checkOrgHasFeature } from '../modules/payments/planLimits.js'

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
