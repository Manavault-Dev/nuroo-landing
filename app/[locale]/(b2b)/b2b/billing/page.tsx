'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile } from '@/lib/b2b/api'
import { Loader2, Building2, Star, TrendingUp, Users, ArrowRight } from 'lucide-react'
import { BillingBadge, type BillingBadgeKey } from '@/components/ui/BillingBadge'
import { PricingCard } from '@/components/ui/PricingCard'
import { PLAN_FEATURE_KEYS } from '@/lib/pricing/planFeatureKeys'

interface BillingStatus {
  active: boolean
  planId: string | null
  source: 'subscription' | 'free_trial' | null
  billingStatus: 'trialing' | 'active' | 'past_due' | 'expired' | 'cancelled' | null
  badge: string | null
  expiresAt: string | null
  usage: {
    children: number
    specialists: number
    childrenLimit: number | null
    specialistsLimit: number | null
  } | null
  features: Record<string, boolean> | null
  error?: string
  trial: {
    active: boolean
    planId: string | null
    startedAt: string | null
    expiresAt: string | null
  } | null
}

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('b2b.pages.billing')
  const tPricing = useTranslations('landing.pricing')
  const locale = useLocale()
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null)
  const [billingStatusLoading, setBillingStatusLoading] = useState(true)
  const [billingStatusOrgId, setBillingStatusOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingPayment, setCreatingPayment] = useState<string | null>(null)
  const [error, setError] = useState('')

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
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('loadError'))
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, t])

  useEffect(() => {
    if (!currentOrgId) {
      setBillingStatus(null)
      setBillingStatusOrgId(null)
      setBillingStatusLoading(false)
      return
    }
    let cancelled = false
    setBillingStatus(null)
    setBillingStatusOrgId(null)
    setBillingStatusLoading(true)
    const loadStatus = async () => {
      try {
        const statusRes = await apiClient.getBillingStatus(currentOrgId)
        if (cancelled) return
        if (statusRes?.ok !== false) {
          setBillingStatus({
            active: statusRes?.active ?? false,
            planId: statusRes?.planId ?? null,
            source: statusRes?.source ?? null,
            billingStatus: statusRes?.billingStatus ?? null,
            badge: statusRes?.badge ?? null,
            expiresAt: statusRes?.expiresAt ?? null,
            usage: statusRes?.usage ?? null,
            features: statusRes?.features ?? null,
            trial: statusRes?.trial ?? null,
          })
        }
      } catch {
        // optional
      } finally {
        if (!cancelled) {
          setBillingStatusOrgId(currentOrgId)
          setBillingStatusLoading(false)
        }
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

  const handleSubscribe = async (
    planId: 'starter' | 'growth' | 'enterprise',
    displayId?: string
  ) => {
    void displayId // display-only label, backend still receives planId
    if (!currentOrgId) {
      setError(t('missingOrgId'))
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
        setError(t('paymentUrlMissing'))
        setCreatingPayment(null)
      }
    } catch (error: unknown) {
      console.error('Error creating payment:', error)
      setError(error instanceof Error ? error.message : t('createPaymentError'))
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
          {t('profileLoadError')}
        </div>
      </div>
    )
  }

  if (!profile.organizations?.length) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          {t('organizationRequired')}
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          {t('adminRequired')}
        </div>
      </div>
    )
  }

  if (!currentOrg) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {t('organizationNotFound')}
        </div>
      </div>
    )
  }

  const planLabel = (planId: string | null) => {
    if (planId === 'starter') return t('starterPlan')
    if (planId === 'growth' || planId === 'professional') return t('growthPlan')
    if (planId === 'enterprise') return t('enterprisePlan')
    return planId || ''
  }

  const statusLabel = () => {
    if (billingStatusLoading || (currentOrgId && billingStatusOrgId !== currentOrgId)) {
      return t('loadingStatus')
    }

    if (billingStatus?.source === 'free_trial') {
      const exp = billingStatus.expiresAt ? new Date(billingStatus.expiresAt) : null
      if (!billingStatus.active) return t('trialExpired')
      if (exp)
        return `${t('freeTrial')} - ${t('trialActive')} (${t('trialExpires')} ${exp.toLocaleDateString(numberLocale)})`
      return `${t('freeTrial')} - ${t('trialActive')}`
    }

    if (!billingStatus?.active || !billingStatus.planId) return t('noPlan')
    const exp = billingStatus.expiresAt ? new Date(billingStatus.expiresAt) : null
    if (exp && exp.getTime() < Date.now())
      return `${planLabel(billingStatus.planId)} — ${t('planExpired')}`
    if (exp)
      return `${planLabel(billingStatus.planId)} — ${t('planActive')} (${t('planExpires')} ${exp.toLocaleDateString(numberLocale)})`
    return `${planLabel(billingStatus.planId)} — ${t('planActive')}`
  }

  const billingPlans: Array<{
    id: 'starter' | 'growth' | 'enterprise'
    name: string
    price: number
    currency: string
  }> = [
    { id: 'starter', name: tPricing('starterName'), price: 4900, currency: 'KGS' },
    { id: 'growth', name: tPricing('professionalName'), price: 9900, currency: 'KGS' },
    { id: 'enterprise', name: tPricing('enterpriseName'), price: 19900, currency: 'KGS' },
  ]

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
        {/* Current plan status card */}
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start space-x-4 flex-1 min-w-0">
              <div className="bg-primary-100 p-3 rounded-lg shrink-0">
                <Building2 className="w-7 h-7 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {currentOrg.orgName}
                  </h3>
                  {billingStatus?.badge && !billingStatusLoading && (
                    <BillingBadge
                      badge={billingStatus.badge as BillingBadgeKey}
                      trialEndsAt={billingStatus.trial?.expiresAt}
                    />
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {t('currentPlan')}:{' '}
                  <span className="font-medium text-gray-800">{statusLabel()}</span>
                </p>

                {/* Expired / payment required alert */}
                {billingStatus && !billingStatus.active && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {billingStatus.error ?? t('subscriptionRequired')}
                    <span className="font-semibold"> {t('upgradeToUnlock')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Usage meters */}
          {billingStatus?.usage && !billingStatusLoading && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Children */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <TrendingUp className="w-4 h-4 text-primary-500" />
                    {t('usageChildren')}
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {billingStatus.usage.children}
                    {billingStatus.usage.childrenLimit !== null
                      ? ` / ${billingStatus.usage.childrenLimit}`
                      : ' / ∞'}
                  </span>
                </div>
                {billingStatus.usage.childrenLimit !== null && (
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        billingStatus.usage.children >= billingStatus.usage.childrenLimit
                          ? 'bg-red-500'
                          : billingStatus.usage.children >= billingStatus.usage.childrenLimit * 0.8
                            ? 'bg-amber-400'
                            : 'bg-primary-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (billingStatus.usage.children / billingStatus.usage.childrenLimit) * 100)}%`,
                      }}
                    />
                  </div>
                )}
                {billingStatus.usage.childrenLimit !== null &&
                  billingStatus.usage.children >= billingStatus.usage.childrenLimit && (
                    <p className="mt-1.5 text-xs text-red-600 font-medium">{t('limitReached')}</p>
                  )}
              </div>

              {/* Specialists */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Users className="w-4 h-4 text-primary-500" />
                    {t('usageSpecialists')}
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {billingStatus.usage.specialists}
                    {billingStatus.usage.specialistsLimit !== null
                      ? ` / ${billingStatus.usage.specialistsLimit}`
                      : ' / ∞'}
                  </span>
                </div>
                {billingStatus.usage.specialistsLimit !== null && (
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        billingStatus.usage.specialists >= billingStatus.usage.specialistsLimit
                          ? 'bg-red-500'
                          : billingStatus.usage.specialists >=
                              billingStatus.usage.specialistsLimit * 0.8
                            ? 'bg-amber-400'
                            : 'bg-primary-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (billingStatus.usage.specialists / billingStatus.usage.specialistsLimit) * 100)}%`,
                      }}
                    />
                  </div>
                )}
                {billingStatus.usage.specialistsLimit !== null &&
                  billingStatus.usage.specialists >= billingStatus.usage.specialistsLimit && (
                    <p className="mt-1.5 text-xs text-red-600 font-medium">{t('limitReached')}</p>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Plans grid — same PricingCard as on landing for consistent UI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
          {billingPlans.map((plan) => {
            const featureKey = plan.id === 'growth' ? 'professional' : plan.id
            const featureKeys =
              PLAN_FEATURE_KEYS[featureKey as keyof typeof PLAN_FEATURE_KEYS] ?? []
            const isCurrent =
              billingStatus?.active === true &&
              billingStatus?.planId === plan.id &&
              (billingStatus.source === 'subscription' || billingStatus.source === null)
            const isPopular = plan.id === 'growth'
            const isEnterprise = plan.id === 'enterprise'

            return (
              <PricingCard
                key={plan.id}
                variant={isEnterprise ? 'enterprise' : isPopular ? 'popular' : 'default'}
                badge={
                  isCurrent ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5" />
                      {t('current')}
                    </span>
                  ) : isPopular && !isCurrent ? (
                    <span>{tPricing('popular')}</span>
                  ) : undefined
                }
                title={plan.name}
                price={formatPrice(plan.price)}
                priceSuffix={`${plan.currency} ${t('perMonth')}`}
                soonLabel={tPricing('soon')}
                features={featureKeys.map((key) => ({
                  text: tPricing(key as Parameters<typeof tPricing>[0]),
                }))}
              >
                {isEnterprise ? (
                  <a
                    href="mailto:tilek.dzenisev@gmail.com"
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                  >
                    {t('contactUs')}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={creatingPayment === plan.id || isCurrent}
                    className={`w-full py-3.5 px-4 rounded-xl font-medium transition-colors ${
                      isCurrent
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : creatingPayment === plan.id
                          ? 'bg-primary-400 text-white cursor-wait'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    {creatingPayment === plan.id ? (
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
                )}
              </PricingCard>
            )
          })}
        </div>
      </div>
    </div>
  )
}
