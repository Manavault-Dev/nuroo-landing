'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile, type ChildSummary } from '@/lib/b2b/api'
import { Users, ArrowRight, TrendingUp, CheckCircle, UserPlus, Mail } from 'lucide-react'
import { InviteModal } from '@/components/b2b/InviteModal'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [currentOrgId, setCurrentOrgId] = useState<string | undefined>(undefined)

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

        const orgId = searchParams.get('orgId') || profileData.organizations[0]?.orgId
        setCurrentOrgId(orgId)
        if (orgId) {
          try {
            const childrenData = await apiClient.getChildren(orgId)
            setChildren(childrenData)
          } catch {
            // Failed to load children - continue with empty list
          }
        } else {
          router.push('/b2b/join')
        }
      } catch {
        router.push('/b2b/login')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, searchParams])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  const orgId = searchParams.get('orgId') || profile?.organizations[0]?.orgId || currentOrgId
  const currentOrg =
    profile?.organizations.find((org) => org.orgId === orgId) || profile?.organizations[0]
  const isAdmin = currentOrg?.role === 'admin'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, {profile?.name || 'Specialist'}!
        </h2>
        <p className="text-gray-600 mt-2">
          {isAdmin
            ? "Manage your organization and track children's progress."
            : "Here's an overview of your assigned children."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Children</p>
              {children.length === 0 ? (
                <p className="text-sm text-gray-500 mt-2">No children yet</p>
              ) : (
                <p className="text-3xl font-bold text-gray-900 mt-2">{children.length}</p>
              )}
            </div>
            <div className="bg-primary-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Active This Week</p>
              {(() => {
                const activeCount = children.filter((child) => {
                  if (!child.lastActiveDate) return false
                  const weekAgo = new Date()
                  weekAgo.setDate(weekAgo.getDate() - 7)
                  return new Date(child.lastActiveDate) > weekAgo
                }).length
                return activeCount === 0 && children.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-2">No activity yet</p>
                ) : (
                  <p className="text-3xl font-bold text-gray-900 mt-2">{activeCount}</p>
                )
              })()}
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Tasks Completed</p>
              {(() => {
                const totalTasks = children.reduce(
                  (sum, child) => sum + child.completedTasksCount,
                  0
                )
                return totalTasks === 0 && children.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-2">No tasks completed yet</p>
                ) : (
                  <p className="text-3xl font-bold text-gray-900 mt-2">{totalTasks}</p>
                )
              })()}
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
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
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Invite parents to connect their child and start tracking progress.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  onClick={async () => {
                    try {
                      const idToken = await getIdToken()
                      if (!idToken) {
                        router.push('/b2b/login')
                        return
                      }
                      apiClient.setToken(idToken)

                      // Get current org ID
                      const currentOrgId = profile?.organizations[0]?.orgId
                      if (!currentOrgId) {
                        alert('Please select an organization first')
                        return
                      }
                      const invite = await apiClient.createParentInvite(currentOrgId)
                      setInviteCode(invite.inviteCode)
                      setInviteModalOpen(true)
                    } catch (error: any) {
                      alert(error.message || 'Failed to create invite code. Please try again.')
                    }
                  }}
                >
                  <Mail className="w-5 h-5" />
                  <span>Invite Parent</span>
                </button>
                {isAdmin && (
                  <button
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      alert(
                        'Manual child addition will be available soon. For now, parents can connect via invite codes.'
                      )
                    }}
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>Add Child</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {children.slice(0, 6).map((child) => (
                <Link
                  key={child.id}
                  href={`/b2b/children/${child.id}?orgId=${currentOrgId}`}
                  className="block p-5 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all bg-white"
                >
                  <h4 className="font-semibold text-gray-900 mb-3">{child.name}</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Tasks completed:</span>
                      <span className="font-medium">{child.completedTasksCount}</span>
                    </div>
                    {child.speechStepNumber && (
                      <div className="flex items-center justify-between">
                        <span>Roadmap step:</span>
                        <span className="font-medium">{child.speechStepNumber}</span>
                      </div>
                    )}
                    {child.lastActiveDate && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500">Last active:</span>
                        <span className="text-xs font-medium text-gray-700">
                          {new Date(child.lastActiveDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {inviteCode && (
        <InviteModal
          isOpen={inviteModalOpen}
          onClose={() => {
            setInviteModalOpen(false)
            setInviteCode(null)
          }}
          inviteCode={inviteCode}
          orgId={orgId}
        />
      )}
    </div>
  )
}
