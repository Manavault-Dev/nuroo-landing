'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { organizationApi } from '../api/organizationApi'
import type { SpecialistProfile } from '@/src/shared/types'

export function useOrganization(orgId: string | undefined) {
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await organizationApi.getProfile()
      setProfile(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const currentOrg = useMemo(() => {
    if (!profile) return null
    return (
      profile.organizations.find((org) => org.orgId === orgId) || profile.organizations[0] || null
    )
  }, [profile, orgId])

  const isAdmin = currentOrg?.role === 'admin'
  const isPersonalOrg = currentOrg?.orgName?.includes("'s Practice")

  return {
    profile,
    currentOrg,
    loading,
    error,
    refetch: fetchProfile,
    isAdmin,
    isPersonalOrg,
    organizations: profile?.organizations ?? [],
  }
}
