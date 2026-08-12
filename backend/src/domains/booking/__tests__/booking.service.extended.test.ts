/**
 * Extended booking service tests — TDD London School.
 * Tests for: no_show status, reschedule transitions, timesOverlap.
 */

import { describe, it, expect } from 'vitest'
import { canTransition, buildStatusUpdate, timesOverlap } from '../booking.service.js'

describe('canTransition — extended with no_show', () => {
  it('allows confirmed → no_show', () => {
    expect(canTransition('confirmed', 'no_show')).toBe(true)
  })

  it('does NOT allow pending → no_show (must be confirmed first)', () => {
    expect(canTransition('pending', 'no_show')).toBe(false)
  })

  it('does NOT allow no_show → cancelled (terminal state)', () => {
    expect(canTransition('no_show', 'cancelled')).toBe(false)
  })

  it('does NOT allow no_show → completed (terminal state)', () => {
    expect(canTransition('no_show', 'completed')).toBe(false)
  })

  it('still allows confirmed → completed', () => {
    expect(canTransition('confirmed', 'completed')).toBe(true)
  })

  it('still allows confirmed → cancelled', () => {
    expect(canTransition('confirmed', 'cancelled')).toBe(true)
  })
})

describe('buildStatusUpdate — no_show', () => {
  it('sets status to no_show and records noShowAt', () => {
    const update = buildStatusUpdate('no_show')
    expect(update.status).toBe('no_show')
    expect(update.noShowAt).toBeDefined()
    expect(update.attendanceStatus).toBe('no_show')
  })

  it('sets cancelReason when reason provided for no_show', () => {
    const update = buildStatusUpdate('no_show', 'Parent did not connect')
    expect(update.cancelReason).toBe('Parent did not connect')
  })

  it('sets attendanceStatus to present on completed', () => {
    const update = buildStatusUpdate('completed')
    expect(update.attendanceStatus).toBe('present')
  })

  it('does not set noShowAt on completed', () => {
    const update = buildStatusUpdate('completed')
    expect(update.noShowAt).toBeUndefined()
  })
})

describe('timesOverlap', () => {
  it('returns true for fully overlapping times', () => {
    expect(timesOverlap('10:00', '11:00', '10:00', '11:00')).toBe(true)
  })

  it('returns true when one contains the other', () => {
    expect(timesOverlap('09:00', '12:00', '10:00', '11:00')).toBe(true)
  })

  it('returns true when times partially overlap', () => {
    expect(timesOverlap('10:00', '11:00', '10:30', '11:30')).toBe(true)
  })

  it('returns false for adjacent times (no gap)', () => {
    // 10:00-11:00 and 11:00-12:00 — adjacent, not overlapping
    expect(timesOverlap('10:00', '11:00', '11:00', '12:00')).toBe(false)
  })

  it('returns false for non-overlapping times', () => {
    expect(timesOverlap('09:00', '10:00', '11:00', '12:00')).toBe(false)
  })

  it('returns false when second slot is earlier', () => {
    expect(timesOverlap('14:00', '15:00', '12:00', '13:00')).toBe(false)
  })
})
