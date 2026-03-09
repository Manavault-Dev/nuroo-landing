'use client'

import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@/i18n/navigation'

export default function PaymentCancelPage() {
  const t = useTranslations('b2b.pages.billing')

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('paymentCancelled')}</h1>
        <p className="text-gray-600 mb-6">{t('paymentCancelledMessage')}</p>
        <Link
          href="/b2b/billing"
          className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {t('backToBilling')}
        </Link>
      </div>
    </div>
  )
}
