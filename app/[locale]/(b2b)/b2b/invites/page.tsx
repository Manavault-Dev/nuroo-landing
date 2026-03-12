'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile } from '@/lib/b2b/api'
import { Key, Plus, Copy, Check, Loader2 } from 'lucide-react'

interface InviteCode {
  inviteCode: string
  expiresAt: string
  role?: 'specialist' | 'org_admin' | 'admin'
  maxUses?: number | null
  orgId?: string
  type?: 'specialist' | 'parent'
}

export default function InvitesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('b2b.pages.invites')
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [parentInvites, setParentInvites] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [creatingParentInvite, setCreatingParentInvite] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const currentOrgId = searchParams.get('orgId') || profile?.organizations?.[0]?.orgId || undefined
  const currentOrg =
    profile?.organizations?.find((org) => org.orgId === currentOrgId) || profile?.organizations?.[0]
  const isAdmin = currentOrg?.role === 'admin' || currentOrg?.role === 'org_admin'
  const isSpecialist = currentOrg?.role === 'specialist' || isAdmin

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
      } catch {
        router.push('/b2b/login')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  useEffect(() => {
    if (!loading && profile) {
      if (!profile.organizations?.length) {
        router.push('/b2b/onboarding')
        return
      }
      if (!isSpecialist) {
        router.push(
          profile.organizations[0] ? `/b2b?orgId=${profile.organizations[0].orgId}` : '/b2b'
        )
      }
    }
  }, [loading, profile, isSpecialist, router])

  const handleCreateInvite = async (role: 'specialist' | 'org_admin' = 'specialist') => {
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

      setInvites([...invites, { ...newInvite, type: 'specialist' }])
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('failedCreateInvite')
      alert(errorMessage)
    } finally {
      setCreating(false)
    }
  }

  const handleCreateParentInvite = async () => {
    if (!currentOrgId || !isSpecialist) return

    setCreatingParentInvite(true)
    try {
      const idToken = await getIdToken()
      if (!idToken) return
      apiClient.setToken(idToken)

      const newInvite = await apiClient.createParentInvite(currentOrgId)

      setParentInvites([...parentInvites, { ...newInvite, type: 'parent' }])
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('failedCreateParentInvite')
      alert(errorMessage)
    } finally {
      setCreatingParentInvite(false)
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
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!isSpecialist) {
    return null
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
          <p className="text-gray-600 mt-2">{isAdmin ? t('introAdmin') : t('introSpecialist')}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
          {isAdmin && (
            <button
              onClick={() => handleCreateInvite('specialist')}
              disabled={creating || !currentOrgId}
              className="flex w-full items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:w-auto"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('creating')}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>{t('newSpecialistInvite')}</span>
                </>
              )}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => handleCreateInvite('org_admin')}
              disabled={creating || !currentOrgId}
              className="flex w-full items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:w-auto"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('creating')}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>{t('newAdminInvite')}</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={handleCreateParentInvite}
            disabled={creatingParentInvite || !currentOrgId}
            className="flex w-full items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:w-auto"
          >
            {creatingParentInvite ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('creating')}</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>{t('newParentInvite')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl space-y-6">
        {isAdmin && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('specialistInvites')}</h3>
            {invites.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                <Key className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <h4 className="text-md font-medium text-gray-900 mb-2">{t('noSpecialistCodes')}</h4>
                <p className="text-gray-600 mb-4">{t('createSpecialistInvite')}</p>
                <button
                  onClick={() => handleCreateInvite('specialist')}
                  disabled={creating}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {t('createSpecialistInviteBtn')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {invites.map((invite) => (
                  <div
                    key={invite.inviteCode}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6"
                  >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Key className="w-5 h-5 text-primary-600" />
                          <code className="break-all font-mono text-base font-semibold text-gray-900 sm:text-lg">
                            {invite.inviteCode}
                          </code>
                          <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded">
                            {t('specialist')}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600 sm:ml-8">
                          <p>
                            {t('role')}{' '}
                            <span className="font-medium">
                              {invite.role === 'org_admin' || invite.role === 'admin'
                                ? t('administrator')
                                : t('specialist')}
                            </span>
                          </p>
                          <p>
                            {t('expires')}{' '}
                            <span className="font-medium">
                              {new Date(invite.expiresAt).toLocaleDateString()}
                            </span>
                          </p>
                          {invite.maxUses && (
                            <p>
                              {t('maxUses')} <span className="font-medium">{invite.maxUses}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          onClick={() => handleCopy(invite.inviteCode)}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                          title={t('copyCode')}
                        >
                          {copiedCode === invite.inviteCode ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : (
                            <Copy className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="border-t border-gray-200 pt-4 sm:ml-8">
                      <p className="text-xs text-gray-500 mb-2">{t('registrationUrl')}</p>
                      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                        <input
                          type="text"
                          value={getInviteUrl(invite.inviteCode)}
                          readOnly
                          className="w-full min-w-0 flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 font-mono"
                        />
                        <button
                          onClick={() => handleCopy(getInviteUrl(invite.inviteCode))}
                          className="w-full px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors sm:w-auto"
                        >
                          {copiedCode === getInviteUrl(invite.inviteCode)
                            ? t('copied')
                            : t('copyUrl')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('parentInvites')}</h3>
          {parentInvites.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <Key className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <h4 className="text-md font-medium text-gray-900 mb-2">{t('noParentCodes')}</h4>
              <p className="text-gray-600 mb-4">{t('createParentCodes')}</p>
              <button
                onClick={handleCreateParentInvite}
                disabled={creatingParentInvite}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {t('createParentInviteBtn')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {parentInvites.map((invite) => (
                <div
                  key={invite.inviteCode}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6"
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Key className="w-5 h-5 text-green-600" />
                        <code className="break-all font-mono text-base font-semibold text-gray-900 sm:text-lg">
                          {invite.inviteCode}
                        </code>
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                          {t('parent')}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600 sm:ml-8">
                        <p>
                          {t('expires')}{' '}
                          <span className="font-medium">
                            {new Date(invite.expiresAt).toLocaleDateString()}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">{t('shareWithParents')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        onClick={() => handleCopy(invite.inviteCode)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        title={t('copyCode')}
                      >
                        {copiedCode === invite.inviteCode ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-4 sm:ml-8">
                    <p className="text-xs text-gray-500 mb-2">{t('inviteCodeForApp')}</p>
                    <div className="mb-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        value={invite.inviteCode}
                        readOnly
                        className="w-full min-w-0 flex-1 px-3 py-2 text-center text-lg font-semibold border border-gray-300 rounded-lg bg-gray-50 font-mono"
                      />
                      <button
                        onClick={() => handleCopy(invite.inviteCode)}
                        className="w-full px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors sm:w-auto"
                      >
                        {copiedCode === invite.inviteCode ? t('copied') : t('copyCodeBtn')}
                      </button>
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
