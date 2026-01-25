import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { getFirestore } from '../firebaseAdmin.js'
import { requireOrgMember } from '../plugins/rbac.js'
import { z } from 'zod'

const assignChildSchema = z.object({
  childId: z.string().min(1),
  specialistId: z.string().min(1), // uid of specialist
})

const unassignChildSchema = z.object({
  childId: z.string().min(1),
})

/**
 * Child assignment management (Org Admin only)
 * Org Admins can assign children to specialists
 */
export const assignmentsRoute: FastifyPluginAsync = async (fastify) => {
  // POST /orgs/:orgId/assignments - Assign a child to a specialist
  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof assignChildSchema> }>(
    '/orgs/:orgId/assignments',
    async (request, reply) => {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)

      // Only Org Admin can assign children
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only organization admins can assign children to specialists' })
      }

      const db = getFirestore()
      const body = assignChildSchema.parse(request.body)
      const { childId, specialistId } = body
      const now = new Date()

      // Verify child is assigned to org
      const childAssignmentRef = db.doc(`organizations/${orgId}/children/${childId}`)
      const childAssignmentSnap = await childAssignmentRef.get()

      if (!childAssignmentSnap.exists || childAssignmentSnap.data()?.assigned !== true) {
        return reply.code(404).send({ error: 'Child is not assigned to this organization' })
      }

      // Verify specialist is a member of the org
      const specialistMemberRef = db.doc(`organizations/${orgId}/members/${specialistId}`)
      const specialistMemberSnap = await specialistMemberRef.get()

      if (!specialistMemberSnap.exists) {
        return reply.code(404).send({ error: 'Specialist is not a member of this organization' })
      }

      const specialistMemberData = specialistMemberSnap.data()
      if (specialistMemberData?.role !== 'specialist') {
        return reply.code(400).send({ error: 'User is not a specialist' })
      }

      if (specialistMemberData?.status !== 'active') {
        return reply.code(400).send({ error: 'Specialist account is not active' })
      }

      // Update assignment
      await childAssignmentRef.update({
        assignedSpecialistId: specialistId,
        assignedAt: admin.firestore.Timestamp.fromDate(now),
      })

      console.log(`✅ [ASSIGNMENTS] Child ${childId} assigned to specialist ${specialistId} in org ${orgId}`)

      return {
        ok: true,
        message: 'Child assigned to specialist',
        childId,
        specialistId,
      }
    }
  )

  // DELETE /orgs/:orgId/assignments - Unassign a child from specialist
  fastify.delete<{ Params: { orgId: string }; Body: z.infer<typeof unassignChildSchema> }>(
    '/orgs/:orgId/assignments',
    async (request, reply) => {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)

      // Only Org Admin can unassign children
      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only organization admins can unassign children' })
      }

      const db = getFirestore()
      const body = unassignChildSchema.parse(request.body)
      const { childId } = body

      // Verify child is assigned to org
      const childAssignmentRef = db.doc(`organizations/${orgId}/children/${childId}`)
      const childAssignmentSnap = await childAssignmentRef.get()

      if (!childAssignmentSnap.exists || childAssignmentSnap.data()?.assigned !== true) {
        return reply.code(404).send({ error: 'Child is not assigned to this organization' })
      }

      // Remove specialist assignment (but keep child assigned to org)
      await childAssignmentRef.update({
        assignedSpecialistId: admin.firestore.FieldValue.delete(),
      })

      console.log(`✅ [ASSIGNMENTS] Child ${childId} unassigned from specialist in org ${orgId}`)

      return {
        ok: true,
        message: 'Child unassigned from specialist',
        childId,
      }
    }
  )
}
