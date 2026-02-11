'use client'

import { useEffect, Suspense, useState } from 'react'
import { useRouter, usePathname } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AuthProvider, useAuth } from '@/lib/b2b/AuthContext'
import { Sidebar } from '@/components/b2b/Sidebar'
import { Header } from '@/components/b2b/Header'

// Pages that should render without sidebar/header chrome
const NO_CHROME_PAGES = ['/b2b/login', '/b2b/register', '/b2b/onboarding', '/b2b/join']

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
  const { user, profile, isSuperAdmin, isLoading, currentOrgId: authOrgId } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
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

  // Fade-in overlay after mount
  useEffect(() => {
    if (sidebarOpen && !isClosing) {
      const id = requestAnimationFrame(() => setOverlayVisible(true))
      return () => cancelAnimationFrame(id)
    }
  }, [sidebarOpen, isClosing])

  // Close mobile sidebar when route changes (immediate, no animation)
  useEffect(() => {
    setSidebarOpen(false)
    setIsClosing(false)
    setOverlayVisible(false)
  }, [pathname])

  // Handle redirects based on auth state
  useEffect(() => {
    if (isLoading) return

    // Not logged in - redirect to login (except on no-chrome pages)
    if (!user && !isNoChromePage) {
      router.push('/b2b/login')
      return
    }

    // Logged in on no-chrome pages - send user to correct destination
    if (user && isNoChromePage) {
      if (isSuperAdmin) return router.replace('/b2b/content')
      if (profile?.organizations?.length) return router.replace('/b2b')
      if (pathForMatch !== '/b2b/onboarding') return router.replace('/b2b/onboarding')
      return
    }

    // Super admin on dashboard - redirect to content
    if (user && isSuperAdmin && (pathForMatch === '/b2b' || pathForMatch === '/b2b/')) {
      router.replace('/b2b/content')
    }
  }, [user, profile, isSuperAdmin, isLoading, pathname, pathForMatch, isNoChromePage, router])

  // Loading state
  if (isLoading) {
    return <LoadingSpinner />
  }

  // No-chrome pages don't need sidebar/header
  if (isNoChromePage) {
    return <>{children}</>
  }

  // Not authenticated
  if (!user) {
    return null
  }

  const currentOrgId =
    searchParams.get('orgId') || profile?.organizations?.[0]?.orgId || authOrgId || undefined

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        profile={profile}
        currentOrgId={currentOrgId}
        isMobileOpen={sidebarOpen}
        isClosing={isClosing}
        onMobileClose={closeSidebar}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          profile={profile}
          isSidebarOpen={sidebarOpen}
          onMenuClick={sidebarOpen ? closeSidebar : openSidebar}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      {sidebarOpen && (
        <div
          role="presentation"
          aria-hidden
          className={[
            'fixed inset-0 z-40 lg:hidden bg-black/50 transition-opacity duration-300 ease-out',
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
