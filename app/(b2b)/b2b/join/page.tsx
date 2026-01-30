'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import Link from 'next/link'
import { Users, Key, AlertCircle } from 'lucide-react'

export default function JoinPage() {
  const router = useRouter()
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if user is Super Admin on mount - redirect immediately if Super Admin
    const checkSuperAdmin = async () => {
      const user = getCurrentUser()
      if (!user) {
        router.push('/b2b/login')
        return
      }

      try {
        const idToken = await getIdToken(true)
        if (!idToken) {
          return
        }
        apiClient.setToken(idToken)
        const superAdminCheck = await apiClient.checkSuperAdmin()
        if (superAdminCheck.isSuperAdmin) {
          router.replace('/b2b/content')
          return
        }
      } catch {
        // Not Super Admin or error - continue with normal flow
      }
    }

    checkSuperAdmin()
  }, [router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!inviteCode.trim()) {
      setError('Please enter an invite code')
      return
    }

    const user = getCurrentUser()
    if (!user) {
      router.push('/b2b/login')
      return
    }

    setLoading(true)

    try {
      const idToken = await getIdToken()
      if (!idToken) {
        router.push('/b2b/login')
        return
      }

      apiClient.setToken(idToken)

      await apiClient.acceptInvite(inviteCode.trim())
      router.push('/b2b')
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to join organization. Please check the invite code.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary-100 p-3 rounded-full">
              <Users className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Join Organization</h2>
          <p className="mt-2 text-sm text-gray-600">
            Your account is not linked to an organization yet
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-2">
                Invite Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="inviteCode"
                  name="inviteCode"
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter your invite code"
                  autoFocus
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Enter the invite code provided by your organization administrator
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || !inviteCode.trim()}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Joining...' : 'Join Organization'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/b2b/login"
              className="text-sm font-medium text-primary-600 hover:text-primary-500"
            >
              Sign out and use a different account
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Nuroo Home
          </Link>
        </div>
      </div>
    </div>
  )
}
