'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { useAuth } from '@/lib/b2b/AuthContext'
import { apiClient } from '@/lib/b2b/api'
import { Building2, Users, UserCog, Key, Save, Loader2 } from 'lucide-react'

export default function OrganizationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, isLoading, currentOrgId: authOrgId, updateProfile } = useAuth()
  const t = useTranslations('b2b.pages.organization')
  const [orgName, setOrgName] = useState('')
  const [country, setCountry] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const currentOrgId =
    searchParams.get('orgId') || authOrgId || profile?.organizations?.[0]?.orgId || undefined
  const currentOrg =
    profile?.organizations?.find((org) => org.orgId === currentOrgId) || profile?.organizations?.[0]
  const isAdmin = currentOrg?.role === 'admin'

  useEffect(() => {
    if (!isLoading && !getCurrentUser()) {
      router.push('/b2b/login')
    }
  }, [isLoading, router])

  useEffect(() => {
    if (!isLoading && profile) {
      if (!profile.organizations?.length) {
        router.push('/b2b/onboarding')
        return
      }
      if (!isAdmin) {
        router.push(
          profile.organizations[0] ? `/b2b?orgId=${profile.organizations[0].orgId}` : '/b2b'
        )
      }
    }
  }, [isLoading, profile, isAdmin, router])

  useEffect(() => {
    if (!currentOrg) return

    setOrgName(currentOrg.orgName)
    setCountry(currentOrg.country || '')
  }, [currentOrg])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!currentOrgId || !currentOrg) return

    const nextName = orgName.trim()
    const nextCountry = country.trim()
    const updates: { name?: string; country?: string } = {}

    if (nextName && nextName !== currentOrg.orgName) {
      updates.name = nextName
    }

    if (nextCountry !== (currentOrg.country || '')) {
      updates.country = nextCountry
    }

    if (!updates.name && updates.country === undefined) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const idToken = await getIdToken()
      if (!idToken) {
        router.push('/b2b/login')
        return
      }

      apiClient.setToken(idToken)
      const { org } = await apiClient.updateOrganization(currentOrgId, updates)

      updateProfile((prev) => {
        if (!prev) return prev

        return {
          ...prev,
          organizations: prev.organizations.map((item) =>
            item.orgId === org.id
              ? { ...item, orgName: org.name, country: org.country ?? null }
              : item
          ),
        }
      })
      setOrgName(org.name)
      setCountry(org.country || '')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('updateError'))
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!isAdmin || !currentOrg) {
    return null
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <p className="text-gray-600 mt-2">{t('subtitle')}</p>
      </div>

      <div className="max-w-4xl space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start space-x-4">
            <div className="bg-primary-100 p-4 rounded-lg">
              <Building2 className="w-8 h-8 text-primary-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{currentOrg.orgName}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('organizationId')} {currentOrg.orgId}
              </p>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>
                    {t('yourRole')}{' '}
                    <span className="font-medium text-gray-900">{t('administrator')}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('orgInfo')}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                {t('changesSaved')}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('orgName')}</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                minLength={1}
                maxLength={200}
                disabled={saving}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('country')}</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                maxLength={100}
                disabled={saving}
                placeholder={t('countryPlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t('saving')}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>{t('saveChanges')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('quickActions')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/b2b/team${currentOrgId ? `?orgId=${currentOrgId}` : ''}`}
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <UserCog className="w-5 h-5 text-primary-600" />
              <div>
                <p className="font-medium text-gray-900">{t('manageSpecialists')}</p>
                <p className="text-sm text-gray-600">{t('viewManageTeam')}</p>
              </div>
            </Link>

            <Link
              href={`/b2b/invites${currentOrgId ? `?orgId=${currentOrgId}` : ''}`}
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <Key className="w-5 h-5 text-primary-600" />
              <div>
                <p className="font-medium text-gray-900">{t('inviteCodes')}</p>
                <p className="text-sm text-gray-600">{t('createManageInvites')}</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
