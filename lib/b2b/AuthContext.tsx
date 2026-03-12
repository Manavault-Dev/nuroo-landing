'use client'

import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useRef } from 'react'
import { User } from 'firebase/auth'
import { onAuthChange, getIdToken, signOut as firebaseLogout } from './authClient'
import { apiClient, SpecialistProfile } from './api'

interface AuthState {
  user: User | null
  profile: SpecialistProfile | null
  isLoading: boolean
  currentOrgId: string | null
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (updater: (current: SpecialistProfile | null) => SpecialistProfile | null) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const profileRequestVersion = useRef(0)

  const loadProfile = async () => {
    const requestVersion = ++profileRequestVersion.current

    try {
      const idToken = await getIdToken()
      if (!idToken) return

      apiClient.setToken(idToken)

      const profileData = await apiClient.getMe().catch(() => null)

      if (requestVersion !== profileRequestVersion.current) {
        return
      }

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

      setUser(currentUser)

      if (currentUser) {
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
    setCurrentOrgId(null)
    apiClient.setToken(null)
    apiClient.clearCache()
  }

  const refreshProfile = async () => {
    if (user) {
      await loadProfile()
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
