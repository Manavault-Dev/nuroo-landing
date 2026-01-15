import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { getFirestore } from '../firebaseAdmin.js'
import { requireOrgMember, requireChildAssigned } from '../plugins/rbac.js'
import type { SpecialistNote } from '../types.js'
import { z } from 'zod'

const createNoteSchema = z.object({
  text: z.string().min(1).max(5000),
  tags: z.array(z.string()).optional(),
})

export const notesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/notes',
    async (request, reply) => {
      const { orgId, childId } = request.params

      await requireOrgMember(request, reply, orgId)
      await requireChildAssigned(request, reply, orgId, childId)

      const db = getFirestore()
      const notesRef = db.collection(`children/${childId}/specialistNotes`)
      const notesSnapshot = await notesRef.orderBy('createdAt', 'desc').get()

      const notes: SpecialistNote[] = notesSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          childId,
          orgId: data.orgId || orgId,
          specialistId: data.specialistId,
          specialistName: data.specialistName || 'Unknown',
          text: data.text || data.content || '',
          tags: data.tags || [],
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt?.toDate() || data.createdAt.toDate(),
        }
      })

      return notes
    }
  )

  fastify.post<{ Params: { orgId: string; childId: string }; Body: z.infer<typeof createNoteSchema> }>(
    '/orgs/:orgId/children/:childId/notes',
    async (request, reply) => {
      const { orgId, childId } = request.params

      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const body = createNoteSchema.parse(request.body)

      await requireOrgMember(request, reply, orgId)
      await requireChildAssigned(request, reply, orgId, childId)

      const db = getFirestore()
      const specialistRef = db.doc(`specialists/${request.user.uid}`)
      const specialistSnap = await specialistRef.get()
      const specialistName = specialistSnap.exists
        ? specialistSnap.data()?.name || request.user.email?.split('@')[0] || 'Specialist'
        : request.user.email?.split('@')[0] || 'Specialist'

      const notesRef = db.collection(`children/${childId}/specialistNotes`)
      const now = new Date()

      const noteData = {
        orgId,
        specialistId: request.user.uid,
        specialistName,
        text: body.text,
        tags: body.tags || [],
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      }

      const noteRef = await notesRef.add(noteData)

      const note: SpecialistNote = {
        id: noteRef.id,
        childId,
        orgId,
        specialistId: request.user.uid,
        specialistName,
        text: body.text,
        tags: body.tags,
        createdAt: now,
        updatedAt: now,
      }

      return reply.code(201).send(note)
    }
  )
}
