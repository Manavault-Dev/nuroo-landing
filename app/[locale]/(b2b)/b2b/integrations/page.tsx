'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { CheckCircle2, AlertCircle, Loader2, ExternalLink, Unlink } from 'lucide-react'
import { apiClient } from '@/lib/b2b/api'

interface CalendarStatus {
  connected: boolean
  googleEmail?: string
  connectedAt?: string
}

type Notice = { type: 'success' | 'error'; text: string }

export default function IntegrationsPage() {
  const t = useTranslations('b2b.pages.integrations')
  const locale = useLocale()

  const [status, setStatus] = useState<CalendarStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const error = params.get('error')

    if (success === '1') setNotice({ type: 'success', text: t('google.successConnected') })
    else if (error === 'access_denied')
      setNotice({ type: 'error', text: t('google.errorCancelled') })
    else if (error) setNotice({ type: 'error', text: t('google.errorConnect') })

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
      window.location.href = res.url
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message ?? t('google.errorGetLink') })
      setConnecting(false)
    }
  }

  async function disconnect() {
    if (!confirm(t('google.confirmDisconnect'))) return
    setDisconnecting(true)
    try {
      await apiClient.disconnectCalendar()
      setStatus({ connected: false })
      setNotice({ type: 'success', text: t('google.successDisconnected') })
    } catch {
      setNotice({ type: 'error', text: t('google.errorDisconnect') })
    } finally {
      setDisconnecting(false)
    }
  }

  const comingSoonItems = [
    { name: 'WhatsApp Business', descKey: 'whatsappDesc' as const },
    { name: 'Telegram', descKey: 'telegramDesc' as const },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <p className="text-gray-500 mt-1 text-sm">{t('subtitle')}</p>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl mb-6 text-sm ${
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

      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          {t('google.sectionLabel')}
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-11 h-11 rounded-xl overflow-hidden shadow-sm border border-gray-100 flex items-center justify-center bg-white">
                    <Image
                      src="/google-calendar.svg"
                      alt="Google Calendar"
                      width={32}
                      height={32}
                      unoptimized
                    />
                  </div>
                  <div className="w-1 h-1 rounded-full bg-gray-200" />
                  <div className="w-11 h-11 rounded-xl overflow-hidden shadow-sm border border-gray-100 flex items-center justify-center bg-white">
                    <Image
                      src="/google-meet.svg"
                      alt="Google Meet"
                      width={32}
                      height={32}
                      unoptimized
                    />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-base leading-tight">
                    {t('google.cardTitle')}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t('google.cardSubtitle')}</p>
                </div>
              </div>

              {!loading && (
                <div
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    status?.connected
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${status?.connected ? 'bg-emerald-500' : 'bg-gray-400'}`}
                  />
                  {status?.connected ? t('google.statusConnected') : t('google.statusDisconnected')}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {(
                [
                  {
                    img: '/google-calendar.svg',
                    alt: 'Google Calendar',
                    titleKey: 'calendarFeatureTitle',
                    descKey: 'calendarFeatureDesc',
                  },
                  {
                    img: '/google-meet.svg',
                    alt: 'Google Meet',
                    titleKey: 'meetFeatureTitle',
                    descKey: 'meetFeatureDesc',
                  },
                ] as const
              ).map((item) => (
                <div key={item.alt} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3.5">
                  <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-white border border-gray-100 shadow-sm">
                    <Image src={item.img} alt={item.alt} width={20} height={20} unoptimized />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">
                      {t(`google.${item.titleKey}`)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {t(`google.${item.descKey}`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('google.checkingStatus')}
              </div>
            ) : status?.connected ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  {status.googleEmail && (
                    <p className="text-sm text-gray-700">
                      <span className="text-gray-400 text-xs">{t('google.accountLabel')}: </span>
                      {status.googleEmail}
                    </p>
                  )}
                  {status.connectedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t('google.connectedSince')}{' '}
                      {new Date(status.connectedAt).toLocaleDateString(
                        locale === 'ky' ? 'ru-RU' : `${locale}-${locale.toUpperCase()}`,
                        {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        }
                      )}
                    </p>
                  )}
                </div>
                <button
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-2 text-sm text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {disconnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4" />
                  )}
                  {t('google.disconnectButton')}
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={connecting}
                className="inline-flex items-center gap-2 text-sm bg-primary-600 text-white rounded-xl px-5 py-2.5 font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                {connecting ? t('google.redirecting') : t('google.connectButton')}
              </button>
            )}
          </div>

          <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              {t('google.howItWorksTitle')}
            </p>
            <ol className="space-y-1.5 text-xs text-gray-500">
              {(['step1', 'step2', 'step3'] as const).map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="font-bold text-primary-600 shrink-0">{i + 1}.</span>
                  {t(`google.${step}`)}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          {t('comingSoon')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {comingSoonItems.map((item) => (
            <div
              key={item.name}
              className="bg-white rounded-2xl border border-dashed border-gray-200 p-5 opacity-60"
            >
              <p className="font-semibold text-gray-700 text-sm mb-1">{item.name}</p>
              <p className="text-xs text-gray-400">{t(item.descKey)}</p>
              <span className="inline-block mt-3 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {t('inDevelopment')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
