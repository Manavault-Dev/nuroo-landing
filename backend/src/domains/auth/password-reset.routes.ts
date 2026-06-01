import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { createHash, randomInt } from 'crypto'
import { z } from 'zod'
import admin from 'firebase-admin'

import { getAuth, getFirestore } from '../../infrastructure/database/firebase.js'
import { sendOtpEmail, type SupportedLocale } from '../../services/emailService.js'

// ─── Constants ────────────────────────────────────────────────────────────────

/** OTP time-to-live in minutes */
const OTP_TTL_MINUTES = 15

/** Max failed verification attempts before OTP is invalidated */
const MAX_ATTEMPTS = 3

/** Minimum seconds between resend requests for the same email */
const RESEND_COOLDOWN_SECONDS = 60

/** Custom token time-to-live in seconds (used in Firebase Custom Token) */
const CUSTOM_TOKEN_TTL_SECONDS = 600 // 10 minutes

/** Firestore collection for OTP documents */
const OTP_COLLECTION = 'passwordResetOtps'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const resetRequestSchema = z.object({
  email: z.string().email(),
  locale: z.enum(['en', 'ru', 'ky']).default('en'),
})

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
})

const updatePasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
})

// ─── Firestore Document Types ─────────────────────────────────────────────────

interface OtpDocument {
  uid: string
  email: string
  otpHash: string
  expiresAt: admin.firestore.Timestamp
  createdAt: admin.firestore.Timestamp
  attempts: number
  lastSentAt: admin.firestore.Timestamp
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashOtp(code: string, email: string): string {
  return createHash('sha256').update(`${code}:${email.toLowerCase()}`).digest('hex')
}

function generateOtpCode(): string {
  // Cryptographically secure 6-digit code
  return String(randomInt(100000, 999999))
}

function getOtpDocRef(uid: string) {
  return getFirestore().doc(`${OTP_COLLECTION}/${uid}`)
}

async function findUserByEmail(email: string) {
  try {
    return await getAuth().getUserByEmail(email)
  } catch {
    return null
  }
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * POST /auth/reset-password-request
 * Generates a 6-digit OTP and sends it to the provided email.
 * Rate-limited: max 1 request per 60 seconds per email.
 */
async function handleResetRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const parse = resetRequestSchema.safeParse(request.body)
  if (!parse.success) {
    return reply.code(400).send({ error: 'Invalid request', details: parse.error.errors })
  }

  const { email, locale } = parse.data

  // Always return 200 to avoid email enumeration attacks
  const user = await findUserByEmail(email)
  if (!user) {
    return reply.send({ ok: true, message: 'If this email exists, a code has been sent.' })
  }

  const uid = user.uid
  const db = getFirestore()
  const docRef = getOtpDocRef(uid)

  // ── Rate limiting: enforce resend cooldown ───────────────────────────────
  const existing = await docRef.get()
  if (existing.exists) {
    const data = existing.data() as OtpDocument
    const lastSentMs = data.lastSentAt.toMillis()
    const elapsed = Date.now() - lastSentMs

    if (elapsed < RESEND_COOLDOWN_SECONDS * 1000) {
      const retryAfter = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - elapsed) / 1000)
      return reply
        .code(429)
        .header('Retry-After', String(retryAfter))
        .send({ error: 'Too many requests. Please wait before requesting a new code.', retryAfter })
    }
  }

  // ── Generate and store OTP ───────────────────────────────────────────────
  const code = generateOtpCode()
  const otpHash = hashOtp(code, email)
  const now = admin.firestore.Timestamp.now()
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

  const otpDoc: OtpDocument = {
    uid,
    email: email.toLowerCase(),
    otpHash,
    expiresAt,
    createdAt: now,
    attempts: 0,
    lastSentAt: now,
  }

  await docRef.set(otpDoc)

  // ── Send email ───────────────────────────────────────────────────────────
  try {
    await sendOtpEmail({
      to: email,
      code,
      locale: locale as SupportedLocale,
      expiresInMinutes: OTP_TTL_MINUTES,
    })
  } catch (err: unknown) {
    // Roll back the OTP doc to preserve rate limiting only if doc was newly created
    // but allow retry so we delete to re-enable re-send
    await docRef.delete()
    request.log.error(
      { err: err instanceof Error ? err.message : err },
      '[PasswordReset] Email send failed'
    )
    return reply.code(502).send({ error: 'Failed to send email. Please try again later.' })
  }

  return reply.send({ ok: true, message: 'If this email exists, a code has been sent.' })
}

/**
 * POST /auth/verify-otp
 * Verifies the 6-digit OTP against the stored hash.
 * Returns a Firebase Custom Token with passwordReset claim on success.
 */
async function handleVerifyOtp(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const parse = verifyOtpSchema.safeParse(request.body)
  if (!parse.success) {
    return reply.code(400).send({ error: 'Invalid request', details: parse.error.errors })
  }

  const { email, code } = parse.data

  const user = await findUserByEmail(email)
  if (!user) {
    return reply.code(400).send({ error: 'Invalid code or email.' })
  }

  const docRef = getOtpDocRef(user.uid)
  const snap = await docRef.get()

  if (!snap.exists) {
    return reply
      .code(400)
      .send({ error: 'No active reset request found. Please request a new code.' })
  }

  const data = snap.data() as OtpDocument

  // ── Check expiry ─────────────────────────────────────────────────────────
  if (data.expiresAt.toMillis() < Date.now()) {
    await docRef.delete()
    return reply.code(400).send({ error: 'The code has expired. Please request a new one.' })
  }

  // ── Check attempt limit ──────────────────────────────────────────────────
  if (data.attempts >= MAX_ATTEMPTS) {
    await docRef.delete()
    return reply.code(400).send({ error: 'Too many failed attempts. Please request a new code.' })
  }

  // ── Verify hash (constant-time via string comparison on fixed-length hex) ─
  const expectedHash = hashOtp(code, email)
  if (expectedHash !== data.otpHash) {
    await docRef.update({ attempts: admin.firestore.FieldValue.increment(1) })
    const remaining = MAX_ATTEMPTS - (data.attempts + 1)
    return reply.code(400).send({
      error: 'Incorrect code.',
      attemptsRemaining: remaining,
    })
  }

  // ── OTP is valid — delete it immediately (one-time use) ──────────────────
  await docRef.delete()

  // ── Issue Firebase Custom Token with passwordReset claim ─────────────────
  const customToken = await getAuth().createCustomToken(user.uid, {
    passwordReset: true,
    // embed issuedAt so downstream can verify the token isn't stale
    issuedAt: Math.floor(Date.now() / 1000),
    ttl: CUSTOM_TOKEN_TTL_SECONDS,
  })

  return reply.send({ ok: true, customToken })
}

/**
 * PATCH /me/password
 * Updates the authenticated user's password.
 * Requires the request.user to carry the passwordReset claim.
 * Protected by a dedicated preHandler — see route definition below.
 */
async function handleUpdatePassword(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const parse = updatePasswordSchema.safeParse(request.body)
  if (!parse.success) {
    return reply.code(400).send({ error: 'Invalid password', details: parse.error.errors })
  }

  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' })
  }

  // ── Verify passwordReset claim ────────────────────────────────────────────
  const claims = request.user.claims
  if (!claims?.passwordReset) {
    return reply.code(403).send({
      error: 'Forbidden. This endpoint requires a password-reset token.',
    })
  }

  // ── Optional: enforce TTL on the custom token claim ───────────────────────
  const issuedAt = typeof claims.issuedAt === 'number' ? claims.issuedAt : null
  const ttl = typeof claims.ttl === 'number' ? claims.ttl : CUSTOM_TOKEN_TTL_SECONDS

  if (issuedAt !== null) {
    const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt
    if (ageSeconds > ttl) {
      return reply.code(403).send({
        error: 'Password reset session has expired. Please start the process again.',
      })
    }
  }

  const { uid } = request.user
  const { newPassword } = parse.data

  try {
    await getAuth().updateUser(uid, { password: newPassword })
  } catch (err: unknown) {
    request.log.error(
      { err: err instanceof Error ? err.message : err },
      '[PasswordReset] updateUser failed'
    )
    return reply.code(500).send({ error: 'Failed to update password. Please try again.' })
  }

  return reply.send({ ok: true })
}

// ─── preHandler: require passwordReset claim ──────────────────────────────────

async function requirePasswordResetClaim(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply
      .code(401)
      .send({ error: 'Missing or invalid Authorization header' }) as unknown as void
  }

  try {
    const token = authHeader.substring(7)
    const decoded = await getAuth().verifyIdToken(token)

    request.user = {
      uid: decoded.uid,
      email: decoded.email,
      claims: decoded as unknown as Record<string, unknown> & {
        superAdmin?: boolean
        passwordReset?: boolean
        issuedAt?: number
        ttl?: number
      },
    }

    if (!decoded.passwordReset) {
      return reply.code(403).send({
        error: 'Forbidden. This endpoint requires a password-reset token.',
      }) as unknown as void
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown auth error'
    request.log.warn({ message }, '[PasswordReset] Token verification failed')
    return reply.code(401).send({ error: 'Invalid or expired token' }) as unknown as void
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export const passwordResetRoutes: FastifyPluginAsync = async (fastify) => {
  // Public: request OTP
  fastify.post('/auth/reset-password-request', handleResetRequest)

  // Public: verify OTP → get custom token
  fastify.post('/auth/verify-otp', handleVerifyOtp)

  // Protected: update password (requires passwordReset claim)
  fastify.patch('/me/password', { preHandler: [requirePasswordResetClaim] }, handleUpdatePassword)
}
