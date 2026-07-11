'use client'

import { useCallback, useRef, useState } from 'react'

export type ToastKind = 'error' | 'success' | 'warn'

export interface ToastMsg {
  id: number
  kind: ToastKind
  text: string
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const counter = useRef(0)

  const show = useCallback((text: string, kind: ToastKind = 'error') => {
    const id = ++counter.current
    setToasts((prev) => [...prev, { id, kind, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  return { toasts, show }
}
