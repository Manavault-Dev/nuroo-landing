import * as Sentry from '@sentry/node'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
  release: process.env.npm_package_version ?? 'unknown',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  sendDefaultPii: false,
  beforeSend(event) {
    // Strip request bodies — they may contain child data
    if (event.request) {
      event.request.data = undefined
    }

    // Strip extra/contexts keys whose names include sensitive terms
    const SENSITIVE_KEYS = ['prompt', 'text', 'message', 'content', 'notes', 'description']
    const containsSensitive = (key: string) =>
      SENSITIVE_KEYS.some((term) => key.toLowerCase().includes(term))

    if (event.extra) {
      for (const key of Object.keys(event.extra)) {
        if (containsSensitive(key)) delete event.extra[key]
      }
    }

    if (event.contexts) {
      for (const key of Object.keys(event.contexts)) {
        if (containsSensitive(key)) delete event.contexts[key]
      }
    }

    return event
  },
})
