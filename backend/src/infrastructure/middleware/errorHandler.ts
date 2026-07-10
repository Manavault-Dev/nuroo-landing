import * as Sentry from '@sentry/node'
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from '../../shared/errors/AppError.js'
import { LogEvent, logEvent } from '../../shared/observability/logger.js'

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error)

  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: 'Validation error',
      details: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    })
  }

  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      error: error.message,
      code: error.code,
    })
  }

  if (error.message?.includes('auth/')) {
    const code = error.message.match(/auth\/([a-z-]+)/)?.[1] || 'unknown'
    logEvent({
      event: LogEvent.AUTH_FAILED,
      endpoint: request.url,
      errorCode: `auth/${code}`,
    })
    const expiredOrRevoked = code === 'id-token-expired' || code === 'id-token-revoked'
    return reply.code(expiredOrRevoked ? 401 : 403).send({
      error: getFirebaseAuthErrorMessage(code),
      code: `auth/${code}`,
    })
  }

  const statusCode = error.statusCode || 500
  if (statusCode >= 500) {
    Sentry.captureException(error)
    logEvent({
      event: LogEvent.FIRESTORE_OPERATION_FAILED,
      endpoint: request.url,
      errorCode: statusCode,
    })
  }
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
