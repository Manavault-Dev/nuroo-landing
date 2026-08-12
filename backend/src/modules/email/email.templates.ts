/**
 * Email HTML templates for Nuroo transactional emails.
 *
 * All templates are inline-styled (email clients strip <style> blocks).
 * Supports languages: ru, en, ky
 */

export type EmailLang = 'ru' | 'en' | 'ky'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://usenuroo.com'
const LOGO_URL = 'https://usenuroo.com/logo.png'
const TEAL = '#0D9488'
const BG = '#F8FAFC'
const CARD_BG = '#FFFFFF'
const TEXT = '#1E293B'
const MUTED = '#64748B'

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ru: {
    footer_unsub: 'Отписаться',
    open_app: 'Перейти в приложение',
    specialist: 'Специалист',
    service: 'Услуга',
    date: 'Дата',
    time: 'Время',
    org: 'Организация',
    group: 'Группа',
    start: 'Старт',
    plan: 'Тариф',
    amount: 'Сумма',
    paid_until: 'Оплачено до',
    join_meet: 'Присоединиться к Google Meet',
    online_label: 'Занятие проводится онлайн:',
    online_label_pl: 'Занятия проводятся онлайн:',
    cancel_note: 'Для отмены записи перейдите в приложение не позднее чем за 2 часа до начала.',
    ignore_note: 'Если вы не регистрировались на Nuroo, просто проигнорируйте это письмо.',

    welcome_subject: 'Добро пожаловать в Nuroo!',
    welcome_h1: 'Добро пожаловать в Nuroo!',
    welcome_hi: (name: string) => `Привет, ${name}! 👋`,
    welcome_body:
      'Nuroo — платформа для развития детей. Здесь вы найдёте специалистов, запишетесь на занятия и будете следить за прогрессом ребёнка в одном месте.',

    booking_confirmed_subject: (name: string, time: string) =>
      `Запись подтверждена: ${name} · ${time}`,
    booking_confirmed_h1: 'Запись подтверждена ✅',
    booking_confirmed_body: (name: string) => `${name}, ваша запись успешно оформлена.`,
    view_booking: 'Посмотреть запись',

    reminder_subject: (label: string, time: string) => `Напоминание: занятие ${label} · ${time}`,
    reminder_h1: (label: string) => `Напоминание: занятие ${label} ⏰`,
    reminder_body: (name: string, label: string) =>
      `${name}, у вас занятие <strong>${label}</strong>.`,
    reminder_soon: 'через 1 час',
    reminder_tomorrow: 'завтра',
    open_booking: 'Открыть запись',

    cohort_subject: (title: string) => `Запись в группу: ${title}`,
    cohort_h1: 'Вы записаны в группу 🎉',
    cohort_body: (name: string) => `${name}, вы успешно записаны в группу.`,
    cohort_link: 'Перейти к группе',
    cohort_meet_link: 'Ссылка на Google Meet',

    report_subject: (child: string) => `Отчёт о прогрессе ${child}`,
    report_h1: 'Новый отчёт готов 📊',
    report_body: (name: string, specialist: string, org: string, child: string) =>
      `${name}, специалист <strong>${specialist}</strong> из <strong>${org}</strong> добавил отчёт о прогрессе ${child}.`,
    report_link: 'Посмотреть отчёт',

    payment_subject: (plan: string) => `Оплата ${plan} прошла успешно`,
    payment_h1: 'Оплата прошла успешно ✅',
    payment_body: (name: string) => `${name}, оплата тарифа принята.`,
    payment_link: 'Перейти в биллинг',
  },
  en: {
    footer_unsub: 'Unsubscribe',
    open_app: 'Open app',
    specialist: 'Specialist',
    service: 'Service',
    date: 'Date',
    time: 'Time',
    org: 'Organization',
    group: 'Group',
    start: 'Start',
    plan: 'Plan',
    amount: 'Amount',
    paid_until: 'Paid until',
    join_meet: 'Join Google Meet',
    online_label: 'Session is online:',
    online_label_pl: 'Sessions are online:',
    cancel_note: 'To cancel, open the app at least 2 hours before the session.',
    ignore_note: "If you didn't register on Nuroo, please ignore this email.",

    welcome_subject: 'Welcome to Nuroo!',
    welcome_h1: 'Welcome to Nuroo!',
    welcome_hi: (name: string) => `Hi, ${name}! 👋`,
    welcome_body:
      "Nuroo is a platform for child development. Find specialists, book sessions and track your child's progress — all in one place.",

    booking_confirmed_subject: (name: string, time: string) =>
      `Booking confirmed: ${name} · ${time}`,
    booking_confirmed_h1: 'Booking confirmed ✅',
    booking_confirmed_body: (name: string) => `${name}, your booking has been confirmed.`,
    view_booking: 'View booking',

    reminder_subject: (label: string, time: string) => `Reminder: session ${label} · ${time}`,
    reminder_h1: (label: string) => `Reminder: session ${label} ⏰`,
    reminder_body: (name: string, label: string) =>
      `${name}, you have a session <strong>${label}</strong>.`,
    reminder_soon: 'in 1 hour',
    reminder_tomorrow: 'tomorrow',
    open_booking: 'Open booking',

    cohort_subject: (title: string) => `Enrolled in group: ${title}`,
    cohort_h1: 'You are enrolled in a group 🎉',
    cohort_body: (name: string) => `${name}, you have been successfully enrolled.`,
    cohort_link: 'Go to group',
    cohort_meet_link: 'Google Meet link',

    report_subject: (child: string) => `Progress report for ${child}`,
    report_h1: 'New report is ready 📊',
    report_body: (name: string, specialist: string, org: string, child: string) =>
      `${name}, <strong>${specialist}</strong> from <strong>${org}</strong> has added a progress report for ${child}.`,
    report_link: 'View report',

    payment_subject: (plan: string) => `Payment for ${plan} successful`,
    payment_h1: 'Payment successful ✅',
    payment_body: (name: string) => `${name}, your plan payment has been accepted.`,
    payment_link: 'Go to billing',
  },
  ky: {
    footer_unsub: 'Жазылуудан баш тарт',
    open_app: 'Колдонмого өт',
    specialist: 'Адис',
    service: 'Кызмат',
    date: 'Күн',
    time: 'Убакыт',
    org: 'Уюм',
    group: 'Топ',
    start: 'Башталуу',
    plan: 'Тариф',
    amount: 'Сумма',
    paid_until: 'Төлөнгөн мөөнөт',
    join_meet: "Google Meet'ке кошулуу",
    online_label: 'Сабак онлайн өтөт:',
    online_label_pl: 'Сабактар онлайн өтөт:',
    cancel_note:
      'Жазылууну жокко чыгаруу үчүн сабак башталганга 2 саат калганда колдонмого кириңиз.',
    ignore_note: 'Эгер Nurooго катталбасаңыз, бул катты жөн эле өткөрүп жибериңиз.',

    welcome_subject: 'Nurooго кош келиңиз!',
    welcome_h1: 'Nurooго кош келиңиз!',
    welcome_hi: (name: string) => `Саламатсызбы, ${name}! 👋`,
    welcome_body:
      'Nuroo — балдардын өнүгүүсүнө арналган платформа. Адистерди табыңыз, сабактарга жазылыңыз жана балаңыздын ийгиликтерин бир жерден байкаңыз.',

    booking_confirmed_subject: (name: string, time: string) =>
      `Жазылуу ырасталды: ${name} · ${time}`,
    booking_confirmed_h1: 'Жазылуу ырасталды ✅',
    booking_confirmed_body: (name: string) => `${name}, жазылуунуз ырасталды.`,
    view_booking: 'Жазылууну көрүү',

    reminder_subject: (label: string, time: string) => `Эскертүү: сабак ${label} · ${time}`,
    reminder_h1: (label: string) => `Эскертүү: сабак ${label} ⏰`,
    reminder_body: (name: string, label: string) => `${name}, сабагыңыз <strong>${label}</strong>.`,
    reminder_soon: '1 сааттан кийин',
    reminder_tomorrow: 'эртең',
    open_booking: 'Жазылууну ачуу',

    cohort_subject: (title: string) => `Топко жазылдыңыз: ${title}`,
    cohort_h1: 'Топко жазылдыңыз 🎉',
    cohort_body: (name: string) => `${name}, топко ийгиликтүү жазылдыңыз.`,
    cohort_link: 'Топко өтүү',
    cohort_meet_link: 'Google Meet шилтемеси',

    report_subject: (child: string) => `${child} жөнүндө отчёт`,
    report_h1: 'Жаңы отчёт даяр 📊',
    report_body: (name: string, specialist: string, org: string, child: string) =>
      `${name}, <strong>${org}</strong> уюмунун адиси <strong>${specialist}</strong> ${child} жөнүндө отчёт кошту.`,
    report_link: 'Отчётту көрүү',

    payment_subject: (plan: string) => `${plan} тарифи үчүн төлөм ийгиликтүү`,
    payment_h1: 'Төлөм ийгиликтүү өттү ✅',
    payment_body: (name: string) => `${name}, тариф төлөмүңүз кабыл алынды.`,
    payment_link: 'Биллингге өтүү',
  },
}

// ─── Layout helpers ────────────────────────────────────────────────────────────

function layout(title: string, body: string, lang: EmailLang = 'ru'): string {
  const t = T[lang]
  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">
          <!-- Logo header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <a href="${APP_URL}" style="text-decoration:none;">
                <img src="${LOGO_URL}" alt="Nuroo" width="120" height="120"
                  style="display:block;width:120px;height:120px;object-fit:contain;border-radius:24px;" />
              </a>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:${CARD_BG};border-radius:16px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.07);">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:${MUTED};">
                © ${new Date().getFullYear()} Nuroo · <a href="${APP_URL}/unsubscribe" style="color:${MUTED};">${t.footer_unsub}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT};">${text}</h1>`
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${TEXT};">${text}</p>`
}

function muted(text: string): string {
  return `<p style="margin:0 0 8px;font-size:13px;color:${MUTED};">${text}</p>`
}

function button(text: string, url: string): string {
  return `
<table cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
  <tr>
    <td style="background:${TEAL};border-radius:10px;">
      <a href="${url}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;">${text}</a>
    </td>
  </tr>
</table>`
}

function infoRow(label: string, value: string): string {
  return `
<tr>
  <td style="padding:6px 0;font-size:13px;color:${MUTED};width:120px;vertical-align:top;">${label}</td>
  <td style="padding:6px 0;font-size:13px;color:${TEXT};font-weight:500;">${value}</td>
</tr>`
}

function infoTable(rows: string): string {
  return `
<table style="width:100%;margin:16px 0;border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;">
  ${rows}
</table>`
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface WelcomeTemplateData {
  name: string
  lang?: EmailLang
}

export function welcomeTemplate(data: WelcomeTemplateData): { subject: string; html: string } {
  const t = T[data.lang ?? 'ru']
  const body = `
    ${h1(t.welcome_h1)}
    ${p(t.welcome_hi(data.name))}
    ${p(t.welcome_body)}
    ${button(t.open_app, APP_URL)}
    ${muted(t.ignore_note)}
  `
  return {
    subject: t.welcome_subject,
    html: layout(t.welcome_subject, body, data.lang),
  }
}

export interface BookingConfirmedTemplateData {
  parentName: string
  specialistName: string
  serviceName?: string | null
  date: string
  startTime: string
  endTime: string
  orgName: string
  bookingId: string
  meetingUrl?: string | null
  lang?: EmailLang
}

export function bookingConfirmedTemplate(data: BookingConfirmedTemplateData): {
  subject: string
  html: string
} {
  const t = T[data.lang ?? 'ru']
  const locale = data.lang === 'en' ? 'en-US' : data.lang === 'ky' ? 'ky-KG' : 'ru-RU'
  const dateFormatted = new Date(data.date + 'T12:00:00Z').toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const rows = [
    infoRow(t.specialist, data.specialistName),
    data.serviceName ? infoRow(t.service, data.serviceName) : '',
    infoRow(t.date, dateFormatted),
    infoRow(t.time, `${data.startTime} – ${data.endTime}`),
    data.orgName ? infoRow(t.org, data.orgName) : '',
  ].join('')

  const meetBlock = data.meetingUrl
    ? `${p(t.online_label)}${button(t.join_meet, data.meetingUrl)}`
    : ''

  const body = `
    ${h1(t.booking_confirmed_h1)}
    ${p(t.booking_confirmed_body(data.parentName))}
    ${infoTable(rows)}
    ${meetBlock}
    ${button(t.view_booking, `${APP_URL}/b2b/bookings/${data.bookingId}`)}
    ${muted(t.cancel_note)}
  `
  const subject = t.booking_confirmed_subject(data.specialistName, data.startTime)
  return { subject, html: layout(subject, body, data.lang) }
}

export interface BookingReminderTemplateData {
  parentName: string
  specialistName: string
  date: string
  startTime: string
  endTime: string
  hoursUntil: number
  meetingUrl?: string | null
  bookingId: string
  lang?: EmailLang
}

export function bookingReminderTemplate(data: BookingReminderTemplateData): {
  subject: string
  html: string
} {
  const t = T[data.lang ?? 'ru']
  const locale = data.lang === 'en' ? 'en-US' : data.lang === 'ky' ? 'ky-KG' : 'ru-RU'
  const timeLabel = data.hoursUntil === 1 ? t.reminder_soon : t.reminder_tomorrow
  const dateFormatted = new Date(data.date + 'T12:00:00Z').toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const meetBlock = data.meetingUrl
    ? button(t.join_meet, data.meetingUrl)
    : button(t.open_booking, `${APP_URL}/b2b/bookings/${data.bookingId}`)

  const body = `
    ${h1(t.reminder_h1(timeLabel))}
    ${p(t.reminder_body(data.parentName, timeLabel))}
    ${infoTable(
      [
        infoRow(t.specialist, data.specialistName),
        infoRow(t.date, dateFormatted),
        infoRow(t.time, `${data.startTime} – ${data.endTime}`),
      ].join('')
    )}
    ${meetBlock}
  `
  const subject = t.reminder_subject(timeLabel, data.startTime)
  return { subject, html: layout(subject, body, data.lang) }
}

export interface CohortEnrollmentTemplateData {
  parentName: string
  cohortTitle: string
  specialistName: string
  orgName: string
  startDate: string
  cohortId: string
  orgId: string
  meetingUrl?: string | null
  lang?: EmailLang
}

export function cohortEnrollmentTemplate(data: CohortEnrollmentTemplateData): {
  subject: string
  html: string
} {
  const t = T[data.lang ?? 'ru']
  const locale = data.lang === 'en' ? 'en-US' : data.lang === 'ky' ? 'ky-KG' : 'ru-RU'
  const dateFormatted = new Date(data.startDate + 'T12:00:00Z').toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const meetBlock = data.meetingUrl
    ? `${p(t.online_label_pl)}${button(t.cohort_meet_link, data.meetingUrl)}`
    : ''

  const body = `
    ${h1(t.cohort_h1)}
    ${p(t.cohort_body(data.parentName))}
    ${infoTable(
      [
        infoRow(t.group, data.cohortTitle),
        infoRow(t.specialist, data.specialistName),
        infoRow(t.org, data.orgName),
        infoRow(t.start, dateFormatted),
      ].join('')
    )}
    ${meetBlock}
    ${button(t.cohort_link, `${APP_URL}/marketplace/${data.orgId}/courses/${data.cohortId}`)}
  `
  const subject = t.cohort_subject(data.cohortTitle)
  return { subject, html: layout(subject, body, data.lang) }
}

export interface BookingCancelledTemplateData {
  parentName: string
  specialistName: string
  date: string
  startTime: string
  reason?: string | null
  lang?: EmailLang
}

export function bookingCancelledTemplate(data: BookingCancelledTemplateData): {
  subject: string
  html: string
} {
  const t = T[data.lang ?? 'ru']
  const locale = data.lang === 'en' ? 'en-US' : data.lang === 'ky' ? 'ky-KG' : 'ru-RU'
  const dateFormatted = new Date(data.date + 'T12:00:00Z').toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const cancelledH1: Record<EmailLang, string> = {
    ru: 'Запись отменена ❌',
    en: 'Booking cancelled ❌',
    ky: 'Жазылуу жокко чыгарылды ❌',
  }
  const cancelledBody: Record<EmailLang, string> = {
    ru: `${data.parentName}, ваша запись была отменена.`,
    en: `${data.parentName}, your booking has been cancelled.`,
    ky: `${data.parentName}, жазылуунуз жокко чыгарылды.`,
  }
  const reasonLabel: Record<EmailLang, string> = {
    ru: 'Причина',
    en: 'Reason',
    ky: 'Себеп',
  }
  const cancelledSubject: Record<EmailLang, string> = {
    ru: `Запись отменена: ${data.specialistName} · ${data.startTime}`,
    en: `Booking cancelled: ${data.specialistName} · ${data.startTime}`,
    ky: `Жазылуу жокко чыгарылды: ${data.specialistName} · ${data.startTime}`,
  }

  const lang = data.lang ?? 'ru'
  const rows = [
    infoRow(t.specialist, data.specialistName),
    infoRow(t.date, dateFormatted),
    infoRow(t.time, data.startTime),
    data.reason ? infoRow(reasonLabel[lang], data.reason) : '',
  ].join('')

  const body = `
    ${h1(cancelledH1[lang])}
    ${p(cancelledBody[lang])}
    ${infoTable(rows)}
    ${button(t.open_app, 'https://usenuroo.com')}
  `
  const subject = cancelledSubject[lang]
  return { subject, html: layout(subject, body, data.lang) }
}

export interface ReportReadyTemplateData {
  parentName: string
  childName: string
  specialistName: string
  orgName: string
  orgId: string
  childId: string
  lang?: EmailLang
}

export function reportReadyTemplate(data: ReportReadyTemplateData): {
  subject: string
  html: string
} {
  const t = T[data.lang ?? 'ru']
  const body = `
    ${h1(t.report_h1)}
    ${p(t.report_body(data.parentName, data.specialistName, data.orgName, data.childName))}
    ${button(t.report_link, `${APP_URL}/b2b/children/${data.childId}`)}
  `
  const subject = t.report_subject(data.childName)
  return { subject, html: layout(subject, body, data.lang) }
}

export interface PaymentSucceededTemplateData {
  orgAdminName: string
  planName: string
  amountKgs: number
  periodEnd: string
  orgId: string
  lang?: EmailLang
}

export function paymentSucceededTemplate(data: PaymentSucceededTemplateData): {
  subject: string
  html: string
} {
  const t = T[data.lang ?? 'ru']
  const locale = data.lang === 'en' ? 'en-US' : data.lang === 'ky' ? 'ky-KG' : 'ru-RU'
  const periodEnd = new Date(data.periodEnd + 'T12:00:00Z').toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const body = `
    ${h1(t.payment_h1)}
    ${p(t.payment_body(data.orgAdminName))}
    ${infoTable(
      [
        infoRow(t.plan, data.planName),
        infoRow(t.amount, `${data.amountKgs.toLocaleString('ru-RU')} KGS`),
        infoRow(t.paid_until, periodEnd),
      ].join('')
    )}
    ${button(t.payment_link, `${APP_URL}/b2b/billing`)}
  `
  const subject = t.payment_subject(data.planName)
  return { subject, html: layout(subject, body, data.lang) }
}
