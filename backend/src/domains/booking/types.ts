export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
export type IntakeStatus = 'not_required' | 'pending' | 'submitted' | 'reviewed'

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface TimeRange {
  start: string // 'HH:MM'
  end: string // 'HH:MM'
}

export interface SpecialistService {
  id: string
  orgId: string
  specialistId: string
  name: string
  description: string | null
  durationMinutes: number
  price: number
  currency: string
  isActive: boolean
  intakeFormId: string | null
  createdAt: string
  updatedAt: string
}

/** Weekly availability template stored per specialist */
export interface AvailabilityTemplate {
  specialistId: string
  orgId: string
  /** map of day → list of time windows */
  schedule: Partial<Record<DayOfWeek, TimeRange[]>>
  slotDurationMinutes: number
  breakBetweenSlotsMinutes: number
  updatedAt: string
}

/** A generated bookable time slot */
export interface Slot {
  id: string
  orgId: string
  specialistId: string
  serviceId: string | null
  date: string // 'YYYY-MM-DD'
  startTime: string // 'HH:MM'
  endTime: string // 'HH:MM'
  status: 'available' | 'booked'
  bookingId: string | null
  createdAt: string
}

export interface BookingDoc {
  orgId: string
  specialistId: string
  parentId: string
  childId: string | null
  serviceId: string | null
  slotId: string
  date: string
  startTime: string
  endTime: string
  status: BookingStatus
  intakeStatus: IntakeStatus
  intakeFormId: string | null
  notes: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
}

export interface IntakeField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'checkbox'
  options?: string[]
  required: boolean
}

export interface IntakeSection {
  id: string
  title: string
  fields: IntakeField[]
}

export interface IntakeFormDoc {
  orgId: string
  name: string
  fields: IntakeField[]
  sections?: IntakeSection[]
  isActive: boolean
  isDefault?: boolean
  createdAt: string
  updatedAt: string
}

export interface IntakeDraftDoc {
  bookingId: string
  parentId: string
  formId: string
  answers: Record<string, string | boolean>
  updatedAt: string
}

export interface IntakeSubmissionDoc {
  bookingId: string
  parentId: string
  formId: string
  templateSnapshot: {
    name: string
    fields: IntakeField[]
    sections?: IntakeSection[]
  }
  answers: Record<string, string | boolean>
  consentGiven: boolean
  submittedAt: string
}

export interface IntakeReviewDoc {
  reviewedAt: string
  reviewedBy: string
}

/** A manually blocked period in a specialist's schedule */
export interface BlockedPeriod {
  id: string
  specialistId: string
  orgId: string
  startDate: string       // 'YYYY-MM-DD'
  endDate: string         // 'YYYY-MM-DD' inclusive
  startTime: string | null // 'HH:MM' — null means full-day block
  endTime: string | null   // 'HH:MM' — null means full-day block
  reason: string | null
  createdAt: string
}
