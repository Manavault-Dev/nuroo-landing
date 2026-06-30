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
import { auth } from '@/lib/firebase/config'
import { onAuthChange, getIdToken, signOut as firebaseLogout } from './authClient'
import { apiClient, SpecialistProfile } from './api'
import {
  clearCachedProfile,
  getDefaultOrgId,
  readCachedProfile,
  writeCachedProfile,
} from './profileCache'
import { runWhenIdle, shouldLoadClientSentry } from '@/lib/sentryClient'

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
const E2E_AUTH_KEY = 'nuroo:e2e:auth'
const E2E_AUTH_BYPASS = process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === '1'

function setSentryUserAsync(user: { id: string } | null) {
  if (!shouldLoadClientSentry()) return
  runWhenIdle(() => {
    void import('@sentry/nextjs').then((Sentry) => {
      Sentry.setUser(user)
    })
  })
}

function setSentryTagAsync(key: string, value: string) {
  if (!shouldLoadClientSentry()) return
  runWhenIdle(() => {
    void import('@sentry/nextjs').then((Sentry) => {
      Sentry.setTag(key, value)
    })
  })
}

interface E2EAuthPayload {
  user: {
    uid: string
    email: string | null
    displayName?: string | null
  }
  profile: SpecialistProfile
  currentOrgId?: string | null
}

function readE2EAuthPayload(): E2EAuthPayload | null {
  if (typeof window === 'undefined' || !E2E_AUTH_BYPASS) return null

  try {
    const raw = window.localStorage.getItem(E2E_AUTH_KEY)
    if (!raw) return null
    return JSON.parse(raw) as E2EAuthPayload
  } catch {
    window.localStorage.removeItem(E2E_AUTH_KEY)
    return null
  }
}

function clearE2EAuthPayload() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(E2E_AUTH_KEY)
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
    async (options?: { force?: boolean; user?: User }) => {
      const requestVersion = ++profileRequestVersion.current

      try {
        if (options?.force) {
          apiClient.clearCache()
        }

        const idToken = options?.user
          ? await options.user.getIdToken(options?.force)
          : await getIdToken(options?.force)
        if (!idToken) return

        if (requestVersion !== profileRequestVersion.current) return

        apiClient.setToken(idToken)

        const profileData = await apiClient.getMe().catch(() => null)

        if (requestVersion !== profileRequestVersion.current) {
          return
        }

        if (profileData) {
          setProfile(profileData)
          const nextOrgId = getDefaultOrgId(profileData, currentOrgIdRef.current)
          setActiveOrgId(nextOrgId)
          const currentUser = options?.user ?? auth?.currentUser
          if (currentUser) {
            writeCachedProfile(currentUser, profileData, nextOrgId)
          }
          // Enrich Sentry context with role and orgId after profile loads
          const firstOrg = profileData.organizations[0]
          if (firstOrg) {
            setSentryTagAsync('org_id', firstOrg.orgId)
            setSentryTagAsync('user_role', firstOrg.role ?? 'unknown')
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
    if (E2E_AUTH_BYPASS) {
      const mock = readE2EAuthPayload()
      if (mock) {
        setUser(mock.user as User)
        setProfile(mock.profile)
        setActiveOrgId(getDefaultOrgId(mock.profile, mock.currentOrgId))
        apiClient.setToken('e2e-token')
      } else {
        setUser(null)
        setProfile(null)
        setActiveOrgId(null)
        apiClient.setToken(null)
      }
      setIsLoading(false)
      return
    }

    let isMounted = true

    const unsubscribe = onAuthChange(async (currentUser) => {
      if (!isMounted) return

      setIsLoading(true)
      setUser(currentUser)

      if (currentUser) {
        setSentryUserAsync({ id: currentUser.uid })
        const cached = readCachedProfile(currentUser)
        if (cached) {
          setProfile(cached.profile)
          setActiveOrgId(getDefaultOrgId(cached.profile, cached.currentOrgId))
          setIsLoading(false)
        }

        try {
          await loadProfile({ user: currentUser })
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
    setSentryUserAsync(null)
    if (E2E_AUTH_BYPASS) {
      setUser(null)
      setProfile(null)
      setActiveOrgId(null)
      apiClient.setToken(null)
      apiClient.clearCache()
      clearCachedProfile()
      clearE2EAuthPayload()
      return
    }
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
        await loadProfile({ ...options, user })
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
