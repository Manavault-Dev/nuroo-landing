import type { FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../../config/index.js'

export async function requirePlatformAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const headerKey = request.headers['x-platform-admin-key']
  if (config.PLATFORM_ADMIN_SECRET && headerKey === config.PLATFORM_ADMIN_SECRET) {
    return
  }

  const claims = request.user?.claims as Record<string, unknown> | undefined
  if (claims?.platform_admin === true) {
    return
  }

  return reply.code(403).send({
    error: 'Platform admin access required',
    code: 'PLATFORM_ADMIN_REQUIRED',
  }) as never
}
