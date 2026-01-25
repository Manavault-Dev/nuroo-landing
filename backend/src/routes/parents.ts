import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { getFirestore } from '../firebaseAdmin.js'
import { requireOrgMember } from '../plugins/rbac.js'
import { z } from 'zod'

const createParentSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  childIds: z.array(z.string()).optional(),
})

const updateParentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  linkedChildren: z.array(z.string()).optional(),
})

/**
 * Parent contacts management (Org Admin only)
 * Parents are CONTACT ONLY - no authentication
 */
export const parentsRoute: FastifyPluginAsync = async (fastify) => {
  // GET /orgs/:orgId/parents - List all parent contacts
  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/parents',
    async (request, reply) => {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)

      // Only Org Admin can view parent contacts
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only organization admins can view parent contacts' })
      }

      const db = getFirestore()
      const parentsRef = db.collection(`organizations/${orgId}/parents`)
      const parentsSnap = await parentsRef.get()

      const parents = parentsSnap.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate().toISOString(),
      }))

      return { ok: true, parents }
    }
  )

  // POST /orgs/:orgId/parents - Create a parent contact
  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof createParentSchema> }>(
    '/orgs/:orgId/parents',
    async (request, reply) => {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)

      // Only Org Admin can create parent contacts
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only organization admins can create parent contacts' })
      }

      const db = getFirestore()
      const body = createParentSchema.parse(request.body)
      const now = new Date()

      // Generate parent ID (not a Firebase Auth uid)
      const parentRef = db.collection(`organizations/${orgId}/parents`).doc()
      const parentId = parentRef.id

      const parentData = {
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        linkedChildren: body.childIds || [],
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      }

      await parentRef.set(parentData)

      console.log(`✅ [PARENTS] Created parent contact: ${parentId} in org ${orgId}`)

      return {
        ok: true,
        parent: {
          id: parentId,
          ...parentData,
          createdAt: parentData.createdAt.toDate().toISOString(),
          updatedAt: parentData.updatedAt.toDate().toISOString(),
        },
      }
    }
  )

  // PATCH /orgs/:orgId/parents/:parentId - Update a parent contact
  fastify.patch<{ Params: { orgId: string; parentId: string }; Body: z.infer<typeof updateParentSchema> }>(
    '/orgs/:orgId/parents/:parentId',
    async (request, reply) => {
      const { orgId, parentId } = request.params
      const member = await requireOrgMember(request, reply, orgId)

      // Only Org Admin can update parent contacts
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only organization admins can update parent contacts' })
      }

      const db = getFirestore()
      const body = updateParentSchema.parse(request.body)
      const parentRef = db.doc(`organizations/${orgId}/parents/${parentId}`)
      const parentSnap = await parentRef.get()

      if (!parentSnap.exists) {
        return reply.code(404).send({ error: 'Parent contact not found' })
      }

      const updateData: Record<string, unknown> = {
        updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
      }

      if (body.name !== undefined) updateData.name = body.name
      if (body.email !== undefined) updateData.email = body.email || null
      if (body.phone !== undefined) updateData.phone = body.phone || null
      if (body.linkedChildren !== undefined) updateData.linkedChildren = body.linkedChildren

      await parentRef.update(updateData)

      const updatedData = (await parentRef.get()).data()!

      return {
        ok: true,
        parent: {
          id: parentId,
          ...updatedData,
          createdAt: updatedData.createdAt?.toDate().toISOString(),
          updatedAt: updatedData.updatedAt?.toDate().toISOString(),
        },
      }
    }
  )

  // DELETE /orgs/:orgId/parents/:parentId - Delete a parent contact
  fastify.delete<{ Params: { orgId: string; parentId: string } }>(
    '/orgs/:orgId/parents/:parentId',
    async (request, reply) => {
      const { orgId, parentId } = request.params
      const member = await requireOrgMember(request, reply, orgId)

      // Only Org Admin can delete parent contacts
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only organization admins can delete parent contacts' })
      }

      const db = getFirestore()
      const parentRef = db.doc(`organizations/${orgId}/parents/${parentId}`)
      const parentSnap = await parentRef.get()

      if (!parentSnap.exists) {
        return reply.code(404).send({ error: 'Parent contact not found' })
      }

      await parentRef.delete()

      console.log(`✅ [PARENTS] Deleted parent contact: ${parentId} from org ${orgId}`)

      return { ok: true, message: 'Parent contact deleted' }
    }
  )
}
