'use client'

import { usePathname } from 'next/navigation'
import { ScrollProgress } from '@/components/ScrollProgress'
import { ScrollInit } from '@/components/ScrollInit'

export function LandingOnlyEffects() {
  const fullPathname = usePathname()
  if (!fullPathname) return null

  const pathname = fullPathname.replace(/^\/(en|ru|ky)(?=\/|$)/, '') || '/'
  const isLanding = pathname === '/'

  if (!isLanding) return null

  return (
    <>
      <ScrollProgress />
      <ScrollInit />
    </>
  )
}
