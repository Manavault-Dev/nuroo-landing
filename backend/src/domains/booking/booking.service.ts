import type {
  AvailabilityTemplate,
  BookingDoc,
  BookingStatus,
  DayOfWeek,
  Slot,
  TimeRange,
} from './types.js'

const DAY_MAP: Record<DayOfWeek, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

const DAY_KEYS: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** Convert 'HH:MM' to total minutes since midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Convert total minutes to 'HH:MM' */
export function minutesToTime(m: number): string {
  const hh = Math.floor(m / 60)
    .toString()
    .padStart(2, '0')
  const mm = (m % 60).toString().padStart(2, '0')
  return `${hh}:${mm}`
}

/** Generate slots for a single day given the availability windows */
export function generateSlotsForDay(
  windows: TimeRange[],
  slotDurationMinutes: number,
  breakMinutes: number,
  date: string,
  orgId: string,
  specialistId: string,
  serviceId: string | null
): Omit<Slot, 'id' | 'status' | 'bookingId'>[] {
  const slots: Omit<Slot, 'id' | 'status' | 'bookingId'>[] = []
  const step = slotDurationMinutes + breakMinutes

  for (const window of windows) {
    let cursor = timeToMinutes(window.start)
    const endMin = timeToMinutes(window.end)

    while (cursor + slotDurationMinutes <= endMin) {
      slots.push({
        orgId,
        specialistId,
        serviceId,
        date,
        startTime: minutesToTime(cursor),
        endTime: minutesToTime(cursor + slotDurationMinutes),
        createdAt: new Date().toISOString(),
      })
      cursor += step
    }
  }

  return slots
}

/** Generate slots for a date range from an availability template */
export function generateSlotsForRange(
  template: AvailabilityTemplate,
  startDate: string,
  days: number,
  serviceId: string | null
): Omit<Slot, 'id' | 'status' | 'bookingId'>[] {
  const result: Omit<Slot, 'id' | 'status' | 'bookingId'>[] = []
  const start = new Date(startDate + 'T00:00:00Z')

  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    const dayKey = DAY_KEYS[d.getUTCDay()]
    const windows = template.schedule[dayKey]
    if (!windows || windows.length === 0) continue

    const dateStr = d.toISOString().split('T')[0]
    const daySlots = generateSlotsForDay(
      windows,
      template.slotDurationMinutes,
      template.breakBetweenSlotsMinutes,
      dateStr,
      template.orgId,
      template.specialistId,
      serviceId
    )
    result.push(...daySlots)
  }

  return result
}

/** Validate booking state transition */
export function canTransition(current: BookingStatus, next: BookingStatus): boolean {
  const allowed: Record<BookingStatus, BookingStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  }
  return allowed[current].includes(next)
}

/** Build a partial booking update for a status transition */
export function buildStatusUpdate(next: BookingStatus, reason?: string): Partial<BookingDoc> {
  const now = new Date().toISOString()
  const base: Partial<BookingDoc> = { status: next, updatedAt: now }
  if (next === 'confirmed') base.confirmedAt = now
  if (next === 'completed') base.completedAt = now
  if (next === 'cancelled') {
    base.cancelledAt = now
    base.cancelReason = reason ?? null
  }
  return base
}

/** Validate booking input from the client */
export function validateBookingInput(
  specialistId: string,
  slotId: string,
  date: string
): string | null {
  if (!specialistId || typeof specialistId !== 'string') return 'specialistId is required'
  if (!slotId || typeof slotId !== 'string') return 'slotId is required'
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'date must be YYYY-MM-DD'
  const d = new Date(date + 'T00:00:00Z')
  if (isNaN(d.getTime())) return 'date is invalid'
  // Allow booking up to 1 day in the past (timezone tolerance)
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  if (d < yesterday) return 'cannot book in the past'
  return null
}
