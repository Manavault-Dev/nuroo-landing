'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { Link, useRouter } from '@/i18n/navigation'
import { usePageAuth } from '@/lib/b2b/usePageAuth'

export default function PaymentCancelPage() {
  const t = useTranslations('b2b.pages.billing')
  const router = useRouter()
  const { orgId, isAdmin, isLoading } = usePageAuth()

  useEffect(() => {
    if (isLoading) return
    if (!isAdmin) {
      router.replace(orgId ? `/b2b?orgId=${orgId}` : '/b2b')
    }
  }, [isAdmin, isLoading, orgId, router])

  if (isLoading || !isAdmin) {
    return null
  }

  const billingHref = orgId ? `/b2b/billing?orgId=${orgId}` : '/b2b/billing'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('paymentCancelled')}</h1>
        <p className="text-gray-600 mb-6">{t('paymentCancelledMessage')}</p>
        <Link
          href={billingHref}
          className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {t('backToBilling')}
        </Link>
      </div>
    </div>
  )
}
