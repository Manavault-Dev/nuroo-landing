'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { onAuthChange, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile } from '@/lib/b2b/api'
import { User } from 'firebase/auth'
import { Sidebar } from '@/components/b2b/Sidebar'
import { Header } from '@/components/b2b/Header'

function B2BLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        const idToken = await getIdToken()
        apiClient.setToken(idToken || null)

        try {
          const profileData = await apiClient.getMe()
          setProfile(profileData)
        } catch (error) {
          console.error('Failed to load profile:', error)
          // If /me fails, profile will be null - that's OK for Super Admin
        }
      } else {
        apiClient.setToken(null)
        setProfile(null)
      }

      setLoading(false)

      const isAuthPage =
        pathname === '/b2b/login' || pathname === '/b2b/register' || pathname === '/b2b/join'
      if (!currentUser && !isAuthPage) {
        router.push('/b2b/login')
      }
    })

    return () => unsubscribe()
  }, [router, pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const isAuthPage =
    pathname === '/b2b/login' || pathname === '/b2b/register' || pathname === '/b2b/join'
  if (isAuthPage) {
    return <>{children}</>
  }

  if (!user) {
    return null
  }

  const currentOrgId = searchParams.get('orgId') || undefined

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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <B2BLayoutContent>{children}</B2BLayoutContent>
    </Suspense>
  )
}
