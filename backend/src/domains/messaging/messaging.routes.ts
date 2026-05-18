import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember, requireChildAccess } from '../../plugins/rbac.js'
import { dispatch } from '../../modules/notifications/index.js'
import type { SpecialistNote } from '../../types.js'

// ─── messages.ts ──────────────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  text: z.string().min(1).max(4000),
})

async function resolvePartyNames(
  db: admin.firestore.Firestore,
  uid: string,
  email: string | undefined
): Promise<string> {
  const specialistSnap = await db.doc(`specialists/${uid}`).get()
  if (specialistSnap.exists) {
    const d = specialistSnap.data()!
    if (d.name) return d.name
    if (d.fullName) return d.fullName
  }
  const userSnap = await db.doc(`users/${uid}`).get()
  if (userSnap.exists) {
    const d = userSnap.data()!
    if (d.name) return d.name
    if (d.displayName) return d.displayName
    if (d.fullName) return d.fullName
  }
  return email?.split('@')[0] || 'User'
}

export const messagesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/conversations', async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
      }

      const { uid } = request.user
      const db = getFirestore()

      const [asSpecialist, asParent] = await Promise.all([
        db.collection('conversations').where('specialistId', '==', uid).get(),
        db.collection('conversations').where('parentId', '==', uid).get(),
      ])

      const seenIds = new Set<string>()
      const allDocs: admin.firestore.QueryDocumentSnapshot[] = []

      for (const doc of [...asSpecialist.docs, ...asParent.docs]) {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id)
          allDocs.push(doc)
        }
      }

      // Fallback: find conversations via children collection group for old docs
      // that were created before parentId was reliably written (fire-and-forget bug).
      // Also self-heals old docs by writing parentId back.
      try {
        const childrenSnap = await db
          .collectionGroup('children')
          .where('parentUserId', '==', uid)
          .get()

        const convFetches = childrenSnap.docs
          .map((childDoc) => {
            const parts = childDoc.ref.path.split('/')
            // path: organizations/{orgId}/children/{childId}
            if (parts.length < 4) return null
            const orgId = parts[1]
            const childId = parts[3]
            const convId = `${orgId}_${childId}`
            if (seenIds.has(convId)) return null
            return db
              .doc(`conversations/${convId}`)
              .get()
              .then((snap) => ({ snap, convId }))
          })
          .filter(Boolean) as Promise<{ snap: admin.firestore.DocumentSnapshot; convId: string }>[]

        const results = await Promise.all(convFetches)
        for (const { snap, convId } of results) {
          if (snap.exists && !seenIds.has(convId)) {
            seenIds.add(convId)
            allDocs.push(snap as admin.firestore.QueryDocumentSnapshot)
            // Self-heal: write parentId so future queries work without the fallback
            if (!snap.data()?.parentId) {
              snap.ref.update({ parentId: uid }).catch(() => {})
            }
          }
        }
      } catch {
        // Collection group query may fail if index not yet created — safe to ignore
      }

      allDocs.sort((a, b) => {
        const aTs: admin.firestore.Timestamp | undefined = a.data().lastMessageAt
        const bTs: admin.firestore.Timestamp | undefined = b.data().lastMessageAt
        const aMs = aTs ? aTs.toMillis() : 0
        const bMs = bTs ? bTs.toMillis() : 0
        return bMs - aMs
      })

      const conversations = allDocs.map((doc) => {
        const d = doc.data()
        const unreadMap: Record<string, number> = d.unread || {}
        return {
          id: doc.id,
          orgId: d.orgId,
          childId: d.childId,
          childName: d.childName || '',
          specialistId: d.specialistId,
          specialistName: d.specialistName || '',
          parentId: d.parentId || null,
          parentName: d.parentName || '',
          lastMessageAt: d.lastMessageAt
            ? (d.lastMessageAt as admin.firestore.Timestamp).toDate().toISOString()
            : null,
          lastMessageText: d.lastMessageText || '',
          lastMessageSenderId: d.lastMessageSenderId || null,
          unreadCount: unreadMap[uid] || 0,
          createdAt: d.createdAt
            ? (d.createdAt as admin.firestore.Timestamp).toDate().toISOString()
            : null,
        }
      })

      return { ok: true, conversations }
    } catch (error: any) {
      console.error('[MESSAGES] Error listing conversations:', error)
      return reply.code(500).send({ error: 'Failed to list conversations', code: 'INTERNAL_ERROR' })
    }
  })

  fastify.get<{ Params: { convId: string } }>(
    '/api/conversations/:convId/messages',
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
        }

        const { uid } = request.user
        const { convId } = request.params
        const db = getFirestore()

        const convSnap = await db.doc(`conversations/${convId}`).get()
        if (!convSnap.exists) {
          return reply.code(404).send({ error: 'Conversation not found', code: 'NOT_FOUND' })
        }

        const convData = convSnap.data()!
        let hasAccess = convData.specialistId === uid || convData.parentId === uid

        // Old docs may be missing parentId — verify via child's parentUserId field
        if (!hasAccess && convData.childId && convData.orgId) {
          try {
            const childSnap = await db
              .doc(`organizations/${convData.orgId}/children/${convData.childId}`)
              .get()
            if (childSnap.exists && childSnap.data()?.parentUserId === uid) {
              hasAccess = true
              // Self-heal: write parentId so future queries don't need this fallback
              convSnap.ref.update({ parentId: uid }).catch(() => {})
            }
          } catch {
            /* ignore */
          }
        }

        if (!hasAccess) {
          return reply.code(403).send({ error: 'Access denied', code: 'FORBIDDEN' })
        }

        const messagesSnap = await db
          .collection(`conversations/${convId}/messages`)
          .orderBy('sentAt', 'asc')
          .limit(100)
          .get()

        const messages = messagesSnap.docs.map((doc) => {
          const d = doc.data()
          return {
            id: doc.id,
            senderId: d.senderId,
            senderRole: d.senderRole,
            senderName: d.senderName || '',
            text: d.text || '',
            sentAt: d.sentAt
              ? (d.sentAt as admin.firestore.Timestamp).toDate().toISOString()
              : null,
            isNote: d.isNote === true,
          }
        })

        return { ok: true, messages }
      } catch (error: any) {
        console.error('[MESSAGES] Error fetching messages:', error)
        return reply.code(500).send({ error: 'Failed to fetch messages', code: 'INTERNAL_ERROR' })
      }
    }
  )

  fastify.post<{ Params: { convId: string }; Body: z.infer<typeof sendMessageSchema> }>(
    '/api/conversations/:convId/messages',
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
        }

        const body = sendMessageSchema.parse(request.body)
        const { uid, email } = request.user
        const { convId } = request.params

        // convId format: {orgId}_{childId}_{specialistId}
        const parts = convId.split('_')
        if (parts.length < 3) {
          return reply
            .code(400)
            .send({ error: 'Invalid conversation ID format', code: 'BAD_REQUEST' })
        }
        const orgId = parts[0]
        const childId = parts[1]
        const convSpecialistId = parts[2]

        const db = getFirestore()

        const childSnap = await db.doc(`organizations/${orgId}/children/${childId}`).get()
        if (!childSnap.exists) {
          return reply.code(404).send({ error: 'Child not found', code: 'NOT_FOUND' })
        }

        const childData = childSnap.data()!
        const parentUserId: string | undefined = childData.parentUserId

        const isSpecialist = convSpecialistId === uid
        const isParent = parentUserId === uid

        if (!isSpecialist && !isParent) {
          return reply
            .code(403)
            .send({ error: 'Access denied to this conversation', code: 'FORBIDDEN' })
        }

        const senderRole: 'specialist' | 'parent' = isSpecialist ? 'specialist' : 'parent'
        const senderName = await resolvePartyNames(db, uid, email)
        const childName: string = childData.name || childData.childName || 'Child'

        let specialistName = ''
        let parentName = ''

        if (isSpecialist) {
          specialistName = senderName
          if (parentUserId) {
            parentName = await resolvePartyNames(db, parentUserId, undefined)
          }
        } else {
          parentName = senderName
          specialistName = await resolvePartyNames(db, convSpecialistId, undefined)
        }

        const convRef = db.doc(`conversations/${convId}`)
        const otherPartyUid = isSpecialist ? parentUserId : convSpecialistId

        const convBase: Record<string, unknown> = {
          orgId,
          childId,
          childName,
          specialistId: convSpecialistId,
          specialistName,
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          lastMessageText: body.text.slice(0, 120),
          lastMessageSenderId: uid,
        }
        if (parentUserId) {
          convBase.parentId = parentUserId
          convBase.parentName = parentName
        }

        await convRef.set(convBase, { merge: true })

        if (otherPartyUid) {
          await convRef.update({
            [`unread.${otherPartyUid}`]: admin.firestore.FieldValue.increment(1),
          })
        }

        const msgRef = await db.collection(`conversations/${convId}/messages`).add({
          senderId: uid,
          senderRole,
          senderName,
          text: body.text,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          isNote: false,
        })

        if (otherPartyUid) {
          const notifType = isParent ? 'homework_submitted' : 'task_reviewed'
          const notifRole = isParent ? 'specialist' : 'parent'
          const truncatedText = body.text.length > 100 ? body.text.slice(0, 100) + '...' : body.text

          dispatch({
            userId: otherPartyUid,
            orgId,
            role: notifRole,
            type: notifType,
            category: 'messages',
            title: `${senderName}`,
            body: truncatedText,
            metadata: { childId, orgId, specialistId: convSpecialistId },
            channel: 'both',
          }).catch(() => {})
        }

        return reply.code(201).send({ ok: true, messageId: msgRef.id })
      } catch (error: any) {
        if (error?.name === 'ZodError') {
          return reply.code(400).send({ error: 'Invalid request body', code: 'VALIDATION_ERROR' })
        }
        console.error('[MESSAGES] Error sending message:', error)
        return reply.code(500).send({ error: 'Failed to send message', code: 'INTERNAL_ERROR' })
      }
    }
  )

  fastify.patch<{ Params: { convId: string } }>(
    '/api/conversations/:convId/read',
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
        }

        const { uid } = request.user
        const { convId } = request.params
        const db = getFirestore()

        const convSnap = await db.doc(`conversations/${convId}`).get()
        if (!convSnap.exists) {
          return reply.code(404).send({ error: 'Conversation not found', code: 'NOT_FOUND' })
        }

        const convData = convSnap.data()!
        let hasAccess = convData.specialistId === uid || convData.parentId === uid

        if (!hasAccess && convData.childId && convData.orgId) {
          try {
            const childSnap = await db
              .doc(`organizations/${convData.orgId}/children/${convData.childId}`)
              .get()
            if (childSnap.exists && childSnap.data()?.parentUserId === uid) {
              hasAccess = true
              convSnap.ref.update({ parentId: uid }).catch(() => {})
            }
          } catch {
            /* ignore */
          }
        }

        if (!hasAccess) {
          return reply.code(403).send({ error: 'Access denied', code: 'FORBIDDEN' })
        }

        await db.doc(`conversations/${convId}`).update({
          [`unread.${uid}`]: 0,
        })

        return { ok: true }
      } catch (error: any) {
        console.error('[MESSAGES] Error marking conversation read:', error)
        return reply.code(500).send({ error: 'Failed to mark as read', code: 'INTERNAL_ERROR' })
      }
    }
  )
}

// ─── notes.ts ─────────────────────────────────────────────────────────────────

const NOTES_COLLECTIONS = {
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
  const specialistRef = db.doc(`${NOTES_COLLECTIONS.SPECIALISTS}/${uid}`)
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
        const notesRef = db.collection(NOTES_COLLECTIONS.CHILD_NOTES(resolvedChildId))
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

      const notesRef = db.collection(NOTES_COLLECTIONS.CHILD_NOTES(resolvedChildId))
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
          title: `New note from ${specialistName}`,
          body: `${specialistName} left a note about ${childName}`,
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
