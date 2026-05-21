import { FastifyPluginAsync } from 'fastify'

export const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'nuroo-backend',
    revision: process.env.K_REVISION || null,
    commit: process.env.GIT_SHA || null,
  }))
}
