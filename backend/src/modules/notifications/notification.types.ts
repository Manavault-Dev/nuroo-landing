// ── Notification Types ────────────────────────────────────────────────────────

export type NotificationType =
  | 'task_assigned'       // parent ← specialist created task for child
  | 'task_reviewed'       // parent ← specialist reviewed / commented on submission
  | 'task_completed'      // specialist ← parent completed task
  | 'homework_submitted'  // specialist ← parent submitted homework
  | 'assignment_reminder' // parent ← pending task reminder
  | 'progress_update'     // parent ← progress report added
  | 'note_added'          // parent ← specialist note (existing)
  | 'child_assigned'      // specialist ← admin assigned child (existing)
  | 'specialist_joined'   // admin ← specialist accepted invite
  | 'new_child_added'     // admin ← child added to org
  | 'subscription_update' // admin ← billing / trial status

export type NotificationCategory =
  | 'assignments'
  | 'messages'
  | 'reminders'
  | 'progressUpdates'
  | 'organizationUpdates'
  | 'billingUpdates'

export type NotificationRole = 'parent' | 'specialist' | 'admin'
export type NotificationChannel = 'in_app' | 'push' | 'both'
export type NotificationPriority = 'low' | 'normal' | 'high'
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface NotificationMetadata {
  childId?: string
  taskId?: string
  specialistId?: string
  parentId?: string
  orgId?: string
  deepLink?: string
}

export interface CreateNotificationPayload {
  userId: string
  orgId?: string
  role: NotificationRole
  type: NotificationType
  category: NotificationCategory
  title: string
  body: string
  metadata?: NotificationMetadata
  /** defaults to 'both' */
  channel?: NotificationChannel
  /** defaults to 'normal' */
  priority?: NotificationPriority
  /**
   * If set, skip creating the notification if the same dedupKey was used
   * within the last 24 hours for this userId.
   */
  dedupKey?: string
}

export interface NotificationPreferences {
  allEnabled: boolean
  pushEnabled: boolean
  inAppEnabled: boolean
  categories: {
    assignments: boolean
    messages: boolean
    reminders: boolean
    progressUpdates: boolean
    organizationUpdates: boolean
    billingUpdates: boolean
  }
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  allEnabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  categories: {
    assignments: true,
    messages: true,
    reminders: true,
    progressUpdates: true,
    organizationUpdates: true,
    billingUpdates: true,
  },
}

/** Maps each notification type to its category. */
export const TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
  task_assigned: 'assignments',
  task_reviewed: 'assignments',
  task_completed: 'assignments',
  homework_submitted: 'assignments',
  assignment_reminder: 'reminders',
  progress_update: 'progressUpdates',
  note_added: 'progressUpdates',
  child_assigned: 'organizationUpdates',
  specialist_joined: 'organizationUpdates',
  new_child_added: 'organizationUpdates',
  subscription_update: 'billingUpdates',
}
