'use client'

import { useCallback, useEffect, Suspense, useState, useRef } from 'react'
import { useRouter, usePathname } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AuthProvider, useAuth } from '@/lib/b2b/AuthContext'
import { resolvePostLoginPath } from '@/src/config/routes'
import { BrandingProvider } from '@/lib/b2b/brandingContext'
import { AlertProvider } from '@/components/ui/AlertDialog'
import { Sidebar } from '@/components/b2b/Sidebar'
import { Header } from '@/components/b2b/Header'
import { SubscriptionBanner } from '@/components/ui/SubscriptionBanner'
import { SubscriptionPaywall } from '@/components/ui/SubscriptionPaywall'
import { getSubscriptionState } from '@/lib/b2b/subscriptionState'
import { apiClient, type BillingStatusResponse } from '@/lib/b2b/api'
import { PlanProvider } from '@/lib/b2b/planContext'
import { runWhenIdle, shouldLoadClientSentry } from '@/lib/sentryClient'

const NO_CHROME_PAGES = ['/b2b/login', '/b2b/register', '/b2b/onboarding', '/b2b/join']

/**
 * Pages that must remain accessible even when the subscription is expired/suspended.
 * Check is a prefix match so /b2b/billing/success etc. are also allowed.
 */
const PAYWALL_BYPASS_PATHS = [
  '/b2b/billing',
  '/b2b/settings',
  '/b2b/organization',
  '/b2b/login',
  '/b2b/register',
  '/b2b/onboarding',
  '/b2b/join',
]

function LoadingSpinner() {
  const t = useTranslations('b2b.common')
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">{t('loading')}</p>
      </div>
    </div>
  )
}

function B2BLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tBilling = useTranslations('b2b.pages.billing')
  const { user, profile, isLoading, currentOrgId: authOrgId } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)

  // ── Subscription state ───────────────────────────────────────────────────
  const [billingData, setBillingData] = useState<BillingStatusResponse | null>(null)
  const billingFetchedForOrg = useRef<string | null>(null)
  const pathForMatch = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || pathname
  const isNoChromePage = NO_CHROME_PAGES.some(
    (p) => pathForMatch === p || pathForMatch.startsWith(p + '/')
  )

  const openSidebar = () => {
    setSidebarOpen(true)
    setIsClosing(false)
  }

  const closeSidebar = () => {
    if (!sidebarOpen) return
    setIsClosing(true)
    setTimeout(() => {
      setSidebarOpen(false)
      setIsClosing(false)
      setOverlayVisible(false)
    }, 300)
  }

  useEffect(() => {
    if (sidebarOpen && !isClosing) {
      const id = requestAnimationFrame(() => setOverlayVisible(true))
      return () => cancelAnimationFrame(id)
    }
  }, [sidebarOpen, isClosing])

  useEffect(() => {
    setSidebarOpen(false)
    setIsClosing(false)
    setOverlayVisible(false)
  }, [pathname])

  const requestedOrgId = searchParams.get('orgId')
  const requestedOrg = profile?.organizations.find((org) => org.orgId === requestedOrgId)
  const authOrg = profile?.organizations.find((org) => org.orgId === authOrgId)
  const currentOrgId = requestedOrg?.orgId || authOrg?.orgId || profile?.organizations?.[0]?.orgId
  const currentOrgRole =
    requestedOrg?.role || authOrg?.role || profile?.organizations?.[0]?.role || null
  const canManageBilling = currentOrgRole === 'admin'
  const refreshBillingStatus = useCallback(async (orgId: string) => {
    try {
      const nextBillingData = await apiClient.getBillingStatus(orgId)
      setBillingData(nextBillingData)
    } catch {
      // Network failure — treat as no data, do not block access
    }
  }, [])

  // Fetch billing status once per org (not on every navigation)
  useEffect(() => {
    if (!currentOrgId || !user || isLoading) return
    if (billingFetchedForOrg.current === currentOrgId) return
    billingFetchedForOrg.current = currentOrgId
    void refreshBillingStatus(currentOrgId)
  }, [currentOrgId, user, isLoading, refreshBillingStatus])

  useEffect(() => {
    if (!currentOrgId || !user || isLoading) return

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshBillingStatus(currentOrgId)
      }
    }

    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [currentOrgId, user, isLoading, refreshBillingStatus])

  // Derive plan id: trial users get enterprise-level access (no restrictions)
  const isTrial =
    billingData?.source === 'free_trial' ||
    billingData?.billingStatus === 'trialing' ||
    billingData?.trial?.active === true
  const rawPlanId = isTrial ? 'enterprise' : (billingData?.planId ?? billingData?.plan ?? null)
  const planIsLoading =
    !currentOrgId || (!billingData && billingFetchedForOrg.current !== currentOrgId)

  // Derive subscription state from billing API response
  const subscriptionState = getSubscriptionState(
    (billingData?.billing?.status ?? billingData?.billingStatus ?? null) as Parameters<
      typeof getSubscriptionState
    >[0],
    billingData?.billing?.trialEndsAt ??
      billingData?.billing?.currentPeriodEnd ??
      billingData?.expiresAt ??
      null,
    billingData?.active ?? true // optimistic: allow while loading
  )

  const pathForPaywall = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || pathname
  const isPaywallBypassed = PAYWALL_BYPASS_PATHS.some(
    (p) => pathForPaywall === p || pathForPaywall.startsWith(p + '/')
  )
  const isBillingPage =
    pathForPaywall === '/b2b/billing' || pathForPaywall.startsWith('/b2b/billing/')
  const showSubscriptionBanner =
    subscriptionState.bannerType !== 'none' && isBillingPage && canManageBilling
  const localizedSubscriptionMessage = (() => {
    const days = subscriptionState.daysRemaining ?? 0

    if (subscriptionState.status === 'suspended') return tBilling('bannerSuspended')
    if (subscriptionState.status === 'past_due') return tBilling('bannerPastDue')
    if (subscriptionState.status === 'trial_expiring') {
      return tBilling('bannerTrialExpiring', { days })
    }
    if (subscriptionState.status === 'trial') {
      return subscriptionState.daysRemaining === null
        ? tBilling('bannerTrialActive')
        : tBilling('bannerTrialActiveWithDays', { days })
    }
    if (subscriptionState.status === 'expired') {
      return subscriptionState.isTrial
        ? tBilling('bannerTrialExpired')
        : tBilling('bannerSubscriptionExpired')
    }
    if (subscriptionState.status === 'unknown') return tBilling('bannerNoActiveSubscription')

    return subscriptionState.message
  })()
  const localizedSubscriptionCta =
    subscriptionState.ctaLabel === 'Contact Support'
      ? tBilling('ctaContactSupport')
      : subscriptionState.ctaLabel === 'Update Billing'
        ? tBilling('ctaUpdateBilling')
        : subscriptionState.ctaLabel === 'Manage Billing'
          ? tBilling('ctaManageBilling')
          : tBilling('ctaChoosePlan')
  const showPaywall =
    subscriptionState.blockType !== 'none' && !isPaywallBypassed && !isNoChromePage && !!user

  useEffect(() => {
    if (isLoading) return
    if (!user && !isNoChromePage) {
      const qs = searchParams.toString()
      const returnPath = qs ? `${pathname}?${qs}` : pathname
      router.push(`/b2b/login?redirect=${encodeURIComponent(returnPath)}`)
      return
    }
    if (user && isNoChromePage) {
      const destination = resolvePostLoginPath(profile, searchParams.get('redirect'))
      const destPath = destination.split('?')[0]
      if (pathForMatch !== destPath) {
        router.replace(destination)
      }
    }
  }, [user, profile, isLoading, pathname, pathForMatch, isNoChromePage, searchParams, router])

  useEffect(() => {
    if (!user || !profile?.organizations?.length || !requestedOrgId) return
    if (profile.organizations.some((org) => org.orgId === requestedOrgId)) return

    const params = new URLSearchParams(searchParams.toString())
    params.set('orgId', currentOrgId ?? profile.organizations[0].orgId)
    const query = params.toString()
    router.replace(query ? `${pathForMatch}?${query}` : pathForMatch)
  }, [currentOrgId, pathForMatch, profile, requestedOrgId, router, searchParams, user])

  // Привязываем каждую ошибку к конкретному пользователю
  useEffect(() => {
    if (!shouldLoadClientSentry()) return

    let cancelled = false

    const cancelIdle = runWhenIdle(() => {
      void import('@sentry/nextjs').then((Sentry) => {
        if (cancelled) return

        if (user && profile) {
          Sentry.setUser({
            id: user.uid,
            email: user.email ?? undefined,
            username: profile.name,
          })
          Sentry.setTag('orgId', currentOrgId ?? 'unknown')
          Sentry.setTag('role', currentOrgRole ?? 'unknown')
        } else if (!user) {
          Sentry.setUser(null)
        }
      })
    })

    return () => {
      cancelled = true
      cancelIdle()
    }
  }, [user, profile, currentOrgId, currentOrgRole])

  if (isLoading) {
    return <LoadingSpinner />
  }
  if (isNoChromePage) {
    return <>{children}</>
  }
  if (!user) {
    return null
  }

  return (
    <PlanProvider rawPlanId={rawPlanId} isLoading={planIsLoading}>
      <BrandingProvider orgId={currentOrgId}>
        <AlertProvider>
          <div className="b2b-app-bg min-h-screen bg-gray-50 flex overflow-x-hidden">
            <Sidebar
              profile={profile}
              currentOrgId={currentOrgId}
              isMobileOpen={sidebarOpen}
              isClosing={isClosing}
              onMobileClose={closeSidebar}
            />
            <div className="flex-1 flex flex-col min-w-0 relative isolate pt-14 md:ml-[17rem] md:pt-0">
              <Header
                profile={profile}
                isSidebarOpen={sidebarOpen}
                onMenuClick={sidebarOpen ? closeSidebar : openSidebar}
              />
              {showSubscriptionBanner && (
                <SubscriptionBanner
                  bannerType={subscriptionState.bannerType}
                  message={localizedSubscriptionMessage}
                  ctaLabel={localizedSubscriptionCta}
                  orgId={currentOrgId}
                  daysRemaining={subscriptionState.daysRemaining}
                />
              )}
              <main
                className="flex-1 overflow-auto relative z-0 min-h-0"
                style={{ touchAction: 'pan-y' }}
              >
                {children}
              </main>
            </div>
            {showPaywall && (
              <SubscriptionPaywall
                blockType={subscriptionState.blockType as 'expired' | 'suspended'}
                message={localizedSubscriptionMessage}
                ctaLabel={localizedSubscriptionCta}
                orgId={currentOrgId}
              />
            )}
            {sidebarOpen && (
              <div
                role="presentation"
                aria-hidden
                className={[
                  'fixed inset-0 z-40 md:hidden bg-black/50 transition-opacity duration-300 ease-out',
                  isClosing
                    ? 'opacity-0 pointer-events-none'
                    : overlayVisible
                      ? 'opacity-100'
                      : 'opacity-0',
                ].join(' ')}
                onClick={closeSidebar}
              />
            )}
          </div>
        </AlertProvider>
      </BrandingProvider>
    </PlanProvider>
  )
}

export default function B2BLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingSpinner />}>
        <B2BLayoutContent>{children}</B2BLayoutContent>
      </Suspense>
    </AuthProvider>
  )
}
