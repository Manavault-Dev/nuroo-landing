'use client'

import type { Analytics as FirebaseAnalytics } from 'firebase/analytics'
import { getClientAnalytics } from '@/lib/firebase/config'

// Safe event logger — wraps Firebase Analytics
// Never include child names, diagnoses, therapy notes, or private content
export function track(eventName: string, params?: Record<string, string | number | boolean>) {
  void getClientAnalytics()
    .then(async (instance) => {
      if (!instance) return

      try {
        const { logEvent: firebaseLogEvent } = await import('firebase/analytics')
        firebaseLogEvent(instance as FirebaseAnalytics, eventName, params as Record<string, string>)
      } catch {
        // Analytics must never break the app
      }
    })
    .catch(() => {
      // Analytics must never break the app
    })
}

// ─── Parent events ─────────────────────────────────────────────────────────
export const Analytics = {
  // Parent
  parentSignup: () => track('parent_signup'),
  parentLogin: () => track('parent_login'),
  childAdded: () => track('child_added'),
  assignmentOpened: (params?: { assignmentId?: string }) => track('assignment_opened', params),
  assignmentCompleted: (params?: { assignmentId?: string }) =>
    track('assignment_completed', params),
  activityFeedOpened: () => track('activity_feed_opened'),
  specialistNoteViewed: () => track('specialist_note_viewed'),
  notificationEnabled: () => track('notification_enabled'),

  // Specialist / org
  specialistLogin: () => track('specialist_login'),
  childViewed: () => track('child_viewed'),
  assignmentCreated: () => track('assignment_created'),
  assignmentCreatedWithAi: () => track('assignment_created_with_ai'),
  aiAssignmentGenerationFailed: (params?: { errorType?: string }) =>
    track('ai_assignment_generation_failed', params),
  specialistNoteCreated: () => track('specialist_note_created'),
  parentReplyReceived: () => track('parent_reply_received'),
  activityFeedItemCreated: () => track('activity_feed_item_created'),
  paymentRecorded: () => track('payment_recorded'),
  attendanceRecorded: () => track('attendance_recorded'),

  // Org / SaaS
  orgCreated: () => track('org_created'),
  specialistInvited: () => track('specialist_invited'),
  trialStarted: () => track('trial_started'),
  planUpgraded: (params: { planId: string }) => track('plan_upgraded', params),
  billingPageOpened: () => track('billing_page_opened'),
  paymentStarted: (params: { planId: string }) => track('payment_started', params),
  paymentSuccess: (params: { planId: string; amount?: number }) => track('payment_success', params),
  paymentFailed: (params?: { errorCode?: string }) => track('payment_failed', params),
}
