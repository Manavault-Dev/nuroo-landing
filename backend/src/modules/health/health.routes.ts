import { FastifyPluginAsync } from 'fastify'

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'nuroo-backend',
  }))
}
