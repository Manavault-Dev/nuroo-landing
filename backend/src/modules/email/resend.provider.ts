/**
 * ResendEmailProvider — EmailProvider implementation using Resend.
 *
 * Requires env var: RESEND_API_KEY
 * Requires env var: EMAIL_FROM  (e.g. "Nuroo <noreply@usenuroo.com>")
 */

import { Resend } from 'resend'
import type { EmailProvider, SendEmailOptions } from './email.provider.js'

let _client: Resend | null = null

function getClient(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY env var is not set')
    _client = new Resend(key)
  }
  return _client
}

export class ResendEmailProvider implements EmailProvider {
  private readonly from: string

  constructor() {
    this.from = process.env.EMAIL_FROM ?? 'Nuroo <noreply@usenuroo.com>'
  }

  async send(opts: SendEmailOptions): Promise<void> {
    const client = getClient()
    const to = Array.isArray(opts.to) ? opts.to : [opts.to]

    const { error } = await client.emails.send({
      from: this.from,
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    })

    if (error) {
      throw new Error(`Resend error: ${error.message}`)
    }
  }
}

/** Singleton — lazily initialized so tests can skip it */
let _provider: ResendEmailProvider | null = null

export function getEmailProvider(): ResendEmailProvider {
  if (!_provider) _provider = new ResendEmailProvider()
  return _provider
}
