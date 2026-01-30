import { FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../config.js'

// Dev-only whitelist for testing without custom claims
const DEV_WHITELIST = ['nuroo@gmail.com']

export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' }) as never
  }

  const email = (request.user.email || '').toLowerCase()
  const hasClaim = request.user.claims?.superAdmin === true
  const isWhitelisted = config.NODE_ENV !== 'production' && DEV_WHITELIST.includes(email)

  if (!hasClaim && !isWhitelisted) {
    return reply.code(403).send({ error: 'Super admin access required' }) as never
  }
}
