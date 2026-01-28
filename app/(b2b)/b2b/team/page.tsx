'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile } from '@/lib/b2b/api'
import { Users, UserCog, Mail, Crown, Shield } from 'lucide-react'

interface TeamMember {
  uid: string
  email: string
  name: string
  role: 'admin' | 'specialist'
  joinedAt: Date
}

export default function TeamPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  const currentOrgId = searchParams.get('orgId') || undefined
  const currentOrg =
    profile?.organizations.find((org) => org.orgId === currentOrgId) || profile?.organizations[0]
  const isAdmin = currentOrg?.role === 'admin'

  useEffect(() => {
    if (!isAdmin) {
      router.push('/b2b')
      return
    }

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

        if (currentOrgId) {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'}/orgs/${currentOrgId}/team`,
            {
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            }
          )
          if (response.ok) {
            const members = await response.json()
            setTeamMembers(
              members.map((m: any) => ({
                ...m,
                joinedAt: m.joinedAt ? new Date(m.joinedAt) : new Date(),
              }))
            )
          } else {
            const errorData = await response
              .json()
              .catch(() => ({ error: 'Failed to load team members' }))
            console.error('Failed to load team members:', errorData)
          }
        }
      } catch (error) {
        console.error('Error loading team data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, isAdmin, currentOrgId])

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
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
        </div>

        <div className="p-6">
          {teamMembers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No team members yet</h3>
              <p className="text-gray-600">
                Create invite codes to add specialists to your organization.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div
                  key={member.uid}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <UserCog className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900">{member.name}</p>
                        {member.role === 'admin' && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-600">{member.email}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Joined: {member.joinedAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
