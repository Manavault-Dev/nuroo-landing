'use client'

import { useState, useEffect, useCallback } from 'react'
import { childrenApi } from '../api/childrenApi'
import type { SpecialistNote } from '@/src/shared/types'

export function useNotes(orgId: string | undefined, childId: string | undefined) {
  const [notes, setNotes] = useState<SpecialistNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const fetchNotes = useCallback(async () => {
    if (!orgId || !childId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await childrenApi.getNotes(orgId, childId)
      setNotes(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [orgId, childId])

  const createNote = useCallback(async (text: string, tags?: string[]) => {
    if (!orgId || !childId) return null

    setCreating(true)
    setError(null)

    try {
      const note = await childrenApi.createNote(orgId, childId, text, tags)
      setNotes(prev => [note, ...prev])
      return note
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setCreating(false)
    }
  }, [orgId, childId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  return {
    notes,
    loading,
    error,
    creating,
    refetch: fetchNotes,
    createNote,
  }
}
