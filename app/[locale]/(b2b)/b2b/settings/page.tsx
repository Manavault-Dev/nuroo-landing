'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/b2b/AuthContext'
import { apiClient } from '@/lib/b2b/api'
import { Save, User, Mail, Loader2, Shield } from 'lucide-react'
import { Link } from '@/i18n/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const t = useTranslations('b2b.pages.settings')
  const { profile, isLoading, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.name) setName(profile.name)
  }, [profile?.name])

  useEffect(() => {
    if (!isLoading && !profile) router.push('/b2b/login')
  }, [isLoading, profile, router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      await apiClient.createProfile(name)
      await refreshProfile()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t('updateError'))
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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <p className="text-gray-600 mt-2">{t('subtitle')}</p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                {t('profileUpdated')}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {t('emailAddress')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  value={profile?.email || ''}
                  disabled
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">{t('emailCannotChange')}</p>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                {t('fullName')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder={t('fullNamePlaceholder')}
                />
              </div>
            </div>

            <div className="flex flex-col items-stretch justify-end gap-4 pt-4 border-t border-gray-200 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:w-auto"
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

        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('organizations')}</h3>
          {profile && profile.organizations.length > 0 ? (
            <div className="space-y-3">
              {profile.organizations.map((org) => (
                <div
                  key={org.orgId}
                  className="flex flex-col gap-3 p-4 border border-gray-200 rounded-lg sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{org.orgName}</p>
                    <p className="text-sm text-gray-500">
                      {t('role')}: {org.role === 'admin' ? t('administrator') : t('specialist')}
                    </p>
                  </div>
                  {org.role === 'admin' && (
                    <span className="px-3 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded">
                      {t('administrator')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">{t('notInOrg')}</p>
          )}
        </div>

        {/* Privacy & Legal */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Конфиденциальность</h3>
          <p className="text-sm text-gray-500 mb-4">
            Управление согласиями и просмотр правовых документов
          </p>
          <Link
            href="/b2b/settings/privacy"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Настройки конфиденциальности
          </Link>
        </div>
      </div>
    </div>
  )
}
