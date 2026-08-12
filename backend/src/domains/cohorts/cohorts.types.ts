// ─── Cohort (replaces pre-recorded Course) ────────────────────────────────────
// UI shows "Курс", backend/DB uses "cohort"

export type CohortStatus =
  | 'draft'
  | 'pending_approval'
  | 'open'
  | 'full'
  | 'in_progress'
  | 'completed'
  | 'archived'
  | 'cancelled'
export type CohortFormat = 'online' | 'offline'
export type CohortAudience = 'children' | 'parents' | 'specialists' | 'all'
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'postponed'
export type ParticipantStatus = 'active' | 'dropped' | 'completed'
export type PaymentStatus = 'paid' | 'partial' | 'pending'
export type AttendanceStatus = 'present' | 'absent' | 'late'
export type ScheduleType = 'manual' | 'recurring'

// ─── Cohort ──────────────────────────────────────────────────────────────────

export interface RecurringTemplate {
  /** 0=Sun,1=Mon,...,6=Sat */
  weekdays: number[]
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
  repeatUntil: string // ISO date "YYYY-MM-DD"
}

export interface CohortDoc {
  id: string
  orgId: string
  title: string
  description: string
  instructorId: string | null // specialist uid
  instructorName: string | null
  category: string | null
  ageMin: number | null
  ageMax: number | null
  format: CohortFormat
  targetAudience: CohortAudience
  startDate: string // ISO date
  endDate: string // ISO date
  price: number
  currency: string // 'KGS'
  maxParticipants: number
  enrolledCount: number
  status: CohortStatus
  scheduleType: ScheduleType
  recurringTemplate: RecurringTemplate | null
  coverUrl: string | null
  /** Google Meet persistent room URL (online cohorts only) */
  meetingUrl: string | null
  /** Google Calendar event ID for cleanup on cancel */
  meetingEventId: string | null
  // ── Approval flow (only active when org.requireGroupApproval === true) ──
  approvalStatus: 'pending' | 'approved' | 'rejected' | null
  submittedForApprovalAt: string | null
  submittedBy: string | null
  approvedAt: string | null
  approvedBy: string | null
  rejectionComment: string | null
  // denormalized for marketplace
  orgName: string | null
  orgLogoUrl: string | null
  createdBy: string // uid
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

// ─── Session (individual class meeting) ──────────────────────────────────────

export interface SessionDoc {
  id: string
  cohortId: string
  orgId: string
  date: string // "YYYY-MM-DD"
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
  format: CohortFormat
  meetingUrl: string | null // Google Meet / Zoom link
  status: SessionStatus
  topic: string | null
  notes: string | null
  /** ISO date if postponed from another date */
  postponedFrom: string | null
  createdAt: string
  updatedAt: string
}

// ─── Participant (child enrolled in cohort) ───────────────────────────────────

export interface ParticipantDoc {
  id: string
  cohortId: string
  orgId: string
  childId: string
  childName: string
  parentId: string
  parentName: string
  parentPhone: string | null
  status: ParticipantStatus
  paymentStatus: PaymentStatus
  amountPaid: number
  totalAmount: number
  currency: string
  enrolledAt: string
  updatedAt: string
}

// ─── Attendance (per session per child) ──────────────────────────────────────

export interface AttendanceDoc {
  childId: string
  sessionId: string
  cohortId: string
  status: AttendanceStatus
  markedAt: string
  markedBy: string // specialist uid
}

// ─── Public marketplace payload ───────────────────────────────────────────────

export interface PublicCohort {
  id: string
  orgId: string
  orgName: string | null
  orgLogoUrl: string | null
  title: string
  description: string
  instructorName: string | null
  category: string | null
  ageMin: number | null
  ageMax: number | null
  format: CohortFormat
  targetAudience: CohortAudience
  startDate: string
  endDate: string
  price: number
  currency: string
  maxParticipants: number
  enrolledCount: number
  spotsLeft: number
  status: CohortStatus
  coverUrl: string | null
}
