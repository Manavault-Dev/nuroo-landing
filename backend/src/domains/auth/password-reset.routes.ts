/**
 * POST /auth/forgot-password
 *
 * Generates a Firebase password-reset link and sends it via Resend
 * so the email arrives from noreply@usenuroo.com (not spam).
 *
 * Public route — no auth required.
 */

import type { FastifyInstance } from 'fastify'
import { getAuth } from 'firebase-admin/auth'
import { getEmailProvider } from '../../modules/email/resend.provider.js'
import { passwordResetTemplate } from '../../modules/email/email.templates.js'
import type { EmailLang } from '../../modules/email/email.templates.js'

export async function passwordResetRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: { email: string; lang?: string }
  }>(
    '/auth/forgot-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
            lang: { type: 'string', enum: ['ru', 'en', 'ky'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, lang = 'ru' } = request.body

      // Always respond with 200 — never reveal whether email exists
      try {
        const resetLink = await getAuth().generatePasswordResetLink(email)

        const { subject, html } = passwordResetTemplate({
          resetUrl: resetLink,
          lang: lang as EmailLang,
        })

        await getEmailProvider().send({ to: email, subject, html })
      } catch (err: any) {
        // Log internally but don't expose to client
        fastify.log.warn({ err, email }, 'password-reset email failed')
      }

      return reply.code(200).send({ ok: true })
    }
  )
}
