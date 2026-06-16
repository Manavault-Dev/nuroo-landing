'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
  useRef,
  useCallback,
} from 'react'
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
const PROFILE_CACHE_KEY = 'nuroo:b2b:profile:v1'
const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000

interface CachedProfile {
  uid: string
  email: string | null
  profile: SpecialistProfile
  currentOrgId: string | null
  expiresAt: number
}

function readCachedProfile(currentUser: User): CachedProfile | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null

    const cached = JSON.parse(raw) as CachedProfile
    if (
      cached.uid !== currentUser.uid ||
      cached.email !== currentUser.email ||
      cached.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(PROFILE_CACHE_KEY)
      return null
    }

    return cached
  } catch {
    window.localStorage.removeItem(PROFILE_CACHE_KEY)
    return null
  }
}

function writeCachedProfile(
  currentUser: User,
  profile: SpecialistProfile,
  currentOrgId: string | null
) {
  if (typeof window === 'undefined') return

  const payload: CachedProfile = {
    uid: currentUser.uid,
    email: currentUser.email,
    profile,
    currentOrgId,
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
  }

  window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(payload))
}

function clearCachedProfile() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PROFILE_CACHE_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const profileRequestVersion = useRef(0)
  const currentOrgIdRef = useRef<string | null>(null)

  const setActiveOrgId = useCallback((orgId: string | null) => {
    currentOrgIdRef.current = orgId
    setCurrentOrgId(orgId)
  }, [])

  const loadProfile = useCallback(
    async (options?: { force?: boolean }) => {
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
          const nextOrgId = (() => {
            const prev = currentOrgIdRef.current
            if (prev && profileData.organizations.some((org) => org.orgId === prev)) {
              return prev
            }
            return profileData.organizations[0]?.orgId || null
          })()
          setActiveOrgId(nextOrgId)
          const currentUser = auth?.currentUser
          if (currentUser) {
            writeCachedProfile(currentUser, profileData, nextOrgId)
          }
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
    },
    [setActiveOrgId]
  )

  useEffect(() => {
    let isMounted = true

    const unsubscribe = onAuthChange(async (currentUser) => {
      if (!isMounted) return

      setIsLoading(true)
      setUser(currentUser)

      if (currentUser) {
        Sentry.setUser({ id: currentUser.uid })
        const cached = readCachedProfile(currentUser)
        if (cached) {
          setProfile(cached.profile)
          setActiveOrgId(
            cached.currentOrgId &&
              cached.profile.organizations.some((org) => org.orgId === cached.currentOrgId)
              ? cached.currentOrgId
              : cached.profile.organizations[0]?.orgId || null
          )
          setIsLoading(false)
        }

        try {
          await loadProfile()
        } catch (error) {
          console.error('Error loading profile:', error)
          setProfile(null)
          setActiveOrgId(null)
        }
      } else {
        profileRequestVersion.current += 1
        setProfile(null)
        setActiveOrgId(null)
        apiClient.setToken(null)
        apiClient.clearCache()
        clearCachedProfile()
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
  }, [loadProfile, setActiveOrgId])

  const logout = useCallback(async () => {
    Sentry.setUser(null)
    await firebaseLogout()
    setUser(null)
    setProfile(null)
    setActiveOrgId(null)
    apiClient.setToken(null)
    apiClient.clearCache()
    clearCachedProfile()
  }, [setActiveOrgId])

  const refreshProfile = useCallback(
    async (options?: { force?: boolean }) => {
      if (user) {
        await loadProfile(options)
      }
    },
    [loadProfile, user]
  )

  const updateProfile = useCallback(
    (updater: (current: SpecialistProfile | null) => SpecialistProfile | null) => {
      profileRequestVersion.current += 1
      setProfile((prev) => {
        const next = updater(prev)
        const currentUser = auth?.currentUser
        if (currentUser && next) {
          writeCachedProfile(currentUser, next, currentOrgIdRef.current)
        }
        return next
      })
    },
    []
  )

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
    [user, profile, isLoading, currentOrgId, logout, refreshProfile, updateProfile]
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
