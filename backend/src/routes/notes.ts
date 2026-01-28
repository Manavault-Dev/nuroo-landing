import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../firebaseAdmin.js'
import { requireOrgMember, requireChildAccess } from '../plugins/rbac.js'
import type { SpecialistNote } from '../types.js'

const COLLECTIONS = {
  CHILD_NOTES: (childId: string) => `children/${childId}/specialistNotes`,
  SPECIALISTS: 'specialists',
} as const

const MAX_NOTE_LENGTH = 5000

const createNoteSchema = z.object({
  text: z.string().min(1).max(MAX_NOTE_LENGTH),
  tags: z.array(z.string()).optional(),
})

function extractSpecialistName(
  specialistData: admin.firestore.DocumentData | null,
  email: string | undefined
): string {
  if (specialistData?.name) return specialistData.name
  if (specialistData?.fullName) return specialistData.fullName
  return email?.split('@')[0] || 'Specialist'
}

function transformNote(
  doc: admin.firestore.QueryDocumentSnapshot,
  childId: string,
  orgId: string
): SpecialistNote {
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
}

async function getSpecialistName(
  db: admin.firestore.Firestore,
  uid: string,
  email: string | undefined
): Promise<string> {
  const specialistRef = db.doc(`${COLLECTIONS.SPECIALISTS}/${uid}`)
  const specialistSnap = await specialistRef.get()
  const specialistData = specialistSnap.exists ? specialistSnap.data() : null
  return extractSpecialistName(specialistData, email)
}

function buildNoteData(
  orgId: string,
  uid: string,
  specialistName: string,
  text: string,
  tags: string[] | undefined,
  now: Date
) {
  return {
    orgId,
    specialistId: uid,
    specialistName,
    text,
    tags: tags || [],
    createdAt: admin.firestore.Timestamp.fromDate(now),
    updatedAt: admin.firestore.Timestamp.fromDate(now),
  }
}

export const notesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/notes',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params

        await requireOrgMember(request, reply, orgId)
        await requireChildAccess(request, reply, orgId, childId)

        const db = getFirestore()
        const notesRef = db.collection(COLLECTIONS.CHILD_NOTES(childId))
        const notesSnapshot = await notesRef.orderBy('createdAt', 'desc').get()

        const notes: SpecialistNote[] = notesSnapshot.docs.map((doc) =>
          transformNote(doc, childId, orgId)
        )

        return notes
      } catch (error: any) {
        console.error('[NOTES] Error fetching notes:', error)
        return reply.code(500).send({
          error: 'Failed to fetch notes',
          details: error.message,
        })
      }
    }
  )

  fastify.post<{
    Params: { orgId: string; childId: string }
    Body: z.infer<typeof createNoteSchema>
  }>('/orgs/:orgId/children/:childId/notes', async (request, reply) => {
    try {
      const { orgId, childId } = request.params

      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const body = createNoteSchema.parse(request.body)

      await requireOrgMember(request, reply, orgId)
      await requireChildAccess(request, reply, orgId, childId)

      const db = getFirestore()
      const { uid, email } = request.user
      const specialistName = await getSpecialistName(db, uid, email)

      const notesRef = db.collection(COLLECTIONS.CHILD_NOTES(childId))
      const now = new Date()
      const noteData = buildNoteData(orgId, uid, specialistName, body.text, body.tags, now)

      const noteRef = await notesRef.add(noteData)

      const note: SpecialistNote = {
        id: noteRef.id,
        childId,
        orgId,
        specialistId: uid,
        specialistName,
        text: body.text,
        tags: body.tags,
        createdAt: now,
        updatedAt: now,
      }

      return reply.code(201).send(note)
    } catch (error: any) {
      console.error('[NOTES] Error creating note:', error)
      return reply.code(500).send({
        error: 'Failed to create note',
        details: error.message,
      })
    }
  })
}
