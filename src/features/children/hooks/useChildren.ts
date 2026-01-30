'use client'

import { useState, useEffect, useCallback } from 'react'
import { childrenApi } from '../api/childrenApi'
import type { ChildSummary } from '@/src/shared/types'

export function useChildren(orgId: string | undefined) {
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchChildren = useCallback(async () => {
    if (!orgId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await childrenApi.getChildren(orgId)
      setChildren(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  return {
    children,
    loading,
    error,
    refetch: fetchChildren,
    isEmpty: !loading && children.length === 0,
  }
}
