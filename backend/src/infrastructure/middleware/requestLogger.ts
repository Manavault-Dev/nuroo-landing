import { FastifyRequest, FastifyReply } from 'fastify'

export async function requestLogger(request: FastifyRequest, reply: FastifyReply) {
  const start = Date.now()

  reply.addHook('onSend', async () => {
    const duration = Date.now() - start
    request.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
    })
  })
}
