import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.npm_package_version,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  enableLogs: true,

  sendDefaultPii: false,

  beforeSend(event) {
    // Strip request body — may contain child data
    if (event.request) {
      delete event.request.data
    }
    return event
  },
})
