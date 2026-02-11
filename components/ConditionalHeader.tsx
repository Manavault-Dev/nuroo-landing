'use client'

import { usePathname as useNextPathname } from 'next/navigation'
import { Header } from './Header'

export function ConditionalHeader() {
  const fullPathname = useNextPathname() ?? ''

  // Strip locale prefix if present (e.g. /en/b2b/login -> /b2b/login)
  const pathname = fullPathname.replace(/^\/(en|ru|ky)/, '') || '/'

  if (pathname.startsWith('/b2b')) {
    return null
  }

  return <Header />
}
