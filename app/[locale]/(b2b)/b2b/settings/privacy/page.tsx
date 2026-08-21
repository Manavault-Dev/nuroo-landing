'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/b2b/api'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { Shield, FileText, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react'

type ConsentStatus = {
  consentType: string
  isAccepted: boolean
  needsReacceptance: boolean
  documentVersion: string | null
  currentVersion: string
  acceptedAt: string | null
  withdrawnAt: string | null
}

const CONSENT_LABELS: Record<
  string,
  { title: string; description: string; path?: string; required?: boolean }
> = {
  PUBLIC_OFFER: {
    title: 'Публичная оферта',
    description: 'Основной договор на использование сервиса Nuroo',
    path: '/legal/terms',
    required: true,
  },
  PRIVACY_POLICY: {
    title: 'Политика конфиденциальности',
    description: 'Условия обработки ваших персональных данных',
    path: '/legal/privacy',
    required: true,
  },
  LEGAL_REPRESENTATIVE: {
    title: 'Согласие законного представителя',
    description: 'Согласие на обработку данных ребёнка, включая специальные категории',
    path: '/legal/parental-consent',
  },
  MARKETING_COMMUNICATIONS: {
    title: 'Маркетинговые рассылки',
    description:
      'Новости, предложения и информация об обновлениях Nuroo по email, SMS и push-уведомлениям',
  },
  ANONYMIZED_ANALYTICS: {
    title: 'Аналитика и исследования',
    description: 'Использование обезличенных данных для улучшения качества сервиса',
  },
  SPECIALIST_CHILD_PROFILE_ACCESS: {
    title: 'Доступ специалиста к профилю ребёнка',
    description:
      'Предоставление доступа привлечённому специалисту к профилю ребёнка через Приложение',
  },
  MEDIA_MARKETING_USAGE: {
    title: 'Использование медиаматериалов',
    description:
      'Использование загруженных вами фото, видео и аудиоматериалов в демонстрационных и маркетинговых целях',
  },
}

const OPTIONAL_TYPES = [
  'MARKETING_COMMUNICATIONS',
  'ANONYMIZED_ANALYTICS',
  'SPECIALIST_CHILD_PROFILE_ACCESS',
  'MEDIA_MARKETING_USAGE',
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function PrivacySettingsPage() {
  usePageAuth()
  const [consents, setConsents] = useState<ConsentStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState<string | null>(null)
  const [withdrawWarning, setWithdrawWarning] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient
      .getUserConsents()
      .then((res) => setConsents(res.consents))
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false))
  }, [])

  const handleWithdraw = async (type: string) => {
    setWithdrawWarning(null)
    setWithdrawing(type)
    try {
      await apiClient.withdrawConsent(type)
      setConsents((prev) =>
        prev.map((c) =>
          c.consentType === type
            ? { ...c, isAccepted: false, withdrawnAt: new Date().toISOString() }
            : c
        )
      )
    } catch {
      setError('Не удалось отозвать согласие. Попробуйте позже.')
    } finally {
      setWithdrawing(null)
    }
  }

  const required = consents.filter((c) => !OPTIONAL_TYPES.includes(c.consentType))
  const optional = consents.filter((c) => OPTIONAL_TYPES.includes(c.consentType))

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-500">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        Загрузка...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary-50 p-2.5 rounded-xl">
          <Shield className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Конфиденциальность</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Управление согласиями и правовыми документами
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Required consents — read-only */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Обязательные условия
        </h2>
        <div className="space-y-3">
          {required.map((c) => {
            const meta = CONSENT_LABELS[c.consentType]
            if (!meta) return null
            return (
              <div
                key={c.consentType}
                className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {c.isAccepted ? (
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <span className="font-medium text-gray-900 text-sm">{meta.title}</span>
                      {meta.path && (
                        <a
                          href={meta.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-500 hover:text-primary-600"
                          aria-label={`Открыть документ ${meta.title}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{meta.description}</p>
                    {c.isAccepted && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        Принято {formatDate(c.acceptedAt)} · Версия {c.documentVersion}
                      </p>
                    )}
                    {!c.isAccepted && (
                      <p className="text-xs text-red-500 mt-1.5">
                        Не принято — требуется для использования сервиса
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-400 italic">
                  Обязательное условие. Может быть отозвано только через удаление аккаунта.
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Optional consents */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Дополнительные согласия
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Не влияют на доступ к основному функционалу. Можно отозвать в любой момент.
        </p>
        <div className="space-y-3">
          {optional.map((c) => {
            const meta = CONSENT_LABELS[c.consentType]
            if (!meta) return null
            const isWithdrawing = withdrawing === c.consentType
            return (
              <div
                key={c.consentType}
                className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {c.isAccepted ? (
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-300 shrink-0" />
                      )}
                      <span className="font-medium text-gray-900 text-sm">{meta.title}</span>
                    </div>
                    <p className="text-xs text-gray-500">{meta.description}</p>
                    {c.isAccepted && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        Принято {formatDate(c.acceptedAt)} · Версия {c.documentVersion}
                      </p>
                    )}
                    {c.withdrawnAt && !c.isAccepted && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        Отозвано {formatDate(c.withdrawnAt)}
                      </p>
                    )}
                  </div>
                  {c.isAccepted && (
                    <button
                      onClick={() => setWithdrawWarning(c.consentType)}
                      disabled={isWithdrawing}
                      className="shrink-0 text-xs text-red-500 hover:text-red-600 font-medium disabled:opacity-50 transition-colors"
                    >
                      {isWithdrawing ? 'Отзываем...' : 'Отозвать'}
                    </button>
                  )}
                </div>

                {/* Withdraw confirmation */}
                {withdrawWarning === c.consentType && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-xs text-red-700 mb-2">
                      Вы уверены, что хотите отозвать согласие «{meta.title}»?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleWithdraw(c.consentType)}
                        className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                      >
                        Да, отозвать
                      </button>
                      <button
                        onClick={() => setWithdrawWarning(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Legal documents links */}
      <section className="mt-10 pt-8 border-t border-gray-100">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Правовые документы
        </h2>
        <div className="space-y-2">
          {[
            { href: '/legal/terms', label: 'Публичная оферта' },
            { href: '/legal/privacy', label: 'Политика конфиденциальности' },
            { href: '/legal/parental-consent', label: 'Согласие законного представителя' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
            >
              <FileText className="w-4 h-4 shrink-0" />
              {label}
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          ))}
        </div>
      </section>

      {/* Account deletion note */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1">Удаление аккаунта</p>
        <p>
          Для полного удаления аккаунта и всех связанных данных напишите на{' '}
          <a href="mailto:support@usenuroo.com" className="text-primary-600 hover:underline">
            support@usenuroo.com
          </a>
          . Данные будут удалены в течение 30 дней, за исключением информации, хранение которой
          обязательно по закону.
        </p>
      </div>
    </div>
  )
}
