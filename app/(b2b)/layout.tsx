'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { onAuthChange, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import { User } from 'firebase/auth'

export default function B2BLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (currentUser) => {
      setUser(currentUser)
      
      if (currentUser) {
        const idToken = await getIdToken()
        apiClient.setToken(idToken || null)
      } else {
        apiClient.setToken(null)
      }
      
      setLoading(false)

      const isAuthPage = pathname === '/b2b/login' || pathname === '/b2b/register'
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

  const isAuthPage = pathname === '/b2b/login' || pathname === '/b2b/register'
  if (isAuthPage) {
    return <>{children}</>
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
