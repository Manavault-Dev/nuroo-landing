'use client'

import { useEffect, useRef } from 'react'

/**
 * Attaches IntersectionObserver to all [data-sr] elements within the root ref.
 * When they enter the viewport, adds 'sr-revealed' class (triggering CSS transitions).
 */
export function useScrollReveal() {
  const rootRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('sr-revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
    )

    // Observe all elements with data-sr attribute inside root, or globally
    const els = document.querySelectorAll('[data-sr]')
    els.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return rootRef
}
