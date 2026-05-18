/**
 * Backward-compatible re-exports from the centralized notifications module.
 * All callers (assignments.ts, parentTasks.ts, notes.ts, children.ts) continue
 * to work without changes. Prefer importing directly from
 * '../modules/notifications/index.js' for new code.
 */
export { sendPushToUser, sendPushToUsers } from '../modules/notifications/notification.service.js'
export type { NotificationType } from '../modules/notifications/notification.types.js'

/** @deprecated Legacy type — use CreateNotificationPayload from notification.types.ts */
export interface PushPayload {
  type: string
  title: string
  body: string
  data?: Record<string, string>
}
