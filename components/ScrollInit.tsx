'use client'

import { useEffect } from 'react'

export function ScrollInit() {
  useEffect(() => {
    // ── Scroll reveal ───────────────────────────────
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('sr-revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.06, rootMargin: '0px 0px -40px 0px' }
    )

    const observe = () => {
      document.querySelectorAll('[data-sr]').forEach((el) => observer.observe(el))
    }
    observe()

    // Re-observe after a tick in case components rendered late
    const timer = setTimeout(observe, 300)

    // ── Glow card mouse tracking ────────────────────
    const onMouseMove = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.glow-card') as HTMLElement | null
      if (!target) return
      const rect = target.getBoundingClientRect()
      target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
      target.style.setProperty('--my', `${e.clientY - rect.top}px`)
    }
    document.addEventListener('mousemove', onMouseMove)

    // ── Stat counters ───────────────────────────────
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          const target = parseFloat(el.dataset.countTarget || '0')
          const suffix = el.dataset.countSuffix || ''
          const prefix = el.dataset.countPrefix || ''
          const duration = 1400
          const start = performance.now()
          const animate = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3)
            const current = Math.round(eased * target)
            el.textContent = prefix + current + suffix
            if (progress < 1) requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
          counterObserver.unobserve(el)
        })
      },
      { threshold: 0.5 }
    )
    document.querySelectorAll('[data-count-target]').forEach((el) => counterObserver.observe(el))

    return () => {
      clearTimeout(timer)
      observer.disconnect()
      counterObserver.disconnect()
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return null
}
