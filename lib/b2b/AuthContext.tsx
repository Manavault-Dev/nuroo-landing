'use client'

import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useRef } from 'react'
import { onIdTokenChanged, User } from 'firebase/auth'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/firebase/config'
import { onAuthChange, getIdToken, signOut as firebaseLogout } from './authClient'
import { apiClient, SpecialistProfile } from './api'

interface AuthState {
  user: User | null
  profile: SpecialistProfile | null
  isLoading: boolean
  currentOrgId: string | null
  logout: () => Promise<void>
  refreshProfile: (options?: { force?: boolean }) => Promise<void>
  updateProfile: (updater: (current: SpecialistProfile | null) => SpecialistProfile | null) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const profileRequestVersion = useRef(0)

  const loadProfile = async (options?: { force?: boolean }) => {
    const requestVersion = ++profileRequestVersion.current

    try {
      if (options?.force) {
        apiClient.clearCache()
      }

      const idToken = await getIdToken(options?.force)
      if (!idToken) return

      if (requestVersion !== profileRequestVersion.current) return

      apiClient.setToken(idToken)

      const profileData = await apiClient.getMe().catch(() => null)

      if (requestVersion !== profileRequestVersion.current) {
        return
      }

      if (profileData) {
        setProfile(profileData)
        setCurrentOrgId((prev) => {
          if (prev && profileData.organizations.some((org) => org.orgId === prev)) {
            return prev
          }
          return profileData.organizations[0]?.orgId || null
        })
        // Enrich Sentry context with role and orgId after profile loads
        const firstOrg = profileData.organizations[0]
        if (firstOrg) {
          Sentry.setTag('org_id', firstOrg.orgId)
          Sentry.setTag('user_role', firstOrg.role ?? 'unknown')
        }
      }
    } catch {
      if (requestVersion !== profileRequestVersion.current) {
        return
      }
      setProfile(null)
    }
  }

  useEffect(() => {
    let isMounted = true

    const unsubscribe = onAuthChange(async (currentUser) => {
      if (!isMounted) return

      setIsLoading(true)
      setUser(currentUser)

      if (currentUser) {
        Sentry.setUser({ id: currentUser.uid })
        try {
          await loadProfile()
        } catch (error) {
          console.error('Error loading profile:', error)
          setProfile(null)
          setCurrentOrgId(null)
        }
      } else {
        profileRequestVersion.current += 1
        setProfile(null)
        setCurrentOrgId(null)
        apiClient.setToken(null)
        apiClient.clearCache()
      }

      setIsLoading(false)
    })

    const timeout = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false)
      }
    }, 5000)

    const tokenUnsub = auth
      ? onIdTokenChanged(auth, async (currentUser) => {
          const token = currentUser ? await currentUser.getIdToken() : null
          if (isMounted) apiClient.setToken(token)
        })
      : () => {
          apiClient.setToken(null)
        }

    return () => {
      isMounted = false
      clearTimeout(timeout)
      unsubscribe()
      tokenUnsub()
    }
  }, [])

  const logout = async () => {
    Sentry.setUser(null)
    await firebaseLogout()
    setUser(null)
    setProfile(null)
    setCurrentOrgId(null)
    apiClient.setToken(null)
    apiClient.clearCache()
  }

  const refreshProfile = async (options?: { force?: boolean }) => {
    if (user) {
      await loadProfile(options)
    }
  }

  const updateProfile = (
    updater: (current: SpecialistProfile | null) => SpecialistProfile | null
  ) => {
    profileRequestVersion.current += 1
    setProfile((prev) => updater(prev))
  }

  const value = useMemo(
    () => ({
      user,
      profile,
      isLoading,
      currentOrgId,
      logout,
      refreshProfile,
      updateProfile,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshProfile and updateProfile are stable
    [user, profile, isLoading, currentOrgId]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
