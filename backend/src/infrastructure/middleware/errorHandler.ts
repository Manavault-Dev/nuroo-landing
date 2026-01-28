import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from '../../shared/errors/AppError.js'

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error)

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: 'Validation error',
      details: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    })
  }

  // Handle custom app errors
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      error: error.message,
      code: error.code,
    })
  }

  // Handle Firebase errors
  if (error.message?.includes('auth/')) {
    const code = error.message.match(/auth\/([a-z-]+)/)?.[1] || 'unknown'
    return reply.code(400).send({
      error: getFirebaseAuthErrorMessage(code),
      code: `auth/${code}`,
    })
  }

  // Default error response
  const statusCode = error.statusCode || 500
  return reply.code(statusCode).send({
    error: statusCode >= 500 ? 'Internal server error' : error.message,
  })
}

function getFirebaseAuthErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    'user-not-found': 'User not found',
    'wrong-password': 'Invalid password',
    'email-already-exists': 'Email already in use',
    'invalid-email': 'Invalid email address',
    'weak-password': 'Password is too weak',
    'operation-not-allowed': 'Operation not allowed',
    'too-many-requests': 'Too many requests, please try again later',
  }
  return messages[code] || 'Authentication error'
}
