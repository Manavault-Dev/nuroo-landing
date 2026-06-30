import { runWhenIdle, shouldLoadClientSentry } from '@/lib/sentryClient'

const isB2BPage = typeof window !== 'undefined' && window.location.pathname.includes('/b2b')

if (isB2BPage && shouldLoadClientSentry()) {
  const isProd = process.env.NODE_ENV === 'production'

  runWhenIdle(() => {
    import('@sentry/nextjs').then((Sentry) => {
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

      if (isProd) {
        window.addEventListener(
          'load',
          () => {
            Sentry.addIntegration(
              Sentry.replayIntegration({
                blockAllMedia: true,
                maskAllText: true,
                maskAllInputs: true,
              })
            )
          },
          { once: true }
        )
      }
    })
  })
}

// onRouterTransitionStart intentionally omitted — Sentry route tracking only for B2B
// and the lazy import above handles initialization there.
