import { FastifyPluginAsync } from 'fastify'

/** @removed Super Admin removed. All access is via organizations. */
export const devRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/dev/check-super-admin', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
    return {
      uid: request.user.uid,
      email: request.user.email,
      isSuperAdmin: false,
      note: 'Super Admin removed. Use organizations.',
    }
  })
}
