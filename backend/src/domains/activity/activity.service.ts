import admin from 'firebase-admin'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActivityFeedItemType =
  | 'specialist_note'
  | 'parent_comment'
  | 'assignment_created'
  | 'assignment_completed'
  | 'assignment_reviewed'
  | 'progress_update'
  | 'intake_form_completed'
  | 'system_event'

export type ActivityVisibility = 'internal' | 'parent_visible'

export type ActivityAuthorRole = 'parent' | 'specialist' | 'admin' | 'system'

export interface ActivityFeedItem {
  id: string
  organizationId: string
  childId: string
  type: ActivityFeedItemType
  visibility: ActivityVisibility
  authorId: string
  authorRole: ActivityAuthorRole
  authorName: string
  title?: string
  body: string
  relatedEntityType?: 'assignment' | 'progress' | 'note' | 'intake_form' | 'child'
  relatedEntityId?: string
  metadata?: Record<string, unknown>
  unreadBy?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface ActivityComment {
  id: string
  feedItemId: string
  childId: string
  organizationId: string
  authorId: string
  authorRole: 'parent' | 'specialist' | 'admin'
  authorName: string
  body: string
  visibility: ActivityVisibility
  createdAt: Date
  updatedAt: Date
}

export interface FeedFilters {
  type?: ActivityFeedItemType
  visibility?: ActivityVisibility
  limit?: number
  cursor?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function feedPath(childId: string) {
  return `children/${childId}/activityFeed`
}

function commentsPath(childId: string, feedItemId: string) {
  return `children/${childId}/activityFeed/${feedItemId}/comments`
}

function docToFeedItem(
  doc: admin.firestore.DocumentSnapshot | admin.firestore.QueryDocumentSnapshot,
  childId: string
): ActivityFeedItem {
  const d = doc.data()!
  return {
    id: doc.id,
    organizationId: d.organizationId,
    childId: d.childId ?? childId,
    type: d.type,
    visibility: d.visibility,
    authorId: d.authorId,
    authorRole: d.authorRole,
    authorName: d.authorName,
    title: d.title ?? undefined,
    body: d.body,
    relatedEntityType: d.relatedEntityType ?? undefined,
    relatedEntityId: d.relatedEntityId ?? undefined,
    metadata: d.metadata ?? undefined,
    unreadBy: d.unreadBy ?? [],
    createdAt: d.createdAt?.toDate() ?? new Date(),
    updatedAt: d.updatedAt?.toDate() ?? new Date(),
  }
}

function docToComment(
  doc: admin.firestore.DocumentSnapshot | admin.firestore.QueryDocumentSnapshot,
  childId: string,
  feedItemId: string
): ActivityComment {
  const d = doc.data()!
  return {
    id: doc.id,
    feedItemId: d.feedItemId ?? feedItemId,
    childId: d.childId ?? childId,
    organizationId: d.organizationId,
    authorId: d.authorId,
    authorRole: d.authorRole,
    authorName: d.authorName,
    body: d.body,
    visibility: d.visibility,
    createdAt: d.createdAt?.toDate() ?? new Date(),
    updatedAt: d.updatedAt?.toDate() ?? new Date(),
  }
}

// ── Child resolution ──────────────────────────────────────────────────────────

/**
 * Looks up a child assignment by id or by parentUserId acting as shortId.
 * Returns the resolved Firestore child document id.
 */
export async function getResolvedChildId(
  db: admin.firestore.Firestore,
  orgId: string,
  childId: string
): Promise<string | null> {
  const directSnap = await db.doc(`organizations/${orgId}/children/${childId}`).get()
  if (directSnap.exists) return childId

  const byParent = await db
    .collection(`organizations/${orgId}/children`)
    .where('parentUserId', '==', childId)
    .where('assigned', '==', true)
    .limit(1)
    .get()

  if (byParent.empty) return null
  return byParent.docs[0].id
}

// ── Author name resolution ────────────────────────────────────────────────────

export async function getAuthorName(
  db: admin.firestore.Firestore,
  uid: string,
  email: string | undefined,
  role: ActivityAuthorRole
): Promise<string> {
  const fallback = email?.split('@')[0] ?? 'Unknown'

  if (role === 'system') return 'System'

  try {
    if (role === 'specialist' || role === 'admin') {
      const snap = await db.doc(`specialists/${uid}`).get()
      if (snap.exists) {
        const d = snap.data()!
        return d.name || d.fullName || fallback
      }
    }

    const userSnap = await db.doc(`users/${uid}`).get()
    if (userSnap.exists) {
      const d = userSnap.data()!
      return d.displayName || d.fullName || d.name || fallback
    }
  } catch {
    // best-effort
  }

  return fallback
}

// ── Feed item CRUD ────────────────────────────────────────────────────────────

export async function listFeedItems(
  db: admin.firestore.Firestore,
  childId: string,
  orgId: string,
  role: ActivityAuthorRole | 'parent',
  filters: FeedFilters
): Promise<{ items: ActivityFeedItem[]; nextCursor?: string }> {
  const limit = Math.min(filters.limit ?? 50, 100)
  const colRef = db.collection(feedPath(childId))

  let q = colRef
    .where('organizationId', '==', orgId)
    .orderBy('createdAt', 'desc') as admin.firestore.Query

  // Parents only see parent_visible items
  if (role === 'parent') {
    q = q.where('visibility', '==', 'parent_visible')
  } else if (filters.visibility) {
    q = q.where('visibility', '==', filters.visibility)
  }

  if (filters.type) {
    q = q.where('type', '==', filters.type)
  }

  if (filters.cursor) {
    const cursorDoc = await colRef.doc(filters.cursor).get()
    if (cursorDoc.exists) {
      q = q.startAfter(cursorDoc)
    }
  }

  const snap = await q.limit(limit + 1).get()
  const docs = snap.docs

  let nextCursor: string | undefined
  if (docs.length > limit) {
    docs.pop()
    nextCursor = docs[docs.length - 1].id
  }

  const items = docs.map((d) => docToFeedItem(d, childId))
  return { items, nextCursor }
}

export async function createFeedItem(
  db: admin.firestore.Firestore,
  orgId: string,
  childId: string,
  authorId: string,
  authorRole: ActivityAuthorRole,
  authorName: string,
  data: {
    type: ActivityFeedItemType
    body: string
    title?: string
    visibility: ActivityVisibility
    relatedEntityType?: ActivityFeedItem['relatedEntityType']
    relatedEntityId?: string
    metadata?: Record<string, unknown>
  }
): Promise<ActivityFeedItem> {
  const now = admin.firestore.FieldValue.serverTimestamp()
  const docData = {
    organizationId: orgId,
    childId,
    type: data.type,
    visibility: data.visibility,
    authorId,
    authorRole,
    authorName,
    title: data.title ?? null,
    body: data.body,
    relatedEntityType: data.relatedEntityType ?? null,
    relatedEntityId: data.relatedEntityId ?? null,
    metadata: data.metadata ?? {},
    unreadBy: [] as string[],
    createdAt: now,
    updatedAt: now,
  }

  const ref = await db.collection(feedPath(childId)).add(docData)
  const snap = await ref.get()
  return docToFeedItem(snap, childId)
}

export async function getFeedItem(
  db: admin.firestore.Firestore,
  childId: string,
  feedItemId: string
): Promise<ActivityFeedItem | null> {
  const snap = await db.doc(`${feedPath(childId)}/${feedItemId}`).get()
  if (!snap.exists) return null
  return docToFeedItem(snap, childId)
}

export async function updateFeedItem(
  db: admin.firestore.Firestore,
  childId: string,
  feedItemId: string,
  updates: { body?: string; title?: string; visibility?: ActivityVisibility }
): Promise<ActivityFeedItem> {
  const ref = db.doc(`${feedPath(childId)}/${feedItemId}`)
  const payload: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }
  if (updates.body !== undefined) payload.body = updates.body
  if (updates.title !== undefined) payload.title = updates.title
  if (updates.visibility !== undefined) payload.visibility = updates.visibility

  await ref.update(payload)
  const snap = await ref.get()
  return docToFeedItem(snap, childId)
}

export async function deleteFeedItem(
  db: admin.firestore.Firestore,
  childId: string,
  feedItemId: string
): Promise<void> {
  await db.doc(`${feedPath(childId)}/${feedItemId}`).delete()
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function listComments(
  db: admin.firestore.Firestore,
  childId: string,
  feedItemId: string,
  role: ActivityAuthorRole | 'parent'
): Promise<ActivityComment[]> {
  let q = db
    .collection(commentsPath(childId, feedItemId))
    .orderBy('createdAt', 'asc') as admin.firestore.Query

  if (role === 'parent') {
    q = q.where('visibility', '==', 'parent_visible')
  }

  const snap = await q.get()
  return snap.docs.map((d) => docToComment(d, childId, feedItemId))
}

export async function createComment(
  db: admin.firestore.Firestore,
  childId: string,
  feedItemId: string,
  orgId: string,
  authorId: string,
  authorRole: 'parent' | 'specialist' | 'admin',
  authorName: string,
  body: string,
  visibility: ActivityVisibility
): Promise<ActivityComment> {
  const now = admin.firestore.FieldValue.serverTimestamp()
  const docData = {
    feedItemId,
    childId,
    organizationId: orgId,
    authorId,
    authorRole,
    authorName,
    body,
    visibility,
    createdAt: now,
    updatedAt: now,
  }

  const ref = await db.collection(commentsPath(childId, feedItemId)).add(docData)
  const snap = await ref.get()
  return docToComment(snap, childId, feedItemId)
}

// ── Read receipts ─────────────────────────────────────────────────────────────

export async function markItemsRead(
  db: admin.firestore.Firestore,
  childId: string,
  feedItemIds: string[],
  userId: string
): Promise<void> {
  if (feedItemIds.length === 0) return

  const batch = db.batch()
  for (const id of feedItemIds) {
    const ref = db.doc(`${feedPath(childId)}/${id}`)
    batch.update(ref, {
      unreadBy: admin.firestore.FieldValue.arrayRemove(userId),
    })
  }
  await batch.commit()
}

// ── Migration helper ──────────────────────────────────────────────────────────

export async function migrateSpecialistNotes(
  db: admin.firestore.Firestore,
  orgId: string,
  childId: string
): Promise<number> {
  const notesSnap = await db.collection(`children/${childId}/specialistNotes`).get()
  if (notesSnap.empty) return 0

  const feedRef = db.collection(feedPath(childId))

  // Check which notes are already migrated by tracking source note ids in metadata
  const existingSnap = await feedRef
    .where('type', '==', 'specialist_note')
    .where('organizationId', '==', orgId)
    .get()

  const migratedSourceIds = new Set<string>(
    existingSnap.docs
      .map((d) => d.data().metadata?.sourceNoteId as string | undefined)
      .filter((v): v is string => typeof v === 'string')
  )

  let migrated = 0

  for (const noteDoc of notesSnap.docs) {
    if (migratedSourceIds.has(noteDoc.id)) continue

    const note = noteDoc.data()
    const createdAtTs: admin.firestore.Timestamp = note.createdAt ?? admin.firestore.Timestamp.now()

    await feedRef.add({
      organizationId: orgId,
      childId,
      type: 'specialist_note',
      visibility: 'parent_visible',
      authorId: note.specialistId ?? 'unknown',
      authorRole: 'specialist',
      authorName: note.specialistName ?? 'Specialist',
      title: null,
      body: note.text || note.content || '',
      relatedEntityType: 'note',
      relatedEntityId: noteDoc.id,
      metadata: {
        sourceNoteId: noteDoc.id,
        tags: note.tags ?? [],
        migratedAt: admin.firestore.Timestamp.now().toDate().toISOString(),
      },
      unreadBy: [],
      createdAt: createdAtTs,
      updatedAt: note.updatedAt ?? createdAtTs,
    })

    migrated++
  }

  return migrated
}
