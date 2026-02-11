'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile, type ChildSummary } from '@/lib/b2b/api'
import {
  Users,
  ArrowRight,
  TrendingUp,
  CheckCircle,
  Mail,
  Building2,
  UserCog,
  Key,
} from 'lucide-react'
import { InviteModal } from '@/components/b2b/InviteModal'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('b2b.pages.dashboard')
  const tHeader = useTranslations('b2b.header')
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [teamCount, setTeamCount] = useState<number>(0)
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
            router.push('/b2b/onboarding')
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
            const [childrenData, teamData] = await Promise.all([
              apiClient.getChildren(orgId),
              apiClient.getTeam(orgId).catch(() => []),
            ])
            setChildren(childrenData)
            setTeamCount(Array.isArray(teamData) ? teamData.length : 0)
          } catch {
            // Failed to load - continue with empty
          }
        } else {
          router.push('/b2b/onboarding')
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
      <div className="p-4 sm:p-6 lg:p-8">
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

  // ========== ORG ADMIN DASHBOARD ==========
  if (isAdmin && currentOrg) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            {currentOrg.orgName} — {t('administration')}
          </h2>
          <p className="text-gray-600 mt-2">{t('youCreated')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            href={`/b2b/organization?orgId=${orgId}`}
            className="block bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:border-primary-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{t('organization')}</p>
                <p className="text-lg font-bold text-gray-900 mt-2">{currentOrg.orgName}</p>
                <p className="text-sm text-primary-600 mt-2 font-medium">{t('editSettings')}</p>
              </div>
              <div className="bg-primary-100 p-3 rounded-lg">
                <Building2 className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </Link>

          <Link
            href={`/b2b/team?orgId=${orgId}`}
            className="block bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:border-primary-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{t('specialists')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{teamCount}</p>
                <p className="text-sm text-primary-600 mt-2 font-medium">{t('manageTeam')}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <UserCog className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Link>

          <Link
            href={`/b2b/children?orgId=${orgId}`}
            className="block bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:border-primary-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{t('children')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{children.length}</p>
                <p className="text-sm text-primary-600 mt-2 font-medium">{t('viewAll')}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link
            href={`/b2b/team?orgId=${orgId}`}
            className="flex items-center gap-4 p-6 bg-white rounded-xl border border-gray-100 hover:border-primary-300 hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
              <UserCog className="w-6 h-6 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900">{t('manageSpecialists')}</h3>
              <p className="text-sm text-gray-600 mt-1">{t('addRemoveRoles')}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
          </Link>

          <Link
            href={`/b2b/invites?orgId=${orgId}`}
            className="flex items-center gap-4 p-6 bg-white rounded-xl border border-gray-100 hover:border-primary-300 hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Key className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900">{t('inviteCodes')}</h3>
              <p className="text-sm text-gray-600 mt-1">{t('createInvites')}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{t('childrenInOrg')}</h3>
              <Link
                href={`/b2b/children?orgId=${orgId}`}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center"
              >
                {t('viewAll')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>
          <div className="p-6">
            {children.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">{t('noChildrenYet')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {children.slice(0, 6).map((child) => (
                  <Link
                    key={child.id}
                    href={`/b2b/children/${child.id}?orgId=${orgId}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all"
                  >
                    <h4 className="font-semibold text-gray-900">{child.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {child.completedTasksCount} {t('tasksCompleted')}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ========== SPECIALIST DASHBOARD ==========
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          {t('welcomeBack', { name: profile?.name || tHeader('specialist') })}
        </h2>
        <p className="text-gray-600 mt-2">{t('overviewAssigned')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{t('totalChildren')}</p>
              {children.length === 0 ? (
                <p className="text-sm text-gray-500 mt-2">{t('noChildrenYetShort')}</p>
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
              <p className="text-sm font-medium text-gray-600">{t('activeThisWeek')}</p>
              {(() => {
                const activeCount = children.filter((child) => {
                  if (!child.lastActiveDate) return false
                  const weekAgo = new Date()
                  weekAgo.setDate(weekAgo.getDate() - 7)
                  return new Date(child.lastActiveDate) > weekAgo
                }).length
                return activeCount === 0 && children.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-2">{t('noActivityYet')}</p>
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
              <p className="text-sm font-medium text-gray-600">{t('totalTasksCompleted')}</p>
              {(() => {
                const totalTasks = children.reduce(
                  (sum, child) => sum + child.completedTasksCount,
                  0
                )
                return totalTasks === 0 && children.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-2">{t('noTasksYet')}</p>
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
            <h3 className="text-lg font-semibold text-gray-900">{t('assignedChildren')}</h3>
            {currentOrg && (
              <Link
                href={`/b2b/children?orgId=${currentOrg.orgId}`}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center"
              >
                {t('viewAll')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            )}
          </div>
        </div>

        <div className="p-6">
          {children.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noChildrenAssigned')}</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">{t('inviteParentsConnect')}</p>
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
                    const invite = await apiClient.createParentInvite(orgId!)
                    setInviteCode(invite.inviteCode)
                    setInviteModalOpen(true)
                  } catch (error: unknown) {
                    alert(error instanceof Error ? error.message : 'Failed to create invite code.')
                  }
                }}
              >
                <Mail className="w-5 h-5" />
                <span>{t('inviteParent')}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {children.slice(0, 6).map((child) => (
                <Link
                  key={child.id}
                  href={`/b2b/children/${child.id}?orgId=${orgId}`}
                  className="block p-5 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all bg-white"
                >
                  <h4 className="font-semibold text-gray-900 mb-3">{child.name}</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>{t('tasksCompleted')}:</span>
                      <span className="font-medium">{child.completedTasksCount}</span>
                    </div>
                    {child.speechStepNumber && (
                      <div className="flex items-center justify-between">
                        <span>{t('roadmapStep')}</span>
                        <span className="font-medium">{child.speechStepNumber}</span>
                      </div>
                    )}
                    {child.lastActiveDate && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500">{t('lastActive')}</span>
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

      {inviteCode && orgId && (
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
