'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { AuthProvider, useAuth } from '@/lib/b2b/AuthContext'
import { Sidebar } from '@/components/b2b/Sidebar'
import { Header } from '@/components/b2b/Header'

// Pages that should render without sidebar/header chrome
const NO_CHROME_PAGES = ['/b2b/login', '/b2b/register', '/b2b/onboarding', '/b2b/join']

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

function B2BLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, profile, isSuperAdmin, isLoading, currentOrgId: authOrgId } = useAuth()

  const isNoChromePage = NO_CHROME_PAGES.includes(pathname)

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
      if (pathname !== '/b2b/onboarding') return router.replace('/b2b/onboarding')
      return
    }

    // Super admin on dashboard - redirect to content
    if (user && isSuperAdmin && pathname === '/b2b') {
      router.replace('/b2b/content')
    }
  }, [user, profile, isSuperAdmin, isLoading, pathname, isNoChromePage, router])

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
      <Sidebar profile={profile} currentOrgId={currentOrgId} />
      <div className="flex-1 flex flex-col">
        <Header profile={profile} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
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
