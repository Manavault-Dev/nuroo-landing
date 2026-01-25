'use client'

import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../api/adminApi'
import type { Organization, Invite } from '@/src/shared/types'

interface SuperAdmin {
  uid: string
  email: string
  displayName: string | null
  createdAt: string
  lastSignIn: string | null
}

export function useAdmin() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [orgsRes, invitesRes, superAdminsRes] = await Promise.all([
        adminApi.listOrganizations(),
        adminApi.listInvites(),
        adminApi.listSuperAdmins(),
      ])

      setOrganizations(orgsRes.organizations)
      setInvites(invitesRes.invites)
      setSuperAdmins(superAdminsRes.superAdmins)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const createOrganization = useCallback(async (name: string, country?: string) => {
    try {
      const result = await adminApi.createOrganization(name, country)
      await fetchAll() // Refresh data
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [fetchAll])

  const generateInvite = useCallback(async (data: {
    orgId: string
    role: 'org_admin' | 'specialist' | 'parent'
    expiresAt?: string
    maxUses?: number
  }) => {
    try {
      const result = await adminApi.generateInviteCode(data)
      await fetchAll() // Refresh data
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [fetchAll])

  const grantSuperAdmin = useCallback(async (email: string) => {
    try {
      const result = await adminApi.grantSuperAdmin(email)
      await fetchAll() // Refresh data
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [fetchAll])

  const removeSuperAdmin = useCallback(async (uid: string) => {
    try {
      const result = await adminApi.removeSuperAdmin(uid)
      await fetchAll() // Refresh data
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [fetchAll])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return {
    organizations,
    invites,
    superAdmins,
    loading,
    error,
    refetch: fetchAll,
    createOrganization,
    generateInvite,
    grantSuperAdmin,
    removeSuperAdmin,
  }
}
