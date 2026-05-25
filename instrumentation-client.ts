import * as Sentry from '@sentry/nextjs'

const isProd = process.env.NODE_ENV === 'production'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  integrations: [
    Sentry.replayIntegration({
      blockAllMedia: true,
      maskAllText: true,
      maskAllInputs: true,
    }),
  ],

  tracesSampleRate: isProd ? 0.1 : 1.0,

  enableLogs: true,

  replaysSessionSampleRate: isProd ? 0.05 : 0.1,
  replaysOnErrorSampleRate: 1.0,

  sendDefaultPii: false,

  beforeSend(event) {
    if (event.request) {
      delete event.request.data
    }

    const msg = event.exception?.values?.[0]?.value ?? ''
    if (msg.includes('Extension context') || msg.includes('ResizeObserver')) {
      return null
    }
    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
