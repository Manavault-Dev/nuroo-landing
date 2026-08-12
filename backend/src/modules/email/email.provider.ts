/**
 * EmailProvider — abstraction over any transactional email service.
 *
 * Swap the implementation (Resend → SES, Postmark …) without touching callers.
 */

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  /** Rendered HTML body */
  html: string
  /** Optional plain-text fallback */
  text?: string
  /** Reply-to address */
  replyTo?: string
}

export interface EmailProvider {
  send(opts: SendEmailOptions): Promise<void>
}
