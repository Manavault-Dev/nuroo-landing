/**
 * TDD tests for email templates.
 * London School: mock-first, test behaviour not implementation.
 */

import { describe, it, expect } from 'vitest'
import {
  welcomeTemplate,
  bookingConfirmedTemplate,
  bookingReminderTemplate,
  cohortEnrollmentTemplate,
  reportReadyTemplate,
  paymentSucceededTemplate,
} from './email.templates.js'

describe('welcomeTemplate', () => {
  it('produces a subject with "Добро пожаловать"', () => {
    const { subject } = welcomeTemplate({ name: 'Алия' })
    expect(subject).toContain('Добро пожаловать')
  })

  it('includes the user name in the HTML body', () => {
    const { html } = welcomeTemplate({ name: 'Алия' })
    expect(html).toContain('Алия')
  })

  it('renders valid HTML (has doctype)', () => {
    const { html } = welcomeTemplate({ name: 'Test' })
    expect(html.toLowerCase()).toContain('<!doctype html')
  })
})

describe('bookingConfirmedTemplate', () => {
  const base = {
    parentName: 'Родитель',
    specialistName: 'Доктор Иванов',
    date: '2026-09-15',
    startTime: '10:00',
    endTime: '11:00',
    orgName: 'АBC Центр',
    bookingId: 'bk_123',
  }

  it('subject contains specialist name and start time', () => {
    const { subject } = bookingConfirmedTemplate(base)
    expect(subject).toContain('Доктор Иванов')
    expect(subject).toContain('10:00')
  })

  it('html contains booking ID link', () => {
    const { html } = bookingConfirmedTemplate(base)
    expect(html).toContain('bk_123')
  })

  it('shows Meet link when meetingUrl is provided', () => {
    const { html } = bookingConfirmedTemplate({
      ...base,
      meetingUrl: 'https://meet.google.com/abc-xyz',
    })
    expect(html).toContain('meet.google.com')
  })

  it('omits Meet link when meetingUrl is null', () => {
    const { html } = bookingConfirmedTemplate({ ...base, meetingUrl: null })
    expect(html).not.toContain('meet.google.com')
  })
})

describe('bookingReminderTemplate', () => {
  const base = {
    parentName: 'Родитель',
    specialistName: 'Специалист',
    date: '2026-09-16',
    startTime: '14:00',
    endTime: '15:00',
    bookingId: 'bk_456',
  }

  it('mentions "через 1 час" for 1h reminder', () => {
    const { subject, html } = bookingReminderTemplate({ ...base, hoursUntil: 1 })
    expect(subject).toContain('1 час')
    expect(html).toContain('1 час')
  })

  it('mentions "завтра" for 24h reminder', () => {
    const { subject, html } = bookingReminderTemplate({ ...base, hoursUntil: 24 })
    expect(subject).toContain('завтра')
    expect(html).toContain('завтра')
  })
})

describe('cohortEnrollmentTemplate', () => {
  const base = {
    parentName: 'Мама',
    cohortTitle: 'Логопедия 5–7 лет',
    specialistName: 'Специалист',
    orgName: 'Детский центр',
    startDate: '2026-10-01',
    cohortId: 'c_789',
    orgId: 'org_1',
  }

  it('subject contains cohort title', () => {
    const { subject } = cohortEnrollmentTemplate(base)
    expect(subject).toContain('Логопедия 5–7 лет')
  })

  it('html contains org name', () => {
    const { html } = cohortEnrollmentTemplate(base)
    expect(html).toContain('Детский центр')
  })
})

describe('reportReadyTemplate', () => {
  it('subject contains child name', () => {
    const { subject } = reportReadyTemplate({
      parentName: 'Мама',
      childName: 'Арсен',
      specialistName: 'Специалист',
      orgName: 'Центр',
      orgId: 'org_1',
      childId: 'ch_1',
    })
    expect(subject).toContain('Арсен')
  })
})

describe('paymentSucceededTemplate', () => {
  it('subject mentions plan name', () => {
    const { subject } = paymentSucceededTemplate({
      orgAdminName: 'Директор',
      planName: 'Growth',
      amountKgs: 3500,
      periodEnd: '2026-12-31',
      orgId: 'org_1',
    })
    expect(subject).toContain('Growth')
  })

  it('html shows formatted amount', () => {
    const { html } = paymentSucceededTemplate({
      orgAdminName: 'Директор',
      planName: 'Growth',
      amountKgs: 3500,
      periodEnd: '2026-12-31',
      orgId: 'org_1',
    })
    expect(html).toContain('3')
    expect(html).toContain('KGS')
  })
})
