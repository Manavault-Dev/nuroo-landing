import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember, requireChildAccess } from '../../plugins/rbac.js'
import { dispatch } from '../../modules/notifications/index.js'
import type { SpecialistNote } from '../../types.js'

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
        const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

        const db = getFirestore()
        const notesRef = db.collection(COLLECTIONS.CHILD_NOTES(resolvedChildId))
        const notesSnapshot = await notesRef.orderBy('createdAt', 'desc').get()

        const notes: SpecialistNote[] = notesSnapshot.docs.map((doc) =>
          transformNote(doc, resolvedChildId, orgId)
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
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const db = getFirestore()
      const { uid, email } = request.user
      const specialistName = await getSpecialistName(db, uid, email)

      const notesRef = db.collection(COLLECTIONS.CHILD_NOTES(resolvedChildId))
      const now = new Date()
      const noteData = buildNoteData(orgId, uid, specialistName, body.text, body.tags, now)

      const [noteRef, orgChildSnap] = await Promise.all([
        notesRef.add(noteData),
        db.doc(`organizations/${orgId}/children/${resolvedChildId}`).get(),
      ])

      const parentUserId = orgChildSnap.data()?.parentUserId
      const childName = orgChildSnap.data()?.name || 'your child'

      if (parentUserId) {
        dispatch({
          userId: parentUserId,
          orgId,
          role: 'parent',
          type: 'note_added',
          category: 'progressUpdates',
          title: `📋 New note from ${specialistName}`,
          body: 'A new specialist note has been added.',
          metadata: { childId: resolvedChildId, orgId, specialistId: uid },
          dedupKey: `note_added:${noteRef.id}`,
          channel: 'both',
        }).catch(() => {})
      }

      // Write note to the conversation thread (awaited so failures are visible in logs)
      // convId format: {orgId}_{childId}_{specialistId} — one thread per specialist-child pair
      const convId = `${orgId}_${resolvedChildId}_${uid}`
      const convRef = db.doc(`conversations/${convId}`)

      try {
        // Upsert conversation document in a single atomic merge
        const convData: Record<string, unknown> = {
          orgId,
          childId: resolvedChildId,
          childName,
          specialistId: uid,
          specialistName,
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          lastMessageText: body.text.slice(0, 120),
          lastMessageSenderId: uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }
        if (parentUserId) {
          convData.parentId = parentUserId
        }

        await convRef.set(convData, { merge: true })

        // Increment parent's unread count
        if (parentUserId) {
          await convRef.update({
            [`unread.${parentUserId}`]: admin.firestore.FieldValue.increment(1),
          })
        }

        // Add the note as a message in the conversation
        await db.collection(`conversations/${convId}/messages`).add({
          senderId: uid,
          senderRole: 'specialist',
          senderName: specialistName,
          text: body.text,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          isNote: true,
        })
      } catch (convErr) {
        console.error('[NOTES] Failed to write conversation message:', convErr)
      }

      const note: SpecialistNote = {
        id: noteRef.id,
        childId: resolvedChildId,
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
