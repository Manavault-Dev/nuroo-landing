'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile } from '@/lib/b2b/api'
import { Key, Plus, Copy, Check, Loader2, Trash2 } from 'lucide-react'

interface InviteCode {
  inviteCode: string
  expiresAt: string
  role: 'specialist' | 'admin'
  maxUses: number | null
}

export default function InvitesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const currentOrgId = searchParams.get('orgId') || undefined
  const currentOrg = profile?.organizations.find(org => org.orgId === currentOrgId) || profile?.organizations[0]
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
      } catch (error) {
        console.error('Error loading data:', error)
        router.push('/b2b/login')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, isAdmin])

  const handleCreateInvite = async (role: 'specialist' | 'admin' = 'specialist') => {
    if (!currentOrgId || !isAdmin) return

    setCreating(true)
    try {
      const idToken = await getIdToken()
      if (!idToken) return
      apiClient.setToken(idToken)

      const newInvite = await apiClient.createInvite(currentOrgId, {
        role,
        expiresInDays: 30,
      })

      setInvites([...invites, newInvite])
    } catch (error: any) {
      alert(error.message || 'Failed to create invite code')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const getInviteUrl = (code: string) => {
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/b2b/register?invite=${code}`
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

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invite Codes</h2>
          <p className="text-gray-600 mt-2">Generate invite codes to add specialists to your organization.</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => handleCreateInvite('specialist')}
            disabled={creating || !currentOrgId}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>New Invite Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-4xl space-y-4">
        {invites.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No invite codes yet</h3>
            <p className="text-gray-600 mb-6">Create your first invite code to add specialists to your organization.</p>
            <button
              onClick={() => handleCreateInvite('specialist')}
              disabled={creating}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              Create Invite Code
            </button>
          </div>
        ) : (
          invites.map((invite) => (
            <div
              key={invite.inviteCode}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <Key className="w-5 h-5 text-gray-400" />
                    <code className="font-mono text-lg font-semibold text-gray-900">{invite.inviteCode}</code>
                  </div>
                  <div className="ml-8 space-y-1 text-sm text-gray-600">
                    <p>Role: <span className="font-medium">{invite.role === 'admin' ? 'Administrator' : 'Specialist'}</span></p>
                    <p>Expires: <span className="font-medium">{new Date(invite.expiresAt).toLocaleDateString()}</span></p>
                    {invite.maxUses && (
                      <p>Max uses: <span className="font-medium">{invite.maxUses}</span></p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleCopy(invite.inviteCode)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Copy code"
                  >
                    {copiedCode === invite.inviteCode ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="ml-8 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Registration URL:</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={getInviteUrl(invite.inviteCode)}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 font-mono"
                  />
                  <button
                    onClick={() => handleCopy(getInviteUrl(invite.inviteCode))}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {copiedCode === getInviteUrl(invite.inviteCode) ? 'Copied!' : 'Copy URL'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}


