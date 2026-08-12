import { dispatch as pushDispatch } from './notification.service.js'
import { getEmailProvider } from '../email/resend.provider.js'
import {
  bookingConfirmedTemplate,
  bookingCancelledTemplate,
  bookingReminderTemplate,
  cohortEnrollmentTemplate,
  reportReadyTemplate,
  paymentSucceededTemplate,
  welcomeTemplate,
} from '../email/email.templates.js'

export type {
  BookingConfirmedEvent,
  BookingCancelledEvent,
  BookingReminderEvent,
  CohortEnrollmentConfirmedEvent,
  ReportReadyEvent,
  PaymentSucceededEvent,
  WelcomeEvent,
  DomainEvent,
} from './event.types.js'
import type {
  DomainEvent,
  BookingConfirmedEvent,
  BookingCancelledEvent,
  BookingReminderEvent,
  CohortEnrollmentConfirmedEvent,
  ReportReadyEvent,
  PaymentSucceededEvent,
  WelcomeEvent,
} from './event.types.js'

class EventDispatcher {
  // Fire-and-forget: errors are logged, never thrown to caller
  dispatch(event: DomainEvent): void {
    console.log(`[EventDispatcher] Dispatching ${event.type}`)
    this._handle(event).catch((err) => {
      console.error(`[EventDispatcher] Failed to dispatch ${event.type}:`, err)
    })
  }

  private async _handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case 'booking_confirmed':
        await this._bookingConfirmed(event)
        break
      case 'booking_cancelled':
        await this._bookingCancelled(event)
        break
      case 'booking_reminder_24h':
      case 'booking_reminder_1h':
        await this._bookingReminder(event)
        break
      case 'cohort_enrollment_confirmed':
        await this._cohortEnrollmentConfirmed(event)
        break
      case 'report_ready':
        await this._reportReady(event)
        break
      case 'payment_succeeded':
        await this._paymentSucceeded(event)
        break
      case 'welcome':
        await this._welcome(event)
        break
    }
  }

  private async _bookingConfirmed(e: BookingConfirmedEvent): Promise<void> {
    const dedupKey = `booking_confirmed:${e.bookingId}`
    await Promise.allSettled([
      pushDispatch({
        userId: e.parentId,
        orgId: e.orgId,
        role: 'parent',
        type: 'booking_confirmed',
        category: 'reminders',
        title: 'Запись подтверждена ✅',
        body: `${e.specialistName} · ${e.startTime}`,
        metadata: { orgId: e.orgId, deepLink: `/bookings/${e.bookingId}` },
        channel: 'both',
        dedupKey,
      }),
      this._sendEmail(async () => {
        const { subject, html } = bookingConfirmedTemplate({
          parentName: e.parentName,
          specialistName: e.specialistName,
          serviceName: e.serviceName,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          orgName: e.orgName,
          bookingId: e.bookingId,
          meetingUrl: e.meetingUrl,
        })
        await getEmailProvider().send({ to: e.parentEmail, subject, html })
      }),
    ])
  }

  private async _bookingCancelled(e: BookingCancelledEvent): Promise<void> {
    await Promise.allSettled([
      pushDispatch({
        userId: e.parentId,
        orgId: e.orgId,
        role: 'parent',
        type: 'booking_cancelled',
        category: 'reminders',
        title: 'Запись отменена',
        body: `${e.specialistName} · ${e.startTime}${e.reason ? ` · ${e.reason}` : ''}`,
        metadata: { orgId: e.orgId, deepLink: `/bookings/${e.bookingId}` },
        channel: 'both',
        dedupKey: `booking_cancelled:${e.bookingId}`,
      }),
      e.parentEmail
        ? this._sendEmail(async () => {
            const { subject, html } = bookingCancelledTemplate({
              parentName: e.parentName,
              specialistName: e.specialistName,
              date: e.date,
              startTime: e.startTime,
              reason: e.reason,
            })
            await getEmailProvider().send({ to: e.parentEmail!, subject, html })
          })
        : Promise.resolve(),
    ])
  }

  private async _bookingReminder(e: BookingReminderEvent): Promise<void> {
    const hoursUntil = e.type === 'booking_reminder_1h' ? 1 : 24
    const label = hoursUntil === 1 ? 'через 1 час' : 'завтра'
    const dedupKey = `${e.type}:${e.bookingId}`
    await Promise.allSettled([
      pushDispatch({
        userId: e.parentId,
        role: 'parent',
        type: e.type,
        category: 'reminders',
        title: `Занятие ${label} ⏰`,
        body: `${e.specialistName} · ${e.startTime}`,
        metadata: { deepLink: `/bookings/${e.bookingId}` },
        channel: 'both',
        dedupKey,
      }),
      this._sendEmail(async () => {
        const { subject, html } = bookingReminderTemplate({
          parentName: e.parentName,
          specialistName: e.specialistName,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          hoursUntil,
          meetingUrl: e.meetingUrl,
          bookingId: e.bookingId,
        })
        await getEmailProvider().send({ to: e.parentEmail, subject, html })
      }),
    ])
  }

  private async _cohortEnrollmentConfirmed(e: CohortEnrollmentConfirmedEvent): Promise<void> {
    const dedupKey = `cohort_enrollment:${e.cohortId}:${e.parentId}`
    await Promise.allSettled([
      pushDispatch({
        userId: e.parentId,
        orgId: e.orgId,
        role: 'parent',
        type: 'cohort_enrollment_confirmed',
        category: 'reminders',
        title: 'Вы записаны в группу 🎉',
        body: e.cohortTitle,
        metadata: { orgId: e.orgId, deepLink: `/marketplace/${e.orgId}/courses/${e.cohortId}` },
        channel: 'both',
        dedupKey,
      }),
      this._sendEmail(async () => {
        const { subject, html } = cohortEnrollmentTemplate({
          parentName: e.parentName,
          cohortTitle: e.cohortTitle,
          specialistName: e.specialistName,
          orgName: e.orgName,
          startDate: e.startDate,
          cohortId: e.cohortId,
          orgId: e.orgId,
          meetingUrl: e.meetingUrl,
        })
        await getEmailProvider().send({ to: e.parentEmail, subject, html })
      }),
    ])
  }

  private async _reportReady(e: ReportReadyEvent): Promise<void> {
    const dedupKey = `report_ready:${e.childId}:${new Date().toISOString().slice(0, 10)}`
    await Promise.allSettled([
      pushDispatch({
        userId: e.parentId,
        orgId: e.orgId,
        role: 'parent',
        type: 'report_ready',
        category: 'progressUpdates',
        title: `Отчёт о прогрессе ${e.childName} 📊`,
        body: `${e.specialistName} добавил новый отчёт`,
        metadata: { orgId: e.orgId, childId: e.childId, deepLink: `/children/${e.childId}` },
        channel: 'both',
        dedupKey,
      }),
      this._sendEmail(async () => {
        const { subject, html } = reportReadyTemplate({
          parentName: e.parentName,
          childName: e.childName,
          specialistName: e.specialistName,
          orgName: e.orgName,
          orgId: e.orgId,
          childId: e.childId,
        })
        await getEmailProvider().send({ to: e.parentEmail, subject, html })
      }),
    ])
  }

  private async _paymentSucceeded(e: PaymentSucceededEvent): Promise<void> {
    await Promise.allSettled([
      pushDispatch({
        userId: e.adminId,
        orgId: e.orgId,
        role: 'admin',
        type: 'payment_succeeded',
        category: 'billingUpdates',
        title: 'Оплата прошла ✅',
        body: `${e.planName} · ${e.amountKgs.toLocaleString('ru-RU')} KGS`,
        metadata: { orgId: e.orgId, deepLink: '/b2b/billing' },
        channel: 'both',
        dedupKey: `payment_succeeded:${e.orgId}:${e.periodEnd}`,
      }),
      this._sendEmail(async () => {
        const { subject, html } = paymentSucceededTemplate({
          orgAdminName: e.adminName,
          planName: e.planName,
          amountKgs: e.amountKgs,
          periodEnd: e.periodEnd,
          orgId: e.orgId,
        })
        await getEmailProvider().send({ to: e.adminEmail, subject, html })
      }),
    ])
  }

  private async _welcome(e: WelcomeEvent): Promise<void> {
    await this._sendEmail(async () => {
      const { subject, html } = welcomeTemplate({ name: e.name })
      await getEmailProvider().send({ to: e.email, subject, html })
    })
  }

  // Errors are logged but don't propagate — a failed email never breaks the response
  private async _sendEmail(fn: () => Promise<void>): Promise<void> {
    try {
      await fn()
    } catch (err) {
      console.error('[EventDispatcher] Email send failed:', err)
    }
  }
}

export const eventDispatcher = new EventDispatcher()
