'use client'

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
