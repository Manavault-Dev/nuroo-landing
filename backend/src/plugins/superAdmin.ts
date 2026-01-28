import { FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../config.js'

// TEMPORARY: Whitelist for dev mode (imported from dev route)
// This allows Super Admin access without custom claims in development
const DEV_SUPER_ADMIN_WHITELIST = ['nuroo@gmail.com']

/**
 * Middleware to require super admin access
 * Checks Firebase custom claims for superAdmin === true
 * In dev mode, also checks email whitelist as fallback
 */
export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' }) as never
  }

  const userEmail = (request.user.email || '').toLowerCase().trim()
  const isSuperAdmin = request.user.claims?.superAdmin === true

  // TEMPORARY: In dev mode, also check whitelist if custom claim is not set
  const isWhitelisted =
    config.NODE_ENV !== 'production' &&
    DEV_SUPER_ADMIN_WHITELIST.some((email) => email.toLowerCase().trim() === userEmail)

  console.log(`🔍 [SUPER_ADMIN] Checking access for: ${userEmail}`)
  console.log(`📋 [SUPER_ADMIN] Custom claim: ${isSuperAdmin}`)
  console.log(`📋 [SUPER_ADMIN] Whitelisted: ${isWhitelisted}`)
  console.log(`📋 [SUPER_ADMIN] Environment: ${config.NODE_ENV}`)

  if (!isSuperAdmin && !isWhitelisted) {
    console.log(
      `🚫 [SUPER_ADMIN] Access denied for uid: ${request.user.uid}, email: ${request.user.email}`
    )
    return reply.code(403).send({ error: 'Super admin access required' }) as never
  }

  if (isWhitelisted && !isSuperAdmin) {
    console.log(
      `⚠️ [SUPER_ADMIN] Access granted via dev whitelist for uid: ${request.user.uid}, email: ${request.user.email}`
    )
  } else {
    console.log(`✅ [SUPER_ADMIN] Access granted for uid: ${request.user.uid}`)
  }
}
