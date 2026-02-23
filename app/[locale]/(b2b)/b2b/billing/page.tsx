'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile } from '@/lib/b2b/api'
import { Check, Loader2, CreditCard, Building2 } from 'lucide-react'

interface Plan {
  id: string
  name: string
  price: number
  currency: string
  limits?: { children: number; specialists: number | null } | null
}

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('b2b.pages.billing')
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingPayment, setCreatingPayment] = useState<string | null>(null)
  const [error, setError] = useState('')
  const plansFetchedRef = useRef(false)

  const currentOrgId = searchParams.get('orgId') || profile?.organizations?.[0]?.orgId || undefined
  const currentOrg =
    profile?.organizations?.find((org) => org.orgId === currentOrgId) || profile?.organizations?.[0]
  const isAdmin = currentOrg?.role === 'admin'

  useEffect(() => {
    const loadData = async () => {
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

        const profileData = await apiClient.getMe()
        setProfile(profileData)

        if (!plansFetchedRef.current) {
          plansFetchedRef.current = true
          try {
            const plansData = await apiClient.getPlans()
            if (plansData.ok && plansData.plans && plansData.plans.length > 0) {
              setPlans(plansData.plans)
            } else {
              setError('No subscription plans available. Please contact support.')
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            setError(
              msg === 'Failed to fetch'
                ? 'Cannot reach the server. Check that the backend is running and NEXT_PUBLIC_API_URL is correct.'
                : `Failed to load subscription plans: ${msg}`
            )
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load billing data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  useEffect(() => {
    if (!loading && profile) {
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
  }, [loading, profile, isAdmin, router])

  const handleSubscribe = async (planId: 'starter' | 'growth') => {
    if (!currentOrgId) {
      setError('Organization ID is missing')
      return
    }

    setCreatingPayment(planId)
    setError('')

    try {
      const idToken = await getIdToken()
      if (!idToken) {
        router.push('/b2b/login')
        return
      }
      apiClient.setToken(idToken)

      const result = await apiClient.createPayment(currentOrgId, planId)

      if (result.paymentUrl) {
        window.location.href = result.paymentUrl
      } else {
        setError('Payment URL not received')
        setCreatingPayment(null)
      }
    } catch (error: any) {
      console.error('Error creating payment:', error)
      setError(error.message || 'Failed to create payment')
      setCreatingPayment(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Failed to load profile. Please refresh the page.
        </div>
      </div>
    )
  }

  if (!profile.organizations?.length) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          You need to be part of an organization to manage billing. Please join or create an
          organization first.
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          Only organization administrators can manage billing. Please contact your organization
          admin.
        </div>
      </div>
    )
  }

  if (!currentOrg) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Organization not found. Please select an organization.
        </div>
      </div>
    )
  }

  const planFeatures: Record<string, string[]> = {
    starter: [
      'Up to 30 children',
      'Up to 3 specialists',
      'Groups and assignments',
      'Parents get tasks in app',
      'Photo/video from parents',
      'Basic dashboard',
      'Email support',
    ],
    growth: [
      'Up to 80 children',
      'Unlimited specialists',
      'Extended reports',
      'Materials attached to tasks',
      'Priority support',
      'Org branding',
    ],
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <p className="text-gray-600 mt-2">{t('subtitle')}</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="mb-6 p-4 rounded-xl bg-primary-50 border border-primary-100 text-primary-800 text-sm">
        {t('paymentInfo')}
      </div>

      <div className="max-w-6xl">
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start space-x-4">
            <div className="bg-primary-100 p-4 rounded-lg">
              <Building2 className="w-8 h-8 text-primary-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{currentOrg.orgName}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('currentPlan')}: <span className="font-medium">{t('noPlan')}</span>
              </p>
            </div>
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
            No subscription plans available. Please contact support.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((plan) => {
              const planId = plan.id as 'starter' | 'growth'
              const features = planFeatures[planId] ?? []
              const isCurrent = false

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-xl shadow-sm border-2 p-6 flex flex-col ${
                    isCurrent ? 'border-primary-500' : 'border-gray-100'
                  }`}
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <div className="flex items-baseline">
                      <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-gray-600 ml-2">{plan.currency}</span>
                      <span className="text-gray-500 ml-1 text-sm">{t('perMonth')}</span>
                    </div>
                  </div>

                  <ul className="flex-1 space-y-3 mb-6">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <Check className="w-5 h-5 text-primary-600 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(planId)}
                    disabled={creatingPayment === planId || isCurrent}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      isCurrent
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : creatingPayment === planId
                          ? 'bg-primary-400 text-white cursor-wait'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    {creatingPayment === planId ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        {t('creatingPayment')}
                      </span>
                    ) : isCurrent ? (
                      t('current')
                    ) : (
                      t('subscribe')
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
