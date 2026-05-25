import * as Sentry from '@sentry/node'

export const LogEvent = {
  AUTH_FAILED: 'auth_failed',
  PERMISSION_DENIED: 'permission_denied',
  AI_GENERATION_FAILED: 'ai_generation_failed',
  AI_GENERATION_SUCCESS: 'ai_generation_success',
  PAYMENT_FAILED: 'payment_failed',
  NOTIFICATION_FAILED: 'notification_failed',
  STORAGE_UPLOAD_FAILED: 'storage_upload_failed',
  FIRESTORE_OPERATION_FAILED: 'firestore_operation_failed',
  EXTERNAL_API_FAILED: 'external_api_failed',
} as const

export type LogEventName = (typeof LogEvent)[keyof typeof LogEvent]

export interface LogEventPayload {
  event: LogEventName
  endpoint?: string
  userId?: string
  orgId?: string
  role?: string
  errorCode?: string | number
  errorMessage?: string
  durationMs?: number
  feature?: string
  model?: string
  inputLength?: number
  tokenUsage?: { prompt?: number; completion?: number; total?: number }
  environment?: string
  [key: string]: unknown
}

// Keys whose values may contain PII or sensitive user-generated content.
// Any field whose name (lowercased) ends with one of these suffixes is stripped.
const SENSITIVE_SUFFIXES = ['text', 'notes', 'description', 'content', 'message']

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix))
}

function sanitize(payload: LogEventPayload): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue
    if (isSensitiveKey(key)) continue
    result[key] = value
  }
  return result
}

export function logEvent(payload: LogEventPayload): void {
  const safe = sanitize(payload)
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level: payload.event.endsWith('_failed') ? 'error' : 'info',
    ...safe,
  })
  process.stdout.write(line + '\n')

  Sentry.addBreadcrumb({
    category: 'app.event',
    message: payload.event,
    data: safe,
    level: payload.event.endsWith('_failed') ? 'error' : 'info',
  })

  if (payload.event.endsWith('_failed')) {
    Sentry.captureMessage(payload.event, {
      level: 'error',
      extra: safe,
    })
  }
}
