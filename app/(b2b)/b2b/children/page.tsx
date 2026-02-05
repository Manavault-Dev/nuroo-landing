'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type ChildSummary, type SpecialistProfile } from '@/lib/b2b/api'
import { Users, ArrowLeft, ChevronRight } from 'lucide-react'

export default function ChildrenPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [loading, setLoading] = useState(true)

  const orgId = searchParams.get('orgId') || profile?.organizations?.[0]?.orgId || undefined

  useEffect(() => {
    const loadData = async () => {
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

        const profileData = await apiClient.getMe()
        setProfile(profileData)

        const effectiveOrgId = searchParams.get('orgId') || profileData.organizations?.[0]?.orgId
        if (!effectiveOrgId) {
          setLoading(false)
          router.push('/b2b/onboarding')
          return
        }

        const childrenData = await apiClient.getChildren(effectiveOrgId)
        setChildren(childrenData)
      } catch (error) {
        console.error('Error loading children:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading children...</p>
        </div>
      </div>
    )
  }

  const dashboardHref = orgId ? `/b2b?orgId=${orgId}` : '/b2b'

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-2">
          <Link
            href={dashboardHref}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">Children</h2>
        </div>
        <p className="text-gray-600">
          {children.length} {children.length === 1 ? 'child' : 'children'} assigned
        </p>
      </div>

      <div>
        {children.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No children assigned</h3>
            <p className="text-gray-600">
              Children assigned to your organization will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {children.map((child) => (
                <Link
                  key={child.id}
                  href={`/b2b/children/${child.id}${orgId ? `?orgId=${orgId}` : ''}`}
                  className="block p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{child.name}</h3>
                        {child.age && (
                          <span className="text-sm text-gray-500">Age {child.age}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                        {child.speechStepNumber && (
                          <div>
                            <span className="text-gray-600">Current step:</span>{' '}
                            <span className="font-medium text-gray-900">
                              Step {child.speechStepNumber}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Tasks completed:</span>{' '}
                          <span className="font-medium text-gray-900">
                            {child.completedTasksCount}
                          </span>
                        </div>
                        {child.lastActiveDate && (
                          <div>
                            <span className="text-gray-600">Last active:</span>{' '}
                            <span className="font-medium text-gray-900">
                              {new Date(child.lastActiveDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-4" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
