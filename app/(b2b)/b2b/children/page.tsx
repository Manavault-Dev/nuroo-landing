'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type ChildSummary } from '@/lib/b2b/api'
import { Users, ArrowLeft, ChevronRight } from 'lucide-react'

export default function ChildrenPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = searchParams.get('orgId') || 'default-org'
  
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [loading, setLoading] = useState(true)

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

        const childrenData = await apiClient.getChildren(orgId)
        setChildren(childrenData)
      } catch (error) {
        console.error('Error loading children:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, orgId])

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/b2b"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Children</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {children.length} {children.length === 1 ? 'child' : 'children'} assigned
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No children assigned</h3>
            <p className="text-gray-600">Children assigned to your organization will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-200">
              {children.map((child) => (
                <Link
                  key={child.id}
                  href={`/b2b/children/${child.id}?orgId=${orgId}`}
                  className="block p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{child.name}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Tasks completed:</span>{' '}
                          <span className="text-gray-900">{child.completedTasksCount}</span>
                        </div>
                        {child.speechStepNumber && (
                          <div>
                            <span className="font-medium">Roadmap step:</span>{' '}
                            <span className="text-gray-900">{child.speechStepNumber}</span>
                          </div>
                        )}
                        {child.lastActiveDate && (
                          <div>
                            <span className="font-medium">Last active:</span>{' '}
                            <span className="text-gray-900">
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
      </main>
    </div>
  )
}
