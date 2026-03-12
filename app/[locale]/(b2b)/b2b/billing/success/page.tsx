'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import { CheckCircle, Loader2, ArrowLeft } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { usePageAuth } from '@/lib/b2b/usePageAuth'

export default function PaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('b2b.pages.billing')
  const { orgId, isAdmin, isLoading } = usePageAuth()
  const [verifying, setVerifying] = useState(true)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')

  const paymentId = searchParams.get('paymentId')

  useEffect(() => {
    const verifyPayment = async () => {
      if (isLoading) return
      if (!isAdmin) {
        router.replace(orgId ? `/b2b?orgId=${orgId}` : '/b2b')
        return
      }
      if (!paymentId) {
        setError(t('paymentFailedMessage'))
        setVerifying(false)
        return
      }

      const user = getCurrentUser()
      if (!user) {
        router.push('/b2b/login')
        return
      }

      try {
        const idToken = await getIdToken()
        if (!idToken) {
          router.push('/b2b/login')
          return
        }
        apiClient.setToken(idToken)

        const result = await apiClient.verifyPayment(paymentId)

        if (result.ok && result.payment.status === 'completed') {
          setVerified(true)
        } else {
          setError(t('paymentFailedMessage'))
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('paymentFailedMessage'))
      } finally {
        setVerifying(false)
      }
    }

    verifyPayment()
  }, [isAdmin, isLoading, orgId, paymentId, router, t])

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('verifyPayment')}</p>
        </div>
      </div>
    )
  }

  const billingHref = orgId ? `/b2b/billing?orgId=${orgId}` : '/b2b/billing'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        {verified ? (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('paymentSuccess')}</h1>
            <p className="text-gray-600 mb-6">{t('paymentSuccessMessage')}</p>
            <Link
              href={billingHref}
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              {t('backToBilling')}
            </Link>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✕</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('paymentFailed')}</h1>
            <p className="text-gray-600 mb-6">{error || t('paymentFailedMessage')}</p>
            <Link
              href={billingHref}
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              {t('backToBilling')}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
