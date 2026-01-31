'use client'

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react'
import { User } from 'firebase/auth'
import { onAuthChange, getIdToken, signOut as firebaseLogout } from './authClient'
import { apiClient, SpecialistProfile } from './api'

interface AuthState {
  user: User | null
  profile: SpecialistProfile | null
  isSuperAdmin: boolean
  isLoading: boolean
  currentOrgId: string | null
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)

  const loadProfile = async () => {
    try {
      const idToken = await getIdToken()
      if (!idToken) return

      apiClient.setToken(idToken)

      const [profileData, superAdminData] = await Promise.all([
        apiClient.getMe().catch(() => null),
        apiClient.checkSuperAdmin().catch(() => ({ isSuperAdmin: false })),
      ])

      if (profileData) {
        setProfile(profileData)
        setCurrentOrgId(profileData.organizations[0]?.orgId || null)
      }

      setIsSuperAdmin(superAdminData?.isSuperAdmin || false)
    } catch {
      setProfile(null)
      setIsSuperAdmin(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    const unsubscribe = onAuthChange(async (currentUser) => {
      if (!isMounted) return

      setUser(currentUser)

      if (currentUser) {
        try {
          await loadProfile()
        } catch (error) {
          console.error('Error loading profile:', error)
          setProfile(null)
          setIsSuperAdmin(false)
          setCurrentOrgId(null)
        }
      } else {
        setProfile(null)
        setIsSuperAdmin(false)
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

    return () => {
      isMounted = false
      clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  const logout = async () => {
    await firebaseLogout()
    setUser(null)
    setProfile(null)
    setIsSuperAdmin(false)
    setCurrentOrgId(null)
    apiClient.setToken(null)
    apiClient.clearCache()
  }

  const refreshProfile = async () => {
    if (user) {
      await loadProfile()
    }
  }

  const value = useMemo(
    () => ({
      user,
      profile,
      isSuperAdmin,
      isLoading,
      currentOrgId,
      logout,
      refreshProfile,
    }),
    [user, profile, isSuperAdmin, isLoading, currentOrgId]
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
