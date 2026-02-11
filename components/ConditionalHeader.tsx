'use client'

import { usePathname as useNextPathname } from 'next/navigation'
import { Header } from './Header'

export function ConditionalHeader() {
  const fullPathname = useNextPathname() ?? ''
  const pathname = fullPathname.replace(/^\/(en|ru|ky)/, '') || '/'

  if (pathname.startsWith('/b2b')) {
    return null
  }

  return <Header />
}
