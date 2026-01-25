import { FastifyReply } from 'fastify'

/**
 * Send a success response
 */
export function success<T extends object>(reply: FastifyReply, data: T, statusCode: number = 200) {
  return reply.code(statusCode).send({ ok: true, ...data })
}

/**
 * Send an error response
 */
export function error(reply: FastifyReply, message: string, statusCode: number = 400) {
  return reply.code(statusCode).send({ error: message })
}

/**
 * Send a not found response
 */
export function notFound(reply: FastifyReply, resource: string = 'Resource') {
  return reply.code(404).send({ error: `${resource} not found` })
}

/**
 * Send a forbidden response
 */
export function forbidden(reply: FastifyReply, message: string = 'Access denied') {
  return reply.code(403).send({ error: message })
}

/**
 * Send an unauthorized response
 */
export function unauthorized(reply: FastifyReply, message: string = 'Unauthorized') {
  return reply.code(401).send({ error: message })
}
