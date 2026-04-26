import { FastifyReply } from 'fastify'

export function success<T extends object>(reply: FastifyReply, data: T, statusCode: number = 200) {
  return reply.code(statusCode).send({ ok: true, ...data })
}

export function error(reply: FastifyReply, message: string, statusCode: number = 400) {
  return reply.code(statusCode).send({ error: message })
}

export function notFound(reply: FastifyReply, resource: string = 'Resource') {
  return reply.code(404).send({ error: `${resource} not found` })
}

export function forbidden(reply: FastifyReply, message: string = 'Access denied') {
  return reply.code(403).send({ error: message })
}

export function unauthorized(reply: FastifyReply, message: string = 'Unauthorized') {
  return reply.code(401).send({ error: message })
}
