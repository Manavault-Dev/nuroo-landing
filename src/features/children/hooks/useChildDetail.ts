'use client'

import { useState, useEffect, useCallback } from 'react'
import { childrenApi } from '../api/childrenApi'
import type { ChildDetail, TimelineResponse } from '@/src/shared/types'

export function useChildDetail(orgId: string | undefined, childId: string | undefined) {
  const [child, setChild] = useState<ChildDetail | null>(null)
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchChild = useCallback(async () => {
    if (!orgId || !childId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [childData, timelineData] = await Promise.all([
        childrenApi.getChildDetail(orgId, childId),
        childrenApi.getTimeline(orgId, childId, 30),
      ])

      setChild(childData)
      setTimeline(timelineData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [orgId, childId])

  useEffect(() => {
    fetchChild()
  }, [fetchChild])

  return {
    child,
    timeline,
    loading,
    error,
    refetch: fetchChild,
  }
}
