/**
 * Google Calendar OAuth routes for specialists.
 *
 * Flow:
 *   1. Specialist requests connect URL  → GET /calendar/connect
 *   2. Google redirects back            → GET /calendar/callback?code=...&state=...
 *   3. Backend exchanges code → tokens  → saves refreshToken in Firestore
 *   4. Specialist is now connected      → GET /calendar/status
 *   5. Disconnect                       → DELETE /calendar/disconnect
 */

import type { FastifyPluginAsync } from 'fastify'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import {
  getOAuthConsentUrl,
  exchangeCodeForTokens,
} from '../../infrastructure/meetings/google-meet.js'

const RATE = { max: 30, timeWindow: '1 minute' }

/** Firestore path: specialists/{uid}/integrations/google_calendar */
const calendarDocPath = (uid: string) => `specialists/${uid}/integrations/google_calendar`

export const calendarRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  // ── GET /calendar/connect ─────────────────────────────────────────────────
  // Returns the Google OAuth consent URL for the authenticated specialist.

  fastify.get('/calendar/connect', { config: { rateLimit: RATE } }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

    const uid = request.user.uid
    const state = Buffer.from(JSON.stringify({ uid, ts: Date.now() })).toString('base64url')

    try {
      const url = getOAuthConsentUrl(state)
      return { ok: true, url }
    } catch (err: any) {
      return reply.code(503).send({ error: err.message })
    }
  })

  // ── GET /calendar/callback ────────────────────────────────────────────────
  // Google redirects here after specialist approves access.

  fastify.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/calendar/callback',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      const { code, state, error } = request.query

      if (error) {
        return reply.redirect(
          `${process.env.NEXT_PUBLIC_B2B_URL ?? ''}/b2b/integrations?error=access_denied`
        )
      }

      if (!code || !state) {
        return reply.code(400).send({ error: 'Missing code or state' })
      }

      // Decode state to get uid
      let uid: string
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
        uid = decoded.uid
        if (!uid) throw new Error('Missing uid in state')

        // Reject stale states (> 10 min)
        if (Date.now() - decoded.ts > 10 * 60 * 1000) {
          throw new Error('State expired')
        }
      } catch {
        return reply.code(400).send({ error: 'Invalid state parameter' })
      }

      try {
        const { refreshToken, email } = await exchangeCodeForTokens(code)

        await db.doc(calendarDocPath(uid)).set({
          connected: true,
          googleEmail: email,
          refreshToken, // stored encrypted in prod via KMS ideally
          connectedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })

        const redirectUrl = `${process.env.NEXT_PUBLIC_B2B_URL ?? ''}/b2b/integrations?success=1`
        return reply.redirect(redirectUrl)
      } catch (err: any) {
        fastify.log.error({ err }, 'Google Calendar OAuth callback failed')
        const redirectUrl = `${process.env.NEXT_PUBLIC_B2B_URL ?? ''}/b2b/integrations?error=token_exchange`
        return reply.redirect(redirectUrl)
      }
    }
  )

  // ── GET /calendar/status ──────────────────────────────────────────────────
  // Returns connection status for the authenticated specialist.

  fastify.get('/calendar/status', { config: { rateLimit: RATE } }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

    const snap = await db.doc(calendarDocPath(request.user.uid)).get()

    if (!snap.exists || !snap.data()?.connected) {
      return { ok: true, connected: false }
    }

    const data = snap.data()!
    return {
      ok: true,
      connected: true,
      googleEmail: data.googleEmail ?? null,
      connectedAt: data.connectedAt ?? null,
    }
  })

  // ── DELETE /calendar/disconnect ───────────────────────────────────────────
  // Revokes access and removes stored tokens.

  fastify.delete(
    '/calendar/disconnect',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })

      await db.doc(calendarDocPath(request.user.uid)).set({
        connected: false,
        googleEmail: null,
        refreshToken: null,
        disconnectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      return { ok: true }
    }
  )
}
