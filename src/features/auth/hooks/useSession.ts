'use client'

import { useState, useEffect, useCallback } from 'react'
import { authApi } from '../api/authApi'
import type { SessionResponse } from '@/src/shared/types'

export function useSession() {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await authApi.getSession()
      setSession(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  return {
    session,
    loading,
    error,
    refetch: fetchSession,
    hasOrg: session?.hasOrg ?? false,
    orgId: session?.orgId,
  }
}
