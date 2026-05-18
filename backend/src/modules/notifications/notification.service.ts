import admin from 'firebase-admin'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import {
  DEFAULT_PREFERENCES,
  TYPE_TO_CATEGORY,
  type CreateNotificationPayload,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreferences,
  type NotificationType,
} from './notification.types.js'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

// ── Preferences ───────────────────────────────────────────────────────────────

export async function getUserPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const db = getFirestore()
    const userSnap = await db.doc(`users/${userId}`).get()
    const raw = userSnap.data()?.notificationPreferences
    if (!raw) return { ...DEFAULT_PREFERENCES, categories: { ...DEFAULT_PREFERENCES.categories } }
    return {
      allEnabled: raw.allEnabled ?? true,
      pushEnabled: raw.pushEnabled ?? true,
      inAppEnabled: raw.inAppEnabled ?? true,
      categories: {
        assignments: raw.categories?.assignments ?? true,
        messages: raw.categories?.messages ?? true,
        reminders: raw.categories?.reminders ?? true,
        progressUpdates: raw.categories?.progressUpdates ?? true,
        organizationUpdates: raw.categories?.organizationUpdates ?? true,
        billingUpdates: raw.categories?.billingUpdates ?? true,
      },
    }
  } catch {
    return { ...DEFAULT_PREFERENCES, categories: { ...DEFAULT_PREFERENCES.categories } }
  }
}

export async function updateUserPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<void> {
  const db = getFirestore()
  await db.doc(`users/${userId}`).set({ notificationPreferences: prefs }, { merge: true })
}

// ── Preference check ──────────────────────────────────────────────────────────

function isCategoryEnabled(
  prefs: NotificationPreferences,
  category: NotificationCategory
): boolean {
  if (!prefs.allEnabled) return false
  return prefs.categories[category] ?? true
}

// ── Deduplication ─────────────────────────────────────────────────────────────

async function isDuplicate(userId: string, dedupKey: string): Promise<boolean> {
  try {
    const db = getFirestore()
    const since = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000))
    const snap = await db
      .collection(`users/${userId}/notifications`)
      .where('dedupKey', '==', dedupKey)
      .where('createdAt', '>=', since)
      .limit(1)
      .get()
    return !snap.empty
  } catch {
    return false
  }
}

// ── Push token ────────────────────────────────────────────────────────────────

async function getUserPushToken(userId: string): Promise<string | null> {
  try {
    const db = getFirestore()
    const snap = await db.doc(`users/${userId}`).get()
    if (!snap.exists) return null
    const token = snap.data()?.pushToken
    if (typeof token !== 'string' || !token.startsWith('ExponentPushToken')) return null
    return token
  } catch {
    return null
  }
}

// ── Expo send ─────────────────────────────────────────────────────────────────

interface ExpoMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default'
  badge?: number
}

async function sendExpo(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error('[Notifications] Expo API error:', res.status, await res.text())
      return
    }
    const result = (await res.json()) as {
      data: { status: 'ok' | 'error'; message?: string; details?: unknown }[]
    }
    result.data?.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        console.error(`[Notifications] Expo ticket ${i} error:`, ticket.message, ticket.details)
      }
    })
  } catch (err) {
    console.error('[Notifications] Failed to send Expo push:', err)
  }
}

// ── Core dispatch ─────────────────────────────────────────────────────────────

/**
 * Central dispatcher. Handles preferences, deduplication, in-app storage,
 * and push delivery. Fire-and-forget safe — never throws.
 */
export async function dispatch(payload: CreateNotificationPayload): Promise<void> {
  try {
    const db = getFirestore()
    const category = TYPE_TO_CATEGORY[payload.type]
    const channel: NotificationChannel = payload.channel ?? 'both'

    // 1. Preferences check
    const prefs = await getUserPreferences(payload.userId)
    if (!isCategoryEnabled(prefs, category)) return

    // 2. Deduplication check
    if (payload.dedupKey) {
      const dupe = await isDuplicate(payload.userId, payload.dedupKey)
      if (dupe) return
    }

    const now = admin.firestore.FieldValue.serverTimestamp()
    const shouldStoreInApp = (channel === 'in_app' || channel === 'both') && prefs.inAppEnabled
    const shouldPush = (channel === 'push' || channel === 'both') && prefs.pushEnabled

    // 3. Store in-app notification
    if (shouldStoreInApp) {
      await db.collection(`users/${payload.userId}/notifications`).add({
        userId: payload.userId,
        orgId: payload.orgId ?? null,
        role: payload.role,
        type: payload.type,
        category,
        title: payload.title,
        body: payload.body,
        metadata: payload.metadata ?? {},
        read: false,
        readAt: null,
        createdAt: now,
        deliveredAt: null,
        deliveryStatus: 'pending',
        channel,
        priority: payload.priority ?? 'normal',
        dedupKey: payload.dedupKey ?? null,
      })
    }

    // 4. Push notification
    if (shouldPush) {
      const token = await getUserPushToken(payload.userId)
      if (token) {
        await sendExpo([
          {
            to: token,
            title: payload.title,
            body: payload.body,
            data: {
              type: payload.type,
              category,
              ...(payload.metadata ?? {}),
            },
            sound: 'default',
          },
        ])
      }
    }
  } catch (err) {
    console.error('[Notifications] dispatch error:', err)
  }
}

/**
 * Dispatch to multiple users in parallel.
 */
export async function dispatchToMany(
  userIds: string[],
  payload: Omit<CreateNotificationPayload, 'userId'>
): Promise<void> {
  await Promise.all(userIds.map((userId) => dispatch({ ...payload, userId }).catch(console.error)))
}

// ── Read management ───────────────────────────────────────────────────────────

export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  const db = getFirestore()
  await db.doc(`users/${userId}/notifications/${notificationId}`).update({
    read: true,
    readAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

export async function markAllAsRead(userId: string): Promise<number> {
  const db = getFirestore()
  const snap = await db.collection(`users/${userId}/notifications`).where('read', '==', false).get()
  if (snap.empty) return 0
  const batch = db.batch()
  const now = admin.firestore.FieldValue.serverTimestamp()
  snap.docs.forEach((doc) => batch.update(doc.ref, { read: true, readAt: now }))
  await batch.commit()
  return snap.size
}

export async function getUnreadCount(userId: string): Promise<number> {
  const db = getFirestore()
  const snap = await db
    .collection(`users/${userId}/notifications`)
    .where('read', '==', false)
    .count()
    .get()
  return snap.data().count
}

export async function listNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {}
) {
  const db = getFirestore()
  const limit = Math.min(options.limit ?? 50, 100)

  let q = db.collection(`users/${userId}/notifications`).orderBy('createdAt', 'desc').limit(limit)

  if (options.unreadOnly) {
    q = q.where('read', '==', false) as typeof q
  }

  const snap = await q.get()
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.() ?? null,
    readAt: doc.data().readAt?.toDate?.() ?? null,
    deliveredAt: doc.data().deliveredAt?.toDate?.() ?? null,
  }))
}

// ── Device token management ───────────────────────────────────────────────────

export async function registerDeviceToken(userId: string, token: string): Promise<void> {
  const db = getFirestore()
  await db.doc(`users/${userId}`).set(
    {
      pushToken: token,
      pushTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
}

export async function deactivateDeviceToken(userId: string): Promise<void> {
  const db = getFirestore()
  await db.doc(`users/${userId}`).set(
    {
      pushToken: admin.firestore.FieldValue.delete(),
      pushTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
}

// ── Backward-compat wrappers (match old pushNotificationService.ts API) ───────

/** @deprecated Use dispatch() instead */
export async function sendPushToUser(
  userId: string,
  legacyPayload: {
    type: string
    title: string
    body: string
    data?: Record<string, string>
  }
): Promise<void> {
  const typeMap: Record<string, NotificationType> = {
    task_completed: 'task_completed',
    homework_submitted: 'homework_submitted',
    note_added: 'note_added',
    task_assigned: 'task_assigned',
    child_assigned: 'child_assigned',
    reminder: 'assignment_reminder',
  }
  const type: NotificationType =
    (typeMap[legacyPayload.type] as NotificationType | undefined) ?? 'task_assigned'
  const category = TYPE_TO_CATEGORY[type]
  await dispatch({
    userId,
    role: 'specialist',
    type,
    category,
    title: legacyPayload.title,
    body: legacyPayload.body,
    metadata: legacyPayload.data as Record<string, string> | undefined,
    channel: 'both',
  })
}

/** @deprecated Use dispatchToMany() instead */
export async function sendPushToUsers(
  userIds: string[],
  legacyPayload: {
    type: string
    title: string
    body: string
    data?: Record<string, string>
  }
): Promise<void> {
  await Promise.all(userIds.map((uid) => sendPushToUser(uid, legacyPayload)))
}
