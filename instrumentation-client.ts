import {
  addClientReplayWhenIdle,
  initClientSentry,
  shouldLoadClientSentry,
} from '@/lib/sentryClient'

const isB2BPage = typeof window !== 'undefined' && window.location.pathname.includes('/b2b')

if (isB2BPage && shouldLoadClientSentry()) {
  void initClientSentry()

  window.addEventListener('load', () => addClientReplayWhenIdle(), { once: true })
}

// onRouterTransitionStart intentionally omitted — Sentry route tracking only for B2B
// and the guarded initialization above keeps landing pages out of the Sentry bundle.
