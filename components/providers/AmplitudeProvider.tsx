'use client'

import { useEffect } from 'react'
import * as amplitude from '@amplitude/unified'

const AMPLITUDE_API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY

let amplitudeInitialized = false

declare global {
  interface Window {
    __nurooAmplitudeInitialized?: boolean
  }
}

export function AmplitudeProvider() {
  useEffect(() => {
    if (!AMPLITUDE_API_KEY) return
    if (amplitudeInitialized || window.__nurooAmplitudeInitialized) return

    amplitudeInitialized = true
    window.__nurooAmplitudeInitialized = true
    void amplitude
      .initAll(AMPLITUDE_API_KEY, {
        analytics: {
          autocapture: true,
        },
        sessionReplay: {
          sampleRate: 1,
        },
      })
      .then(() => {
        amplitude.track('nuroo_app_loaded', {
          path: window.location.pathname,
        })
      })
  }, [])

  return null
}
