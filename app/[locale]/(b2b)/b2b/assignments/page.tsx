'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import { ContentManagement } from '@/components/b2b/ContentManagement'

export default function AssignmentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('b2b.pages.assignments')
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const user = getCurrentUser()
      if (!user) {
        router.push('/b2b/login')
        return
      }
      try {
        const idToken = await getIdToken()
        if (!idToken) {
          router.push('/b2b/login')
          return
        }
        apiClient.setToken(idToken)

        const orgIdParam = searchParams.get('orgId')
        if (!orgIdParam) {
          const profile = await apiClient.getMe()
          const firstOrg = profile.organizations[0]
          if (firstOrg) {
            setOrgId(firstOrg.orgId)
            router.replace(`/b2b/assignments?orgId=${firstOrg.orgId}`)
            return
          }
          router.push('/b2b')
          return
        }
        setOrgId(orgIdParam)
      } catch {
        router.push('/b2b/login')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router, searchParams])

  if (loading) {
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
