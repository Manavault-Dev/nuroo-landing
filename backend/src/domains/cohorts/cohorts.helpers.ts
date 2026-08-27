/**
 * cohorts.helpers.ts — shared constants, schemas, and pure utilities
 * used across all cohort route files.
 */
import { z } from 'zod'
import admin from 'firebase-admin'
import type { RecurringTemplate, CohortDoc, SessionDoc, CohortStatus } from './cohorts.types.js'

export const RATE = { max: 60, timeWindow: '1 minute' }

// ─── Firestore path builders ───────────────────────────────────────────────────

export const COL = {
  cohorts:      (orgId: string) => `organizations/${orgId}/cohorts`,
  cohort:       (orgId: string, cohortId: string) => `organizations/${orgId}/cohorts/${cohortId}`,
  sessions:     (orgId: string, cohortId: string) => `organizations/${orgId}/cohorts/${cohortId}/sessions`,
  session:      (orgId: string, cohortId: string, sessionId: string) => `organizations/${orgId}/cohorts/${cohortId}/sessions/${sessionId}`,
  participants: (orgId: string, cohortId: string) => `organizations/${orgId}/cohorts/${cohortId}/participants`,
  participant:  (orgId: string, cohortId: string, participantId: string) => `organizations/${orgId}/cohorts/${cohortId}/participants/${participantId}`,
  attendance:   (orgId: string, cohortId: string, sessionId: string) => `organizations/${orgId}/cohorts/${cohortId}/sessions/${sessionId}/attendance`,
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

export const recurringTemplateSchema = z.object({
  weekdays:    z.array(z.number().int().min(0).max(6)).min(1),
  startTime:   z.string().regex(/^\d{2}:\d{2}$/),
  endTime:     z.string().regex(/^\d{2}:\d{2}$/),
  repeatUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const cohortCreateSchema = z.object({
  title:              z.string().min(1).max(200),
  description:        z.string().max(2000).default(''),
  instructorId:       z.string().nullable().optional(),
  category:           z.string().max(100).nullable().optional(),
  ageMin:             z.number().int().min(0).max(100).nullable().optional(),
  ageMax:             z.number().int().min(0).max(100).nullable().optional(),
  format:             z.enum(['online', 'offline']).default('offline'),
  targetAudience:     z.enum(['children', 'parents', 'specialists', 'all']).default('children'),
  startDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price:              z.number().min(0).default(0),
  currency:           z.string().default('KGS'),
  maxParticipants:    z.number().int().min(1).max(500).default(20),
  scheduleType:       z.enum(['manual', 'recurring']).default('manual'),
  recurringTemplate:  recurringTemplateSchema.nullable().optional(),
  coverUrl:           z.string().url().nullable().optional(),
})

export const COHORT_STATUSES = [
  'draft', 'pending_approval', 'open', 'full', 'in_progress', 'completed', 'archived', 'cancelled',
] as const

export const cohortUpdateSchema = cohortCreateSchema.partial().extend({
  status:            z.enum(COHORT_STATUSES).optional(),
  rejectionComment:  z.string().max(1000).nullable().optional(),
})

export const sessionCreateSchema = z.object({
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/),
  format:    z.enum(['online', 'offline']).optional(),
  topic:     z.string().max(300).nullable().optional(),
  notes:     z.string().max(2000).nullable().optional(),
})

export const sessionUpdateSchema = sessionCreateSchema.partial().extend({
  status:         z.enum(['scheduled', 'completed', 'cancelled', 'postponed']).optional(),
  meetingUrl:     z.string().url().nullable().optional(),
  postponedFrom:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

export const participantCreateSchema = z.object({
  childId:       z.string().min(1),
  childName:     z.string().min(1).max(200),
  parentId:      z.string().min(1),
  parentName:    z.string().max(200).default(''),
  parentPhone:   z.string().max(30).nullable().optional(),
  paymentStatus: z.enum(['paid', 'partial', 'pending']).default('pending'),
  amountPaid:    z.number().min(0).default(0),
})

export const attendanceSchema = z.object({
  records: z.array(z.object({
    childId: z.string().min(1),
    status:  z.enum(['present', 'absent', 'late']),
  })).min(1),
})

// ─── Pure utilities ───────────────────────────────────────────────────────────

export function nowIso(): string {
  return new Date().toISOString()
}

export function sortSessionsBySchedule<T extends Pick<SessionDoc, 'date' | 'startTime'>>(sessions: T[]): T[] {
  return [...sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  )
}

export function generateSessionDates(template: RecurringTemplate, cohortStartDate: string): string[] {
  const dates: string[] = []
  const until  = new Date(template.repeatUntil + 'T00:00:00Z')
  const current = new Date(cohortStartDate + 'T00:00:00Z')
  let safety = 0
  while (current <= until && safety < 500) {
    safety++
    if (template.weekdays.includes(current.getUTCDay())) {
      dates.push(current.toISOString().split('T')[0])
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return dates
}

export async function getOrgMeta(db: admin.firestore.Firestore, orgId: string) {
  const snap = await db.doc(`organizations/${orgId}`).get()
  const d = snap.data()
  return {
    orgName:              (d?.name as string) || null,
    orgLogoUrl:           (d?.logoUrl as string) || null,
    requireGroupApproval: (d?.requireGroupApproval as boolean) ?? false,
  }
}

export async function getSpecialistName(db: admin.firestore.Firestore, uid: string): Promise<string> {
  const snap = await db.doc(`specialists/${uid}`).get()
  const d = snap.data()
  return d?.fullName || d?.name || ''
}

export async function getSpecialistRefreshToken(
  db: admin.firestore.Firestore,
  uid: string | null | undefined,
): Promise<string | null> {
  if (!uid) return null
  const snap = await db.doc(`specialists/${uid}/integrations/google_calendar`).get()
  const d = snap.data()
  if (!d?.connected || !d?.refreshToken) return null
  return d.refreshToken as string
}

export function computeStatus(cohort: CohortDoc): CohortStatus {
  if (cohort.status === 'cancelled' || cohort.status === 'completed') return cohort.status
  if (cohort.enrolledCount >= cohort.maxParticipants) return 'full'
  const today = new Date().toISOString().split('T')[0]
  if (cohort.startDate <= today && cohort.endDate >= today) return 'in_progress'
  if (cohort.endDate < today) return 'completed'
  return cohort.status
}
