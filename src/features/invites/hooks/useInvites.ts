'use client'

import { useState, useCallback } from 'react'
import { invitesApi } from '../api/invitesApi'

export function useInvites(orgId: string | undefined) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createOrgInvite = useCallback(
    async (options?: {
      role?: 'specialist' | 'admin'
      maxUses?: number
      expiresInDays?: number
    }) => {
      if (!orgId) return null

      setLoading(true)
      setError(null)

      try {
        const result = await invitesApi.createOrgInvite(orgId, options)
        return result
      } catch (err: any) {
        setError(err.message)
        return null
      } finally {
        setLoading(false)
      }
    },
    [orgId]
  )

  const createParentInvite = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await invitesApi.createParentInvite()
      return result
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    createOrgInvite,
    createParentInvite,
  }
}
