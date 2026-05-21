'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { ContentManagement } from '@/components/b2b/ContentManagement'

export default function AssignmentsPage() {
  const router = useRouter()
  const t = useTranslations('b2b.pages.assignments')
  const { profile, orgId, isLoading } = usePageAuth()

  useEffect(() => {
    if (!isLoading && !profile) router.push('/b2b/login')
  }, [isLoading, profile, router])

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!orgId) return null

  return (
    <ContentManagement
      mode="org"
      orgId={orgId}
      pageTitle={t('title')}
      pageSubtitle={t('subtitle')}
    />
  )
}
