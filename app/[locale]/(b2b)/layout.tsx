'use client'

import { useEffect, Suspense, useState, useRef } from 'react'
import { useRouter, usePathname } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
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

  // Validate orgId URL param belongs to the current user's orgs (prevent stale URL cross-org leak)
  const rawOrgIdParam = searchParams.get('orgId')
  const currentOrgId =
    (rawOrgIdParam && profile?.organizations?.some((o) => o.orgId === rawOrgIdParam)
      ? rawOrgIdParam
      : null) ||
    profile?.organizations?.[0]?.orgId ||
    authOrgId ||
    undefined

  // Clear stale billing data immediately on logout
  useEffect(() => {
    if (!user) {
      setBillingData(null)
      billingFetchedForOrg.current = null
    }
  }, [user])

  // Clear stale billing data when switching orgs (prevents showing org A data for org B)
  useEffect(() => {
    setBillingData(null)
    // billingFetchedForOrg.current is reset so the fetch below re-runs for the new org
    billingFetchedForOrg.current = null
  }, [currentOrgId])

  // Fetch billing status once per org (not on every navigation)
  useEffect(() => {
    if (!currentOrgId || !user || isLoading) return
    if (billingFetchedForOrg.current === currentOrgId) return
    billingFetchedForOrg.current = currentOrgId
    apiClient
      .getBillingStatus(currentOrgId)
      .then(setBillingData)
      .catch(() => {
        // Network failure — treat as no data, do not block access
      })
  }, [currentOrgId, user, isLoading])

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

  // Привязываем каждую ошибку к конкретному пользователю
  useEffect(() => {
    if (user && profile) {
      Sentry.setUser({
        id: user.uid,
        email: user.email ?? undefined,
        username: profile.name,
      })
      Sentry.setTag('orgId', currentOrgId ?? 'unknown')
      Sentry.setTag('role', profile.organizations?.[0]?.role ?? 'unknown')
    } else if (!user) {
      Sentry.setUser(null)
    }
  }, [user, profile, currentOrgId])

  if (isLoading) {
    return <LoadingSpinner />
  }
  if (isNoChromePage) {
    return <>{children}</>
  }
  if (!user) {
    return null
  }

  // Extract planId from billing data — normalize later in PlanProvider
  const rawPlanId = billingData?.planId ?? billingData?.billing?.plan ?? null

  return (
    <PlanProvider rawPlanId={rawPlanId} isLoading={!billingData && !!currentOrgId}>
      <BrandingProvider orgId={currentOrgId}>
        <AlertProvider>
          <div className="b2b-app-bg min-h-screen bg-gray-50 flex">
            <Sidebar
              profile={profile}
              currentOrgId={currentOrgId}
              isMobileOpen={sidebarOpen}
              isClosing={isClosing}
              onMobileClose={closeSidebar}
            />
            <div className="flex-1 flex flex-col min-w-0 relative isolate md:ml-[17rem]">
              <Header
                profile={profile}
                isSidebarOpen={sidebarOpen}
                onMenuClick={sidebarOpen ? closeSidebar : openSidebar}
              />
              {subscriptionState.bannerType !== 'none' && !isPaywallBypassed && (
                <SubscriptionBanner
                  bannerType={subscriptionState.bannerType}
                  message={subscriptionState.message}
                  ctaLabel={subscriptionState.ctaLabel}
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
                message={subscriptionState.message}
                ctaLabel={subscriptionState.ctaLabel}
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
