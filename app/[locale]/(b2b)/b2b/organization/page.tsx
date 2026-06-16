'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { useAuth } from '@/lib/b2b/AuthContext'
import { apiClient } from '@/lib/b2b/api'
import { Building2, Users, UserCog, Key, Save, Loader2 } from 'lucide-react'
import { COUNTRIES, ORG_CATEGORIES } from '@/lib/b2b/countries'

export default function OrganizationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, isLoading, currentOrgId: authOrgId, updateProfile } = useAuth()
  const t = useTranslations('b2b.pages.organization')
  const locale = useLocale()

  const [orgName, setOrgName] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const currentOrgId =
    searchParams.get('orgId') || authOrgId || profile?.organizations?.[0]?.orgId || undefined
  const currentOrg =
    profile?.organizations?.find((org) => org.orgId === currentOrgId) || profile?.organizations?.[0]
  const isAdmin = currentOrg?.role === 'admin'

  useEffect(() => {
    if (!isLoading && !getCurrentUser()) router.push('/b2b/login')
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
    setCountry((currentOrg as any).country || '')
    setCity((currentOrg as any).city || '')
    setCategories((currentOrg as any).categories || [])
  }, [currentOrg])

  const toggleCategory = (cat: string) =>
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentOrgId || !currentOrg) return

    const updates: { name?: string; country?: string; city?: string; categories?: string[] } = {}

    const nextName = orgName.trim()
    if (nextName && nextName !== currentOrg.orgName) updates.name = nextName

    const nextCountry = country.trim()
    if (nextCountry !== ((currentOrg as any).country || '')) updates.country = nextCountry

    const nextCity = city.trim()
    if (nextCity !== ((currentOrg as any).city || '')) updates.city = nextCity

    const prevCats: string[] = (currentOrg as any).categories || []
    if (JSON.stringify([...categories].sort()) !== JSON.stringify([...prevCats].sort())) {
      updates.categories = categories
    }

    if (Object.keys(updates).length === 0) return

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
              ? {
                  ...item,
                  orgName: org.name,
                  country: org.country ?? null,
                  city: org.city ?? null,
                  categories: org.categories ?? null,
                }
              : item
          ),
        }
      })

      setOrgName(org.name)
      setCountry(org.country || '')
      setCity(org.city || '')
      setCategories(org.categories || [])
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
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!isAdmin || !currentOrg) return null

  const inputCls =
    'w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500'

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <p className="text-gray-600 mt-2">{t('subtitle')}</p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Org header card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-4">
            <div className="bg-primary-100 p-4 rounded-lg shrink-0">
              <Building2 className="w-8 h-8 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                {currentOrg.orgName}
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                {t('organizationId')} {currentOrg.orgId}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4 shrink-0" />
                <span>
                  {t('yourRole')}{' '}
                  <span className="font-medium text-gray-900">{t('administrator')}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-5">{t('orgInfo')}</h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {t('changesSaved')}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Organization name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('orgName')}
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                minLength={1}
                maxLength={200}
                disabled={saving}
                className={inputCls}
              />
            </div>

            {/* Country + City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('country')}
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={saving}
                  className={inputCls + ' bg-white'}
                >
                  <option value="">{t('countryPlaceholder')}</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {locale === 'ru' ? c.ru : locale === 'ky' ? c.ky : c.en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('city')}
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  maxLength={80}
                  disabled={saving}
                  placeholder={t('cityPlaceholder')}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Services / Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('categories')}
              </label>
              <p className="text-xs text-gray-500 mb-3">{t('categoriesHint')}</p>
              <div className="flex flex-wrap gap-2">
                {ORG_CATEGORIES.map((cat) => {
                  const active = categories.includes(cat.key)
                  const label = locale === 'ru' ? cat.ru : locale === 'ky' ? cat.ky : cat.en
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      disabled={saving}
                      onClick={() => toggleCategory(cat.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:text-primary-600'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('saving')}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{t('saveChanges')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">{t('quickActions')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/b2b/team${currentOrgId ? `?orgId=${currentOrgId}` : ''}`}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <UserCog className="w-5 h-5 text-primary-600 shrink-0" />
              <div>
                <p className="font-medium text-gray-900 text-sm">{t('manageSpecialists')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('viewManageTeam')}</p>
              </div>
            </Link>

            <Link
              href={`/b2b/invites${currentOrgId ? `?orgId=${currentOrgId}` : ''}`}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <Key className="w-5 h-5 text-primary-600 shrink-0" />
              <div>
                <p className="font-medium text-gray-900 text-sm">{t('inviteCodes')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('createManageInvites')}</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
