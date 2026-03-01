'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile } from '@/lib/b2b/api'
import { Loader2, Building2, Star } from 'lucide-react'
import { PricingCard } from '@/components/ui/PricingCard'
import { PLAN_FEATURE_KEYS } from '@/lib/pricing/planFeatureKeys'

interface Plan {
  id: string
  name: string
  price: number
  currency: string
  limits?: { children: number; specialists: number | null } | null
}

interface BillingStatus {
  active: boolean
  planId: string | null
  expiresAt: string | null
}

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('b2b.pages.billing')
  const tPricing = useTranslations('landing.pricing')
  const locale = useLocale()
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingPayment, setCreatingPayment] = useState<string | null>(null)
  const [error, setError] = useState('')
  const plansFetchedRef = useRef(false)

  const currentOrgId = searchParams.get('orgId') || profile?.organizations?.[0]?.orgId || undefined
  const currentOrg =
    profile?.organizations?.find((org) => org.orgId === currentOrgId) || profile?.organizations?.[0]
  const isAdmin = currentOrg?.role === 'admin'

  const numberLocale =
    locale === 'en' ? 'en-US' : locale === 'ru' ? 'ru-RU' : locale === 'ky' ? 'ky-KG' : 'en-US'
  const formatPrice = (n: number) => n.toLocaleString(numberLocale)

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
    if (!currentOrgId) return
    let cancelled = false
    const loadStatus = async () => {
      try {
        const statusRes = await apiClient.getBillingStatus(currentOrgId)
        if (cancelled) return
        if (statusRes?.ok !== false) {
          setBillingStatus({
            active: statusRes?.active ?? false,
            planId: statusRes?.planId ?? null,
            expiresAt: statusRes?.expiresAt ?? null,
          })
        }
      } catch {
        // optional
      }
    }
    loadStatus()
    return () => {
      cancelled = true
    }
  }, [currentOrgId])

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

  const handleSubscribe = async (planId: 'starter' | 'growth' | 'enterprise') => {
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
    } catch (error: unknown) {
      console.error('Error creating payment:', error)
      setError(error instanceof Error ? error.message : 'Failed to create payment')
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

  const planLabel = (planId: string | null) => {
    if (planId === 'starter') return t('starterPlan')
    if (planId === 'growth') return t('growthPlan')
    if (planId === 'enterprise') return t('enterprisePlan')
    return planId || ''
  }

  const statusLabel = () => {
    if (!billingStatus?.active || !billingStatus.planId) return t('noPlan')
    const exp = billingStatus.expiresAt ? new Date(billingStatus.expiresAt) : null
    if (exp && exp.getTime() < Date.now())
      return `${planLabel(billingStatus.planId)} — ${t('planExpired')}`
    if (exp)
      return `${planLabel(billingStatus.planId)} — ${t('planActive')} (${t('planExpires')} ${exp.toLocaleDateString(numberLocale)})`
    return `${planLabel(billingStatus.planId)} — ${t('planActive')}`
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
        {/* Current plan status */}
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start space-x-4">
            <div className="bg-primary-100 p-4 rounded-lg">
              <Building2 className="w-8 h-8 text-primary-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{currentOrg.orgName}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('currentPlan')}: <span className="font-medium">{statusLabel()}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Plans grid — same PricingCard as on landing for consistent UI */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const planId = plan.id as 'starter' | 'growth' | 'enterprise'
            const featureKeys = PLAN_FEATURE_KEYS[planId as keyof typeof PLAN_FEATURE_KEYS] ?? []
            const isCurrent = billingStatus?.active === true && billingStatus?.planId === plan.id
            const isEnterprise = plan.id === 'enterprise'

            return (
              <PricingCard
                key={plan.id}
                variant={isEnterprise ? 'enterprise' : 'default'}
                badge={
                  isCurrent ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5" />
                      {t('current')}
                    </span>
                  ) : undefined
                }
                title={plan.name}
                price={formatPrice(plan.price)}
                priceSuffix={`${plan.currency} ${t('perMonth')}`}
                features={featureKeys.map((key) => ({
                  text: tPricing(key as Parameters<typeof tPricing>[0]),
                }))}
              >
                <button
                  onClick={() => handleSubscribe(planId)}
                  disabled={creatingPayment === planId || isCurrent}
                  className={`w-full py-3.5 px-4 rounded-xl font-medium transition-colors ${
                    isCurrent
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                      : creatingPayment === planId
                        ? 'bg-primary-400 text-white cursor-wait'
                        : isEnterprise
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {creatingPayment === planId ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('creatingPayment')}
                    </span>
                  ) : isCurrent ? (
                    t('current')
                  ) : (
                    t('subscribe')
                  )}
                </button>
              </PricingCard>
            )
          })}
        </div>
      </div>
    </div>
  )
}
