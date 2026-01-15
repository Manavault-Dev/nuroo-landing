'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser, signOut, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile, type ChildSummary } from '@/lib/b2b/api'
import { LayoutDashboard, Users, LogOut, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
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

        try {
          const session = await apiClient.getSession()
          if (!session.hasOrg) {
            router.push('/b2b/join')
            return
          }
        } catch (sessionError) {
          console.warn('Failed to check session:', sessionError)
        }

        const profileData = await apiClient.getMe()
        setProfile(profileData)

        if (profileData.organizations.length > 0) {
          const orgId = profileData.organizations[0].orgId
          const childrenData = await apiClient.getChildren(orgId)
          setChildren(childrenData)
        } else {
          router.push('/b2b/join')
        }
      } catch (error) {
        console.error('Error loading dashboard:', error)
        router.push('/b2b/login')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleSignOut = async () => {
    try {
      await signOut()
      apiClient.setToken(null)
      router.push('/b2b/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const currentOrg = profile?.organizations[0]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Specialist Portal</h1>
              {currentOrg && (
                <p className="text-sm text-gray-600 mt-1">{currentOrg.orgName}</p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900">
            Welcome back, {profile?.name || 'Specialist'}
          </h2>
          <p className="text-gray-600 mt-1">Here's an overview of your assigned children</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Children</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{children.length}</p>
              </div>
              <div className="bg-primary-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active This Week</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {children.filter((child) => {
                    if (!child.lastActiveDate) return false
                    const weekAgo = new Date()
                    weekAgo.setDate(weekAgo.getDate() - 7)
                    return new Date(child.lastActiveDate) > weekAgo
                  }).length}
                </p>
              </div>
              <div className="bg-secondary-100 p-3 rounded-lg">
                <LayoutDashboard className="w-6 h-6 text-secondary-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tasks Completed</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {children.reduce((sum, child) => sum + child.completedTasksCount, 0)}
                </p>
              </div>
              <div className="bg-success-100 p-3 rounded-lg">
                <LayoutDashboard className="w-6 h-6 text-success-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Assigned Children</h3>
              {currentOrg && (
                <Link
                  href={`/b2b/children?orgId=${currentOrg.orgId}`}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center"
                >
                  View all
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              )}
            </div>
          </div>

          <div className="p-6">
            {children.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No children assigned</h3>
                <p className="text-gray-600">Children assigned to your organization will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {children.slice(0, 6).map((child) => (
                  <Link
                    key={child.id}
                    href={`/b2b/children/${child.id}?orgId=${currentOrg?.orgId}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all"
                  >
                    <h4 className="font-semibold text-gray-900 mb-2">{child.name}</h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>Tasks completed: {child.completedTasksCount}</p>
                      {child.speechStepNumber && (
                        <p>Roadmap step: {child.speechStepNumber}</p>
                      )}
                      {child.lastActiveDate && (
                        <p>Last active: {new Date(child.lastActiveDate).toLocaleDateString()}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
