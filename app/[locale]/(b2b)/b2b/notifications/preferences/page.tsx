'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, ArrowLeft, Loader2 } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient, type NotificationPreferences } from '@/lib/b2b/api'
import { PageSpinner } from '@/components/ui/Spinner'

const DEFAULT_PREFS: NotificationPreferences = {
  allEnabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  categories: {
    assignments: true,
    messages: true,
    reminders: true,
    progressUpdates: true,
    organizationUpdates: true,
    billingUpdates: true,
  },
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        checked ? 'bg-primary-600' : 'bg-gray-200',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  )
}

export default function NotificationPreferencesPage() {
  const t = useTranslations('b2b.notifications')
  const { isLoading } = usePageAuth()

  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS)
  const [loadingPrefs, setLoadingPrefs] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchPrefs = useCallback(async () => {
    setLoadingPrefs(true)
    try {
      const res = await apiClient.getNotificationPreferences()
      setPrefs(res.preferences ?? DEFAULT_PREFS)
    } catch {
      setPrefs(DEFAULT_PREFS)
    } finally {
      setLoadingPrefs(false)
    }
  }, [])

  useEffect(() => {
    fetchPrefs()
  }, [fetchPrefs])

  const updatePrefs = async (updated: Partial<NotificationPreferences>) => {
    const prev = prefs
    setPrefs((p) => ({ ...p, ...updated }))
    setSaving(true)
    try {
      await apiClient.updateNotificationPreferences(updated)
    } catch {
      setPrefs(prev)
    } finally {
      setSaving(false)
    }
  }

  const updateCategory = async (
    key: keyof NotificationPreferences['categories'],
    value: boolean
  ) => {
    const prev = prefs
    const next: NotificationPreferences = {
      ...prefs,
      categories: { ...prefs.categories, [key]: value },
    }
    setPrefs(next)
    setSaving(true)
    try {
      await apiClient.updateNotificationPreferences({ categories: next.categories })
    } catch {
      setPrefs(prev)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || loadingPrefs) return <PageSpinner />

  const CATEGORIES: { key: keyof NotificationPreferences['categories']; label: string }[] = [
    { key: 'assignments', label: t('categories.assignments') },
    { key: 'messages', label: t('categories.messages') },
    { key: 'reminders', label: t('categories.reminders') },
    { key: 'progressUpdates', label: t('categories.progressUpdates') },
    { key: 'organizationUpdates', label: t('categories.organizationUpdates') },
    { key: 'billingUpdates', label: t('categories.billingUpdates') },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/b2b/notifications"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('title')}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary-600" />
            {t('preferences')}
          </h1>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
      </div>

      <div className="space-y-4">
        {/* Master toggles */}
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{t('allEnabled')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('allEnabledDesc')}</p>
            </div>
            <Toggle checked={prefs.allEnabled} onChange={(v) => updatePrefs({ allEnabled: v })} />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-medium text-gray-900">{t('pushEnabled')}</p>
            <Toggle
              checked={prefs.pushEnabled}
              disabled={!prefs.allEnabled}
              onChange={(v) => updatePrefs({ pushEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-medium text-gray-900">{t('inAppEnabled')}</p>
            <Toggle
              checked={prefs.inAppEnabled}
              disabled={!prefs.allEnabled}
              onChange={(v) => updatePrefs({ inAppEnabled: v })}
            />
          </div>
        </div>

        {/* Category toggles */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t('categoriesLabel')}
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {CATEGORIES.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between px-5 py-4">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <Toggle
                  checked={prefs.categories[key]}
                  disabled={!prefs.allEnabled || !prefs.inAppEnabled}
                  onChange={(v) => updateCategory(key, v)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
