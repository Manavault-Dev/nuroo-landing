'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile } from '@/lib/b2b/api'
import { Users, UserCog, Mail, Crown, Shield, UserPlus, Trash2, Loader2 } from 'lucide-react'

interface TeamMember {
  uid: string
  email: string
  name: string
  role: 'admin' | 'specialist'
  joinedAt: Date | string
}

export default function TeamPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [removingUid, setRemovingUid] = useState<string | null>(null)
  const [updatingUid, setUpdatingUid] = useState<string | null>(null)

  const currentOrgId = searchParams.get('orgId') || profile?.organizations?.[0]?.orgId || undefined
  const currentOrg =
    profile?.organizations?.find((org) => org.orgId === currentOrgId) || profile?.organizations?.[0]
  const isAdmin = currentOrg?.role === 'admin'
  const currentUid = profile?.uid || getCurrentUser()?.uid

  const loadData = useCallback(async () => {
    const user = getCurrentUser()
    if (!user) return

    const idToken = await getIdToken()
    if (!idToken) return
    apiClient.setToken(idToken)

    const profileData = await apiClient.getMe()
    setProfile(profileData)

    const orgId = searchParams.get('orgId') || profileData.organizations?.[0]?.orgId
    if (orgId) {
      try {
        const members = await apiClient.getTeam(orgId)
        setTeamMembers(
          members.map((m) => ({
            ...m,
            joinedAt: typeof m.joinedAt === 'string' ? new Date(m.joinedAt) : (m.joinedAt as Date),
          }))
        )
      } catch {
        setTeamMembers([])
      }
    } else {
      setTeamMembers([])
    }
  }, [searchParams])

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
        await loadData()
      } catch {
        router.push('/b2b/login')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router, loadData])

  useEffect(() => {
    if (!loading && !isAdmin && profile) {
      router.push('/b2b')
    }
  }, [loading, isAdmin, profile, router])

  const handleRemove = async (uid: string) => {
    if (!currentOrgId || !confirm(`Remove this member from the organization?`)) return
    setRemovingUid(uid)
    try {
      await apiClient.removeMember(currentOrgId, uid)
      setTeamMembers((prev) => prev.filter((m) => m.uid !== uid))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemovingUid(null)
    }
  }

  const handleChangeRole = async (uid: string, newRole: 'org_admin' | 'specialist') => {
    if (!currentOrgId) return
    setUpdatingUid(uid)
    try {
      await apiClient.updateMemberRole(currentOrgId, uid, newRole)
      setTeamMembers((prev) =>
        prev.map((m) =>
          m.uid === uid ? { ...m, role: newRole === 'org_admin' ? 'admin' : 'specialist' } : m
        )
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setUpdatingUid(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  const admins = teamMembers.filter((m) => m.role === 'admin')
  const specialists = teamMembers.filter((m) => m.role === 'specialist')

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Team Management</h2>
        <p className="text-gray-600 mt-2">Manage members of your organization.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Members</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{teamMembers.length}</p>
            </div>
            <div className="bg-primary-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Administrators</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{admins.length}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Crown className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Specialists</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{specialists.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
          <Link
            href={`/b2b/invites${currentOrgId ? `?orgId=${currentOrgId}` : ''}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            Invite Specialist
          </Link>
        </div>

        <div className="p-6">
          {teamMembers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No team members yet</h3>
              <p className="text-gray-600 mb-6">
                Create invite codes to add specialists and admins to your organization.
              </p>
              <Link
                href={`/b2b/invites${currentOrgId ? `?orgId=${currentOrgId}` : ''}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                <UserPlus className="w-4 h-4" />
                Invite Specialist
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => {
                const joinedDate =
                  member.joinedAt instanceof Date
                    ? member.joinedAt.toLocaleDateString()
                    : new Date(member.joinedAt as string).toLocaleDateString()
                const isCurrentUser = member.uid === currentUid
                return (
                  <div
                    key={member.uid}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors gap-4"
                  >
                    <div className="flex items-center space-x-4 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                        <UserCog className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900">{member.name}</p>
                          {member.role === 'admin' && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                              Admin
                            </span>
                          )}
                          {member.role === 'specialist' && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                              Specialist
                            </span>
                          )}
                          {isCurrentUser && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                          <p className="text-sm text-gray-600 truncate">{member.email}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Joined: {joinedDate}</p>
                      </div>
                    </div>
                    {!isCurrentUser && (
                      <div className="flex items-center gap-2 shrink-0">
                        {member.role === 'specialist' ? (
                          <button
                            onClick={() => handleChangeRole(member.uid, 'org_admin')}
                            disabled={!!updatingUid}
                            className="px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-lg disabled:opacity-50 flex items-center gap-1"
                          >
                            {updatingUid === member.uid ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Crown className="w-3 h-3" />
                            )}
                            Make Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => handleChangeRole(member.uid, 'specialist')}
                            disabled={!!updatingUid}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg disabled:opacity-50 flex items-center gap-1"
                          >
                            {updatingUid === member.uid ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Shield className="w-3 h-3" />
                            )}
                            Make Specialist
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(member.uid)}
                          disabled={!!removingUid}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                          title="Remove from organization"
                        >
                          {removingUid === member.uid ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
