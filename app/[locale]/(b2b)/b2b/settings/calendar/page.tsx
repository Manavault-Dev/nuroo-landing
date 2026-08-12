'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { apiClient } from '@/lib/b2b/api'
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Unlink,
  Video,
} from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'

interface CalendarStatus {
  connected: boolean
  googleEmail?: string
  connectedAt?: string
}

export default function CalendarSettingsPage() {
  const t = useTranslations('b2b.pages.settings.calendar')
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<CalendarStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount
  useEffect(() => {
    // Handle redirect back from Google OAuth
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success === '1') {
      setNotice({ type: 'success', text: t('successConnected') })
    } else if (error === 'access_denied') {
      setNotice({ type: 'error', text: t('errorCancelled') })
    } else if (error) {
      setNotice({ type: 'error', text: t('errorConnect') })
    }
    loadStatus()
  }, [])

  async function loadStatus() {
    setLoading(true)
    try {
      const res = await apiClient.getCalendarStatus()
      setStatus({
        connected: res.connected,
        googleEmail: res.googleEmail,
        connectedAt: res.connectedAt,
      })
    } catch {
      setStatus({ connected: false })
    } finally {
      setLoading(false)
    }
  }

  async function connect() {
    setConnecting(true)
    try {
      const res = await apiClient.getCalendarConnectUrl()
      // Redirect to Google OAuth consent page
      window.location.href = res.url
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message ?? t('errorGetLink') })
      setConnecting(false)
    }
  }

  async function disconnect() {
    if (!confirm(t('confirmDisconnect'))) return
    setDisconnecting(true)
    try {
      await apiClient.disconnectCalendar()
      setStatus({ connected: false })
      setNotice({ type: 'success', text: t('disconnected') })
    } catch {
      setNotice({ type: 'error', text: t('errorDisconnect') })
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link
        href="/b2b/settings"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('backToSettings')}
      </Link>

      <h1 className="text-xl font-bold text-gray-900 mb-1">{t('pageTitle')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('pageDescription')}</p>

      {/* Notice */}
      {notice && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl mb-5 text-sm ${
            notice.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          {notice.text}
        </div>
      )}

      {/* Status card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        {loading ? (
          <div className="flex items-center gap-3 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">{t('checkingStatus')}</span>
          </div>
        ) : status?.connected ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{t('connected')}</p>
                {status.googleEmail && (
                  <p className="text-xs text-gray-500">{status.googleEmail}</p>
                )}
                {status.connectedAt && (
                  <p className="text-xs text-gray-400">
                    {t('connectedSince')}{' '}
                    {new Date(status.connectedAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-emerald-50 rounded-xl p-3 mb-4 text-xs text-emerald-700 flex items-start gap-2">
              <Video className="w-4 h-4 shrink-0 mt-0.5" />
              {t('meetHint')}
            </div>

            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="flex items-center gap-2 text-sm text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {disconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unlink className="w-4 h-4" />
              )}
              {t('disconnect')}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{t('notConnected')}</p>
                <p className="text-xs text-gray-400">{t('notConnectedHint')}</p>
              </div>
            </div>

            <button
              onClick={connect}
              disabled={connecting}
              className="flex items-center gap-2 text-sm bg-primary-600 text-white rounded-xl px-4 py-2.5 font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              {connecting ? t('redirecting') : t('connectGoogleCalendar')}
            </button>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="mt-6 bg-gray-50 rounded-2xl p-5">
        <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          {t('howItWorks')}
        </p>
        <ol className="space-y-2 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="font-bold text-primary-600 shrink-0">1.</span>
            {t('step1')}
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary-600 shrink-0">2.</span>
            {t('step2')}
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary-600 shrink-0">3.</span>
            {t('step3')}
          </li>
        </ol>
      </div>
    </div>
  )
}
