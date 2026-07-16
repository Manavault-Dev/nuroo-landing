import { describe, expect, it } from 'vitest'
import {
  canTransition,
  buildStatusUpdate,
  generateSlotsForDay,
  generateSlotsForRange,
  timeToMinutes,
  minutesToTime,
  validateBookingInput,
} from '../booking.service.js'
import type { AvailabilityTemplate } from '../types.js'

describe('timeToMinutes / minutesToTime', () => {
  it('converts 09:00 to 540', () => expect(timeToMinutes('09:00')).toBe(540))
  it('converts 17:30 to 1050', () => expect(timeToMinutes('17:30')).toBe(1050))
  it('converts 540 to 09:00', () => expect(minutesToTime(540)).toBe('09:00'))
  it('converts 1050 to 17:30', () => expect(minutesToTime(1050)).toBe('17:30'))
  it('pads minutes', () => expect(minutesToTime(60 * 9 + 5)).toBe('09:05'))
})

describe('generateSlotsForDay', () => {
  const BASE = { orgId: 'org1', specialistId: 'sp1', serviceId: null }

  it('generates 4 slots for 2-hour window with 30-min slots no break', () => {
    const slots = generateSlotsForDay(
      [{ start: '09:00', end: '11:00' }],
      30, 0, '2025-01-06', BASE.orgId, BASE.specialistId, BASE.serviceId,
    )
    expect(slots).toHaveLength(4)
    expect(slots[0].startTime).toBe('09:00')
    expect(slots[0].endTime).toBe('09:30')
    expect(slots[3].startTime).toBe('10:30')
  })

  it('respects break between slots', () => {
    const slots = generateSlotsForDay(
      [{ start: '09:00', end: '11:00' }],
      30, 10, '2025-01-06', BASE.orgId, BASE.specialistId, BASE.serviceId,
    )
    // step = 40 min → 09:00, 09:40, 10:20 → 3 slots (next would be 11:00 which needs 30 min → 11:30 > 11:00)
    expect(slots).toHaveLength(3)
    expect(slots[1].startTime).toBe('09:40')
    expect(slots[2].startTime).toBe('10:20')
  })

  it('handles multiple windows', () => {
    const slots = generateSlotsForDay(
      [{ start: '09:00', end: '10:00' }, { start: '14:00', end: '15:00' }],
      30, 0, '2025-01-06', BASE.orgId, BASE.specialistId, BASE.serviceId,
    )
    expect(slots).toHaveLength(4)
    expect(slots[0].startTime).toBe('09:00')
    expect(slots[2].startTime).toBe('14:00')
  })

  it('produces no slots when window is shorter than slot', () => {
    const slots = generateSlotsForDay(
      [{ start: '09:00', end: '09:20' }],
      30, 0, '2025-01-06', BASE.orgId, BASE.specialistId, BASE.serviceId,
    )
    expect(slots).toHaveLength(0)
  })
})

describe('generateSlotsForRange', () => {
  const template: AvailabilityTemplate = {
    specialistId: 'sp1',
    orgId: 'org1',
    schedule: {
      mon: [{ start: '09:00', end: '12:00' }],
      wed: [{ start: '10:00', end: '12:00' }],
    },
    slotDurationMinutes: 60,
    breakBetweenSlotsMinutes: 0,
    updatedAt: '2025-01-01T00:00:00Z',
  }

  it('generates slots only for configured days', () => {
    // 2025-01-06 = Monday, 2025-01-07 = Tuesday, 2025-01-08 = Wednesday
    const slots = generateSlotsForRange(template, '2025-01-06', 3, null)
    const monSlots = slots.filter((s) => s.date === '2025-01-06')
    const tueSlots = slots.filter((s) => s.date === '2025-01-07')
    const wedSlots = slots.filter((s) => s.date === '2025-01-08')

    expect(monSlots).toHaveLength(3) // 09:00, 10:00, 11:00
    expect(tueSlots).toHaveLength(0)
    expect(wedSlots).toHaveLength(2) // 10:00, 11:00
  })
})

describe('canTransition', () => {
  it('pending → confirmed allowed', () => expect(canTransition('pending', 'confirmed')).toBe(true))
  it('pending → cancelled allowed', () => expect(canTransition('pending', 'cancelled')).toBe(true))
  it('confirmed → completed allowed', () => expect(canTransition('confirmed', 'completed')).toBe(true))
  it('confirmed → cancelled allowed', () => expect(canTransition('confirmed', 'cancelled')).toBe(true))
  it('completed → anything not allowed', () => {
    expect(canTransition('completed', 'cancelled')).toBe(false)
    expect(canTransition('completed', 'confirmed')).toBe(false)
  })
  it('cancelled → anything not allowed', () => {
    expect(canTransition('cancelled', 'confirmed')).toBe(false)
  })
  it('pending → completed not allowed', () => expect(canTransition('pending', 'completed')).toBe(false))
})

describe('buildStatusUpdate', () => {
  it('sets confirmedAt for confirmed', () => {
    const u = buildStatusUpdate('confirmed')
    expect(u.status).toBe('confirmed')
    expect(u.confirmedAt).toBeTruthy()
    expect(u.cancelledAt).toBeUndefined()
  })

  it('sets cancelledAt and cancelReason for cancelled', () => {
    const u = buildStatusUpdate('cancelled', 'no-show')
    expect(u.status).toBe('cancelled')
    expect(u.cancelledAt).toBeTruthy()
    expect(u.cancelReason).toBe('no-show')
  })

  it('sets completedAt for completed', () => {
    const u = buildStatusUpdate('completed')
    expect(u.completedAt).toBeTruthy()
  })
})

describe('validateBookingInput', () => {
  const futureDate = '2099-06-15'

  it('accepts valid input', () => {
    expect(validateBookingInput('sp1', 'slot1', futureDate)).toBeNull()
  })

  it('rejects missing specialistId', () => {
    expect(validateBookingInput('', 'slot1', futureDate)).not.toBeNull()
  })

  it('rejects missing slotId', () => {
    expect(validateBookingInput('sp1', '', futureDate)).not.toBeNull()
  })

  it('rejects invalid date format', () => {
    expect(validateBookingInput('sp1', 'slot1', '15-06-2099')).not.toBeNull()
  })

  it('rejects past dates', () => {
    expect(validateBookingInput('sp1', 'slot1', '2000-01-01')).not.toBeNull()
  })
})
