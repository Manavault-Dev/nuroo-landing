'use client'

import { usePathname } from 'next/navigation'
import { Header } from './Header'

export function ConditionalHeader() {
  const pathname = usePathname()

  if (pathname?.startsWith('/b2b')) {
    return null
  }

  return <Header />
}
