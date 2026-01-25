'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { apiClient } from '@/src/shared/lib/api'
import { authApi } from '../api/authApi'
import type { SpecialistProfile } from '@/src/shared/types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken()
          apiClient.setToken(idToken)

          const profileData = await authApi.getMe()
          setProfile(profileData)
        } catch (err) {
          console.error('Failed to load profile:', err)
          setProfile(null)
        }
      } else {
        apiClient.setToken(null)
        setProfile(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized')
    }
    setError(null)
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const idToken = await result.user.getIdToken()
      apiClient.setToken(idToken)
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized')
    }
    setError(null)
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      const idToken = await result.user.getIdToken()
      apiClient.setToken(idToken)

      // Create profile
      if (name) {
        await authApi.createProfile(name)
      }

      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!auth) return
    try {
      await firebaseSignOut(auth)
      apiClient.setToken(null)
      setProfile(null)
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  const refreshToken = useCallback(async () => {
    if (!auth?.currentUser) return null
    const idToken = await auth.currentUser.getIdToken(true)
    apiClient.setToken(idToken)
    return idToken
  }, [])

  return {
    user,
    profile,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    refreshToken,
    isAuthenticated: !!user,
  }
}
