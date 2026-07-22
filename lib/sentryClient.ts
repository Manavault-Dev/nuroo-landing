'use client'

type SentryNext = typeof import('@sentry/nextjs')

let clientSentryPromise: Promise<SentryNext | null> | null = null
let replayIntegrationAdded = false

export function shouldLoadClientSentry() {
  if (typeof window === 'undefined') return false
  if (process.env.NODE_ENV !== 'production') return false
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return false

  const host = window.location.hostname
  if (
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_SENTRY !== '1' &&
    (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0')
  ) {
    return false
  }

  return true
}

export function initClientSentry() {
  if (!shouldLoadClientSentry()) return null
  if (clientSentryPromise) return clientSentryPromise

  const isProd = process.env.NODE_ENV === 'production'

  clientSentryPromise = import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_APP_VERSION,

        integrations: [],
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,

        tracesSampleRate: isProd ? 0.1 : 0,
        enableLogs: isProd,
        sendDefaultPii: false,

        beforeSend(event) {
          if (event.request) delete event.request.data
          const msg = event.exception?.values?.[0]?.value ?? ''
          if (msg.includes('Extension context') || msg.includes('ResizeObserver')) return null
          return event
        },
      })

      return Sentry
    })
    .catch(() => {
      clientSentryPromise = null
      return null
    })

  return clientSentryPromise
}

export function addClientReplayWhenIdle() {
  if (process.env.NODE_ENV !== 'production') return () => undefined

  return runWhenIdle(() => {
    void initClientSentry()?.then((Sentry) => {
      if (!Sentry || replayIntegrationAdded) return
      replayIntegrationAdded = true
      Sentry.addIntegration(
        Sentry.replayIntegration({
          blockAllMedia: true,
          maskAllText: true,
          maskAllInputs: true,
        })
      )
    })
  })
}

export function captureClientException(
  error: unknown,
  context?: {
    tags?: Record<string, string | number | boolean | null | undefined>
    extra?: Record<string, unknown>
  }
) {
  void initClientSentry()?.then((Sentry) => {
    if (!Sentry) return
    Sentry.captureException(error, context)
  })
}

export function runWhenIdle(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined

  const idleCallback = window.requestIdleCallback
  if (idleCallback) {
    const id = idleCallback(callback, { timeout: 5000 })
    return () => window.cancelIdleCallback?.(id)
  }

  const id = window.setTimeout(callback, 3000)
  return () => window.clearTimeout(id)
}
