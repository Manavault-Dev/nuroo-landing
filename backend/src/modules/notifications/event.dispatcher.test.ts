/**
 * TDD tests for EventDispatcher — London School (mock-first).
 *
 * We mock pushDispatch and the EmailProvider to test that the dispatcher
 * calls them with the right arguments for each event type.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock notification service ──────────────────────────────────────────────────
vi.mock('./notification.service.js', () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}))

// ── Mock email provider ────────────────────────────────────────────────────────
const mockSend = vi.fn().mockResolvedValue(undefined)
vi.mock('../email/resend.provider.js', () => ({
  getEmailProvider: () => ({ send: mockSend }),
}))

import { dispatch as mockPushDispatch } from './notification.service.js'
import { eventDispatcher } from './event.dispatcher.js'

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 50))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EventDispatcher', () => {
  describe('booking_confirmed', () => {
    const event = {
      type: 'booking_confirmed' as const,
      bookingId: 'bk_1',
      orgId: 'org_1',
      orgName: 'Тест Центр',
      parentId: 'parent_1',
      parentName: 'Родитель',
      parentEmail: 'parent@test.com',
      specialistName: 'Специалист',
      date: '2026-09-15',
      startTime: '10:00',
      endTime: '11:00',
    }

    it('sends a push notification', async () => {
      eventDispatcher.dispatch(event)
      await flushPromises()

      expect(mockPushDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'parent_1',
          type: 'booking_confirmed',
          dedupKey: 'booking_confirmed:bk_1',
        })
      )
    })

    it('sends an email to parentEmail', async () => {
      eventDispatcher.dispatch(event)
      await flushPromises()

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'parent@test.com' }))
    })

    it('email subject contains specialist name', async () => {
      eventDispatcher.dispatch(event)
      await flushPromises()

      const callArgs = mockSend.mock.calls[0][0]
      expect(callArgs.subject).toContain('Специалист')
    })
  })

  describe('cohort_enrollment_confirmed', () => {
    const event = {
      type: 'cohort_enrollment_confirmed' as const,
      orgId: 'org_1',
      cohortId: 'c_1',
      cohortTitle: 'Логопедия',
      parentId: 'parent_2',
      parentName: 'Мама',
      parentEmail: 'mama@test.com',
      specialistName: 'Специалист',
      orgName: 'Центр',
      startDate: '2026-10-01',
    }

    it('sends push with type cohort_enrollment_confirmed', async () => {
      eventDispatcher.dispatch(event)
      await flushPromises()

      expect(mockPushDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'cohort_enrollment_confirmed' })
      )
    })

    it('email dedup prevents double-send for same cohort+parent', async () => {
      // dedupKey is handled by pushDispatch internally; here we just verify
      // the dispatcher sets it correctly
      eventDispatcher.dispatch(event)
      await flushPromises()

      expect(mockPushDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ dedupKey: 'cohort_enrollment:c_1:parent_2' })
      )
    })
  })

  describe('booking_reminder_24h', () => {
    const event = {
      type: 'booking_reminder_24h' as const,
      bookingId: 'bk_2',
      parentId: 'parent_3',
      parentName: 'Родитель',
      parentEmail: 'r@test.com',
      specialistName: 'Доктор',
      date: '2026-09-16',
      startTime: '14:00',
      endTime: '15:00',
    }

    it('push notification title mentions "завтра"', async () => {
      eventDispatcher.dispatch(event)
      await flushPromises()

      expect(mockPushDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('завтра') })
      )
    })

    it('email subject mentions "завтра"', async () => {
      eventDispatcher.dispatch(event)
      await flushPromises()

      const callArgs = mockSend.mock.calls[0][0]
      expect(callArgs.subject).toContain('завтра')
    })
  })

  describe('booking_reminder_1h', () => {
    const event = {
      type: 'booking_reminder_1h' as const,
      bookingId: 'bk_3',
      parentId: 'parent_4',
      parentName: 'Родитель',
      parentEmail: 'r2@test.com',
      specialistName: 'Доктор',
      date: '2026-09-16',
      startTime: '14:00',
      endTime: '15:00',
    }

    it('push notification title mentions "1 час"', async () => {
      eventDispatcher.dispatch(event)
      await flushPromises()

      expect(mockPushDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('1 час') })
      )
    })
  })

  describe('welcome', () => {
    it('sends only email (no push)', async () => {
      eventDispatcher.dispatch({
        type: 'welcome',
        userId: 'u_1',
        name: 'Алия',
        email: 'aliya@test.com',
      })
      await flushPromises()

      expect(mockPushDispatch).not.toHaveBeenCalled()
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'aliya@test.com' }))
    })
  })

  describe('error resilience', () => {
    it('does not throw if pushDispatch rejects', async () => {
      vi.mocked(mockPushDispatch).mockRejectedValueOnce(new Error('Push failed'))

      expect(() =>
        eventDispatcher.dispatch({
          type: 'booking_confirmed',
          bookingId: 'bk_err',
          orgId: 'org_1',
          orgName: 'Центр',
          parentId: 'p_1',
          parentName: 'Родитель',
          parentEmail: 'p@test.com',
          specialistName: 'Спец',
          date: '2026-09-01',
          startTime: '09:00',
          endTime: '10:00',
        })
      ).not.toThrow()

      await flushPromises()
      // Email should still attempt to send despite push failure
      expect(mockSend).toHaveBeenCalled()
    })

    it('does not throw if email send rejects', async () => {
      mockSend.mockRejectedValueOnce(new Error('Email failed'))

      expect(() =>
        eventDispatcher.dispatch({
          type: 'welcome',
          userId: 'u_err',
          name: 'Тест',
          email: 'test@test.com',
        })
      ).not.toThrow()

      await flushPromises()
      // Should silently catch the error
    })
  })
})
