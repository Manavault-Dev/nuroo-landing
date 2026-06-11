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
const EXPO_RECEIPT_URL = 'https://exp.host/--/api/v2/push/getReceipts'

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

// ── Push token management ─────────────────────────────────────────────────────

/**
 * Returns ALL push tokens for a user.
 * We store tokens as a map { [token]: { registeredAt, platform } }
 * plus a legacy top-level `pushToken` field for backward compat.
 */
async function getUserPushTokens(userId: string): Promise<string[]> {
  try {
    const db = getFirestore()
    const snap = await db.doc(`users/${userId}`).get()
    if (!snap.exists) return []
    const data = snap.data() ?? {}

    const tokens = new Set<string>()

    // New format: pushTokens map
    const tokensMap = data.pushTokens as Record<string, unknown> | undefined
    if (tokensMap && typeof tokensMap === 'object') {
      for (const token of Object.keys(tokensMap)) {
        if (token.startsWith('ExponentPushToken')) {
          tokens.add(token)
        }
      }
    }

    // Legacy format: single pushToken field
    const legacy = data.pushToken as string | undefined
    if (legacy && legacy.startsWith('ExponentPushToken')) {
      tokens.add(legacy)
    }

    return Array.from(tokens)
  } catch {
    return []
  }
}

/** Remove a specific stale token from Firestore (called when Expo says DeviceNotRegistered). */
async function removeStaleToken(userId: string, token: string): Promise<void> {
  try {
    const db = getFirestore()
    const encodedToken = token.replace(/[[\]]/g, '_')
    await db.doc(`users/${userId}`).set(
      {
        [`pushTokens.${encodedToken}`]: admin.firestore.FieldValue.delete(),
        ...(token === (await db.doc(`users/${userId}`).get()).data()?.pushToken
          ? { pushToken: admin.firestore.FieldValue.delete() }
          : {}),
      },
      { merge: true }
    )
    console.log(`[Notifications] Removed stale token for user ${userId}`)
  } catch (err) {
    console.error('[Notifications] Failed to remove stale token:', err)
  }
}

// ── Expo send with retry + receipt tracking ───────────────────────────────────

interface ExpoMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default'
  badge?: number
  /** FIX B1: priority 'high' wakes Android from Doze mode */
  priority?: 'default' | 'normal' | 'high'
  /** FIX B2: explicit Android channel ensures IMPORTANCE_HIGH */
  channelId?: string
  /** TTL in seconds — how long FCM/APNs should retry delivery */
  ttl?: number
  /** Expiration epoch seconds */
  expiration?: number
}

interface ExpoTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

interface ExpoReceipt {
  status: 'ok' | 'error'
  message?: string
  details?: { error?: string }
}

async function sendExpoWithRetry(messages: ExpoMessage[], retryCount = 0): Promise<ExpoTicket[]> {
  if (messages.length === 0) return []

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(12_000),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[Notifications] Expo API HTTP error:', res.status, body)

      // FIX B9: retry once on 5xx or rate limit
      if ((res.status >= 500 || res.status === 429) && retryCount === 0) {
        await new Promise((r) => setTimeout(r, 2000))
        return sendExpoWithRetry(messages, 1)
      }
      return []
    }

    const result = (await res.json()) as { data: ExpoTicket[] }
    return result.data ?? []
  } catch (err) {
    console.error('[Notifications] Expo send failed:', err)
    if (retryCount === 0) {
      await new Promise((r) => setTimeout(r, 2000))
      return sendExpoWithRetry(messages, 1)
    }
    return []
  }
}

/**
 * Poll Expo receipts for a batch of ticket IDs.
 * Called ~30s after sending to confirm actual delivery.
 * Cleans up DeviceNotRegistered tokens automatically.
 */
export async function pollExpoReceipts(
  ticketIds: string[],
  tokenByTicketId: Record<string, string>,
  userIdByTicketId: Record<string, string>
): Promise<void> {
  if (ticketIds.length === 0) return

  try {
    const res = await fetch(EXPO_RECEIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ids: ticketIds }),
      signal: AbortSignal.timeout(12_000),
    })

    if (!res.ok) {
      console.error('[Notifications] Receipt poll HTTP error:', res.status)
      return
    }

    const result = (await res.json()) as { data: Record<string, ExpoReceipt> }

    for (const [id, receipt] of Object.entries(result.data ?? {})) {
      if (receipt.status === 'error') {
        const errType = receipt.details?.error
        const token = tokenByTicketId[id]
        const userId = userIdByTicketId[id]

        console.error(`[Notifications] Receipt error for ticket ${id}:`, receipt.message, errType)

        // FIX B4 + B6: DeviceNotRegistered → clean stale token
        if (errType === 'DeviceNotRegistered' && token && userId) {
          await removeStaleToken(userId, token)
        }
      }
    }
  } catch (err) {
    console.error('[Notifications] Receipt poll failed:', err)
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
    let notifDocRef: admin.firestore.DocumentReference | null = null
    if (shouldStoreInApp) {
      notifDocRef = await db.collection(`users/${payload.userId}/notifications`).add({
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

    // 4. Push notification — FIX B1 B2 B6: priority high + channelId + all tokens
    if (shouldPush) {
      const tokens = await getUserPushTokens(payload.userId)

      if (tokens.length > 0) {
        // Calculate the real unread count so iOS/Android badge is always accurate.
        // getUnreadCount is called AFTER the in-app notification document is committed
        // (step 3 above), so the count already includes the new notification.
        let badgeCount = 1
        try {
          badgeCount = await getUnreadCount(payload.userId)
        } catch {
          badgeCount = 1
        }

        const messages: ExpoMessage[] = tokens.map((token) => ({
          to: token,
          title: payload.title,
          body: payload.body,
          data: {
            type: payload.type,
            category,
            role: payload.role,
            ...(payload.metadata ?? {}),
          },
          sound: 'default',
          priority: 'high', // FIX B1: wake from Doze/terminated
          channelId: 'nuroo-default', // FIX B2: explicit high-importance Android channel
          ttl: 86400, // 24h delivery window
          badge: badgeCount, // Accurate unread count so OS badge is always correct
        }))

        const tickets = await sendExpoWithRetry(messages)

        // Build maps for receipt polling
        const ticketIds: string[] = []
        const tokenByTicketId: Record<string, string> = {}
        const userIdByTicketId: Record<string, string> = {}

        tickets.forEach((ticket, i) => {
          if (ticket.status === 'ok' && ticket.id) {
            ticketIds.push(ticket.id)
            tokenByTicketId[ticket.id] = tokens[i] ?? ''
            userIdByTicketId[ticket.id] = payload.userId
          } else if (ticket.status === 'error') {
            console.error(
              `[Notifications] Expo ticket error for user ${payload.userId}:`,
              ticket.message
            )
            if (ticket.details?.error === 'DeviceNotRegistered' && tokens[i]) {
              removeStaleToken(payload.userId, tokens[i]).catch(console.error)
            }
          }
        })

        // FIX B4: poll receipts after 35s (fire-and-forget)
        if (ticketIds.length > 0) {
          setTimeout(
            () =>
              pollExpoReceipts(ticketIds, tokenByTicketId, userIdByTicketId).catch(console.error),
            35_000
          )
        }

        // Update delivery status in DB
        if (notifDocRef && tickets.some((t) => t.status === 'ok')) {
          notifDocRef
            .update({
              deliveryStatus: 'sent',
              deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
            })
            .catch(() => {})
        }
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

/**
 * Register (or update) a push token for a user.
 * FIX B6: stores token in a map keyed by token value to support multiple devices.
 */
export async function registerDeviceToken(userId: string, token: string): Promise<void> {
  const db = getFirestore()
  const encodedToken = token.replace(/[[\]]/g, '_')
  await db.doc(`users/${userId}`).set(
    {
      // New: token map for multi-device support
      pushTokens: {
        [encodedToken]: {
          token,
          registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      // Legacy compat: keep single token field
      pushToken: token,
      pushTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
}

export async function deactivateDeviceToken(userId: string, token?: string): Promise<void> {
  const db = getFirestore()
  if (token) {
    // Remove specific token
    const encodedToken = token.replace(/[[\]]/g, '_')
    await db.doc(`users/${userId}`).set(
      {
        [`pushTokens.${encodedToken}`]: admin.firestore.FieldValue.delete(),
        pushToken: admin.firestore.FieldValue.delete(),
        pushTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  } else {
    // Remove all tokens
    await db.doc(`users/${userId}`).set(
      {
        pushTokens: admin.firestore.FieldValue.delete(),
        pushToken: admin.firestore.FieldValue.delete(),
        pushTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  }
}

// ── Backward-compat wrappers ──────────────────────────────────────────────────

/** @deprecated Use dispatch() instead */
export async function sendPushToUser(
  userId: string,
  legacyPayload: { type: string; title: string; body: string; data?: Record<string, string> }
): Promise<void> {
  const typeMap: Record<string, NotificationType> = {
    task_completed: 'task_completed',
    homework_submitted: 'homework_submitted',
    note_added: 'note_added',
    task_assigned: 'task_assigned',
    child_assigned: 'child_assigned',
    reminder: 'assignment_reminder',
    new_message: 'new_message',
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
  legacyPayload: { type: string; title: string; body: string; data?: Record<string, string> }
): Promise<void> {
  await Promise.all(userIds.map((uid) => sendPushToUser(uid, legacyPayload)))
}
