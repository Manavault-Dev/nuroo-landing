import { FastifyRequest, FastifyReply } from 'fastify'

const requestTimings = new WeakMap<FastifyRequest, number>()

export async function requestLogger(request: FastifyRequest, reply: FastifyReply) {
  const start = Date.now()
  requestTimings.set(request, start)
}

export async function requestLoggerOnSend(request: FastifyRequest, reply: FastifyReply) {
  const startTime = requestTimings.get(request)
  if (startTime) {
    const duration = Date.now() - startTime
    request.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
    })
    requestTimings.delete(request)
  }
}
