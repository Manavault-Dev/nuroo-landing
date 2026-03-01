'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

export default function AdminPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/b2b')
  }, [router])

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[40vh]">
      <p className="text-gray-500">Redirecting...</p>
    </div>
  )
}
