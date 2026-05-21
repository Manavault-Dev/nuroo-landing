import * as Sentry from '@sentry/nextjs'

const isProd = process.env.NODE_ENV === 'production'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  integrations: [Sentry.replayIntegration()],

  // В проде трейсим 10% запросов — достаточно для аналитики
  tracesSampleRate: isProd ? 0.1 : 1.0,

  enableLogs: true,

  // Replay: 5% обычных сессий, 100% сессий с ошибкой
  replaysSessionSampleRate: isProd ? 0.05 : 0.1,
  replaysOnErrorSampleRate: 1.0,

  sendDefaultPii: true,

  beforeSend(event) {
    // Игнорируем шум от браузерных расширений и ResizeObserver
    const msg = event.exception?.values?.[0]?.value ?? ''
    if (msg.includes('Extension context') || msg.includes('ResizeObserver')) {
      return null
    }
    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
