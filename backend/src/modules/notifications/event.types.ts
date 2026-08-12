export interface BookingConfirmedEvent {
  type: 'booking_confirmed'
  bookingId: string
  orgId: string
  orgName: string
  parentId: string
  parentName: string
  parentEmail: string
  specialistName: string
  serviceName?: string | null
  date: string
  startTime: string
  endTime: string
  meetingUrl?: string | null
}

export interface BookingCancelledEvent {
  type: 'booking_cancelled'
  bookingId: string
  orgId: string
  parentId: string
  parentName: string
  parentEmail?: string
  specialistName: string
  date: string
  startTime: string
  reason?: string | null
}

export interface BookingReminderEvent {
  type: 'booking_reminder_24h' | 'booking_reminder_1h'
  bookingId: string
  parentId: string
  parentName: string
  parentEmail: string
  specialistName: string
  date: string
  startTime: string
  endTime: string
  meetingUrl?: string | null
}

export interface CohortEnrollmentConfirmedEvent {
  type: 'cohort_enrollment_confirmed'
  orgId: string
  cohortId: string
  cohortTitle: string
  parentId: string
  parentName: string
  parentEmail: string
  specialistName: string
  orgName: string
  startDate: string
  meetingUrl?: string | null
}

export interface ReportReadyEvent {
  type: 'report_ready'
  orgId: string
  childId: string
  childName: string
  parentId: string
  parentName: string
  parentEmail: string
  specialistName: string
  orgName: string
}

export interface PaymentSucceededEvent {
  type: 'payment_succeeded'
  orgId: string
  adminId: string
  adminName: string
  adminEmail: string
  planName: string
  amountKgs: number
  periodEnd: string
}

export interface WelcomeEvent {
  type: 'welcome'
  userId: string
  name: string
  email: string
}

export type DomainEvent =
  | BookingConfirmedEvent
  | BookingCancelledEvent
  | BookingReminderEvent
  | CohortEnrollmentConfirmedEvent
  | ReportReadyEvent
  | PaymentSucceededEvent
  | WelcomeEvent
