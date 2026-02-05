'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinPage() {
  const router = useRouter()

  useEffect(() => {
    // Backward-compatible alias. Real onboarding is /b2b/onboarding.
    router.replace('/b2b/onboarding')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-600">Redirecting…</p>
    </div>
  )
}
