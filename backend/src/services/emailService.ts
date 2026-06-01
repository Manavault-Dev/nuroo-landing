import nodemailer from 'nodemailer'
import { config } from '../config/index.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export type SupportedLocale = 'en' | 'ru' | 'ky'

interface OtpEmailPayload {
  to: string
  code: string
  locale: SupportedLocale
  expiresInMinutes: number
}

// ─── i18n Strings ────────────────────────────────────────────────────────────

interface EmailStrings {
  subject: string
  greeting: string
  intro: string
  codeLabel: string
  expiresNote: string
  ignoreNote: string
  footer: string
}

const EMAIL_STRINGS: Record<SupportedLocale, EmailStrings> = {
  en: {
    subject: 'Your Nuroo password reset code',
    greeting: 'Hello!',
    intro: 'You requested a password reset for your Nuroo account. Use the code below to continue:',
    codeLabel: 'Your one-time code',
    expiresNote: 'This code expires in {minutes} minutes.',
    ignoreNote: 'If you did not request this, you can safely ignore this email.',
    footer: '© 2026 Nuroo by Manavault Studio. All rights reserved.',
  },
  ru: {
    subject: 'Ваш код для сброса пароля Nuroo',
    greeting: 'Здравствуйте!',
    intro:
      'Вы запросили сброс пароля для вашего аккаунта Nuroo. Используйте код ниже для продолжения:',
    codeLabel: 'Ваш одноразовый код',
    expiresNote: 'Код действителен в течение {minutes} минут.',
    ignoreNote: 'Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.',
    footer: '© 2026 Nuroo by Manavault Studio. Все права защищены.',
  },
  ky: {
    subject: 'Nuroo сырсөзүңүздү калыбына келтирүү коду',
    greeting: 'Саламатсызбы!',
    intro:
      'Nuroo аккаунтуңуздун сырсөзүн калыбына келтирүү суранычы алынды. Улантуу үчүн төмөндөгү кодду колдонуңуз:',
    codeLabel: 'Бир жолдук кодуңуз',
    expiresNote: 'Код {minutes} мүнөт ичинде жарактуу.',
    ignoreNote:
      'Эгер сиз бул суранычты жөнөтпөсөңүз, бул катты жөн эле этибарга алуунун кажети жок.',
    footer: '© 2026 Nuroo by Manavault Studio. Бардык укуктар корголгон.',
  },
}

// ─── HTML Template ────────────────────────────────────────────────────────────

function buildOtpHtml(code: string, strings: EmailStrings, expiresInMinutes: number): string {
  const expiresNote = strings.expiresNote.replace('{minutes}', String(expiresInMinutes))
  const digits = code.split('')

  const digitBoxes = digits
    .map(
      (d) =>
        `<td style="padding:0 6px;">
          <div style="
            display:inline-block;
            width:52px;
            height:64px;
            background:#f8faff;
            border:2px solid #e0e7ff;
            border-radius:12px;
            font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
            font-size:32px;
            font-weight:700;
            color:#1e3a8a;
            line-height:64px;
            text-align:center;
            letter-spacing:0;
          ">${d}</div>
        </td>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${strings.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="
                display:inline-flex;
                align-items:center;
                gap:10px;
                background:#1e3a8a;
                border-radius:16px;
                padding:12px 24px;
              ">
                <span style="
                  font-size:22px;
                  font-weight:800;
                  color:#ffffff;
                  letter-spacing:-0.5px;
                ">nuroo</span>
              </div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="
              background:#ffffff;
              border-radius:20px;
              box-shadow:0 4px 24px rgba(30,58,138,0.08);
              overflow:hidden;
            ">
              <!-- Top accent bar -->
              <div style="height:4px;background:linear-gradient(90deg,#3b82f6,#6366f1,#8b5cf6);"></div>

              <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 48px 36px;">

                <!-- Greeting -->
                <tr>
                  <td style="padding-bottom:16px;">
                    <h1 style="margin:0;font-size:24px;font-weight:700;color:#0f172a;">
                      ${strings.greeting}
                    </h1>
                  </td>
                </tr>

                <!-- Intro -->
                <tr>
                  <td style="padding-bottom:36px;">
                    <p style="margin:0;font-size:16px;line-height:1.6;color:#475569;">
                      ${strings.intro}
                    </p>
                  </td>
                </tr>

                <!-- Code label -->
                <tr>
                  <td style="padding-bottom:16px;">
                    <p style="
                      margin:0;
                      font-size:12px;
                      font-weight:600;
                      color:#64748b;
                      text-transform:uppercase;
                      letter-spacing:0.1em;
                    ">${strings.codeLabel}</p>
                  </td>
                </tr>

                <!-- OTP digits -->
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>${digitBoxes}</tr>
                    </table>
                  </td>
                </tr>

                <!-- Expires note -->
                <tr>
                  <td style="padding-bottom:12px;">
                    <div style="
                      background:#eff6ff;
                      border-left:4px solid #3b82f6;
                      border-radius:8px;
                      padding:14px 18px;
                    ">
                      <p style="margin:0;font-size:14px;color:#1e40af;font-weight:500;">
                        ⏱ ${expiresNote}
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- Ignore note -->
                <tr>
                  <td style="padding-top:24px;">
                    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
                      ${strings.ignoreNote}
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                ${strings.footer}
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

// ─── Transporter (lazy singleton) ────────────────────────────────────────────

let _transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter

  const host = config.SMTP_HOST
  const port = parseInt(config.SMTP_PORT, 10)
  const secure = config.SMTP_SECURE === 'true'
  const user = config.SMTP_USER
  const pass = config.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error(
      '[EmailService] SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env'
    )
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  })

  return _transporter
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendOtpEmail(payload: OtpEmailPayload): Promise<void> {
  const { to, code, locale, expiresInMinutes } = payload

  const resolvedLocale: SupportedLocale =
    locale === 'ru' || locale === 'ky' || locale === 'en' ? locale : 'en'

  const strings = EMAIL_STRINGS[resolvedLocale]
  const html = buildOtpHtml(code, strings, expiresInMinutes)
  const fromAddress = config.SMTP_FROM || config.SMTP_USER || 'no-reply@usenuroo.com'

  const transporter = getTransporter()

  await transporter.sendMail({
    from: `"Nuroo" <${fromAddress}>`,
    to,
    subject: strings.subject,
    html,
    text: `${strings.greeting}\n\n${strings.intro}\n\n${strings.codeLabel}: ${code}\n\n${strings.expiresNote.replace('{minutes}', String(expiresInMinutes))}\n\n${strings.ignoreNote}`,
  })
}

/** Call on server shutdown to release SMTP connections */
export function closeEmailTransporter(): void {
  if (_transporter) {
    _transporter.close()
    _transporter = null
  }
}
