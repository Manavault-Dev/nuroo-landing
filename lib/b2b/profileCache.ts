'use client'

import type { User } from 'firebase/auth'
import type { SpecialistProfile } from './api'

const PROFILE_CACHE_KEY = 'nuroo:b2b:profile:v1'
const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000

export interface CachedProfile {
  uid: string
  email: string | null
  profile: SpecialistProfile
  currentOrgId: string | null
  expiresAt: number
}

type CacheUser = Pick<User, 'uid' | 'email'> | { uid: string; email: string | null }

export function getDefaultOrgId(
  profile: SpecialistProfile,
  preferredOrgId?: string | null
): string | null {
  if (preferredOrgId && profile.organizations.some((org) => org.orgId === preferredOrgId)) {
    return preferredOrgId
  }

  return profile.organizations[0]?.orgId || null
}

export function readCachedProfile(currentUser: CacheUser): CachedProfile | null {
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

export function writeCachedProfile(
  currentUser: CacheUser,
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

export function clearCachedProfile() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PROFILE_CACHE_KEY)
}
