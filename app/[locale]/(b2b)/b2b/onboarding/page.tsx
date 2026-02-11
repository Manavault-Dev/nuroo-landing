'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { AlertCircle, Building2, Key, Loader2 } from 'lucide-react'

import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import { useAuth } from '@/lib/b2b/AuthContext'

export default function OnboardingPage() {
  const router = useRouter()
  const { isSuperAdmin, isLoading: authLoading } = useAuth()
  const t = useTranslations('b2b.pages.onboarding')

  const [inviteCode, setInviteCode] = useState('')
  const [orgName, setOrgName] = useState('')
  const [orgCountry, setOrgCountry] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (isSuperAdmin) router.replace('/b2b/content')
  }, [authLoading, isSuperAdmin, router])

  const ensureToken = async () => {
    const user = getCurrentUser()
    if (!user) {
      router.push('/b2b/login')
      return null
    }
    const token = await getIdToken()
    if (!token) {
      router.push('/b2b/login')
      return null
    }
    apiClient.setToken(token)
    return token
  }

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const code = inviteCode.trim()
    if (!code) return setError(t('enterInviteCode'))

    setLoading(true)
    try {
      const token = await ensureToken()
      if (!token) return
      await apiClient.acceptInvite(code)
      router.replace('/b2b')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('failedJoin')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrg = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const name = orgName.trim()
    if (!name) return setError(t('orgNameRequired'))

    setLoading(true)
    try {
      const token = await ensureToken()
      if (!token) return
      const res = await apiClient.createMyOrganization(name, orgCountry.trim() || undefined)
      router.replace(`/b2b?orgId=${res.orgId}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('failedCreateOrg')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">{t('welcome')}</h2>
          <p className="mt-2 text-sm text-gray-600">{t('continueHint')}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start max-w-2xl mx-auto">
            <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="flex items-center space-x-3 mb-2">
              <Key className="w-6 h-6 text-primary-600" />
              <h3 className="text-xl font-bold text-gray-900">{t('joinWithInvite')}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">{t('specialistsJoinHint')}</p>

            <form className="space-y-4" onSubmit={handleJoin}>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 uppercase"
                placeholder={t('inviteCodePlaceholder')}
              />
              <button
                type="submit"
                disabled={loading || !inviteCode.trim()}
                className="w-full inline-flex items-center justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t('joinOrganization')}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="flex items-center space-x-3 mb-2">
              <Building2 className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-bold text-gray-900">{t('createOrganization')}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">{t('organizersCreateHint')}</p>

            <form className="space-y-4" onSubmit={handleCreateOrg}>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
                placeholder={t('orgNamePlaceholder')}
              />
              <input
                type="text"
                value={orgCountry}
                onChange={(e) => setOrgCountry(e.target.value)}
                className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
                placeholder={t('countryPlaceholder')}
              />
              <button
                type="submit"
                disabled={loading || !orgName.trim()}
                className="w-full inline-flex items-center justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t('createOrganization')}
              </button>
            </form>
          </div>
        </div>

        <div className="text-center">
          <Link href="/b2b/login" className="text-sm text-gray-500 hover:text-gray-700">
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  )
}
