'use client'

import { useRef, useCallback } from 'react'

export interface VoiceReadyResult {
  recognitionRef: React.MutableRefObject<SpeechRecognition | null>
  synthRef: React.MutableRefObject<SpeechSynthesis | null>
  speak: (text: string, enabled: boolean, lang: string) => void
}

export function useVoiceReady(): VoiceReadyResult {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  const speak = useCallback((text: string, enabled: boolean, lang: string) => {
    if (!enabled || !synthRef.current) return
    synthRef.current.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 0.9
    synthRef.current.speak(u)
  }, [])

  return { recognitionRef, synthRef, speak }
}
