import admin from 'firebase-admin'
import { getFirestore } from '../infrastructure/database/firebase.js'

export type NotificationType =
  | 'task_completed'
  | 'homework_submitted'
  | 'note_added'
  | 'task_assigned'
  | 'child_assigned'
  | 'reminder'

export interface PushPayload {
  type: NotificationType
  title: string
  body: string
  data?: Record<string, string>
}

interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default'
  badge?: number
}

interface ExpoPushResponse {
  data: { status: 'ok' | 'error'; message?: string; details?: unknown }[]
}

async function getUserPushToken(userId: string): Promise<string | null> {
  const db = getFirestore()
  const userSnap = await db.doc(`users/${userId}`).get()
  if (!userSnap.exists) return null
  const token = userSnap.data()?.pushToken
  if (typeof token !== 'string' || !token.startsWith('ExponentPushToken')) return null
  return token
}

async function writeNotificationHistory(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  const db = getFirestore()
  await db.collection(`users/${userId}/notifications`).add({
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

async function sendExpoNotifications(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
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
    console.error('[Push] Expo API error:', res.status, await res.text())
    return
  }

  const result = (await res.json()) as ExpoPushResponse
  result.data?.forEach((ticket, i) => {
    if (ticket.status === 'error') {
      console.error(`[Push] Ticket ${i} error:`, ticket.message, ticket.details)
    }
  })
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const [token] = await Promise.all([
    getUserPushToken(userId),
    writeNotificationHistory(userId, payload),
  ])

  if (!token) return

  await sendExpoNotifications([
    {
      to: token,
      title: payload.title,
      body: payload.body,
      data: { type: payload.type, ...payload.data },
      sound: 'default',
    },
  ])
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  const tokens = await Promise.all(
    userIds.map(async (uid) => {
      const token = await getUserPushToken(uid)
      await writeNotificationHistory(uid, payload)
      return token
    }),
  )

  const messages: ExpoPushMessage[] = tokens
    .filter((t): t is string => t !== null)
    .map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: { type: payload.type, ...payload.data },
      sound: 'default',
    }))

  await sendExpoNotifications(messages)
}
