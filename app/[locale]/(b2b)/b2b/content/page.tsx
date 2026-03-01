'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'

export default function ContentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = searchParams.get('orgId')

  useEffect(() => {
    if (orgId) {
      router.replace(`/b2b/assignments?orgId=${orgId}`)
    } else {
      router.replace('/b2b')
    }
  }, [router, orgId])

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[40vh]">
      <p className="text-gray-500">Redirecting...</p>
    </div>
  )
}
