'use client'

import { useEffect } from 'react'
import { usePathname as useNextPathname } from 'next/navigation'
import { Header } from './Header'

export function ConditionalHeader() {
  const fullPathname = useNextPathname() ?? ''
  const pathname = fullPathname.replace(/^\/(en|ru|ky)/, '') || '/'
  const isB2B = pathname.startsWith('/b2b')

  useEffect(() => {
    if (isB2B) return

    const root = document.documentElement
    root.classList.remove('dark')
    root.classList.add('light')
    root.style.colorScheme = 'light'
  }, [isB2B])

  if (isB2B) {
    return null
  }

  return <Header />
}
