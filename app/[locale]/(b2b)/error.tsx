'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { captureClientException } from '@/lib/sentryClient'

const COPY = {
  en: {
    title: 'Something went wrong',
    description: 'We have been notified and are already tracking this issue.',
    retry: 'Try again',
  },
  ru: {
    title: 'Что-то пошло не так',
    description: 'Мы уже получили отчёт об ошибке и отслеживаем проблему.',
    retry: 'Повторить',
  },
  ky: {
    title: 'Бир жерден ката кетти',
    description: 'Ката тууралуу отчёт бизге жөнөтүлдү, көйгөйдү көзөмөлдөп жатабыз.',
    retry: 'Кайра аракет кылуу',
  },
} as const

type Locale = keyof typeof COPY

export default function B2BError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const currentLocale = useLocale()
  const locale = (currentLocale in COPY ? currentLocale : 'en') as Locale
  const copy = COPY[locale]

  useEffect(() => {
    captureClientException(error, {
      tags: {
        surface: 'b2b-error-boundary',
        locale,
      },
      extra: {
        digest: error.digest,
      },
    })
  }, [error, locale])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">{copy.description}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          <RefreshCw className="h-4 w-4" />
          {copy.retry}
        </button>
      </div>
    </div>
  )
}
