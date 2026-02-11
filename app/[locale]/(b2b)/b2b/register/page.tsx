'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { register } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { UserPlus, Mail, Lock, User, AlertCircle } from 'lucide-react'

function RegisterForm() {
  const t = useTranslations('b2b.register')
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCodeParam = searchParams.get('invite') || searchParams.get('code') || ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState(inviteCodeParam)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const userCredential = await register(email, password, name)
      const idToken = await userCredential.user.getIdToken()
      apiClient.setToken(idToken)

      if (inviteCode.trim()) {
        try {
          await apiClient.acceptInvite(inviteCode.trim())
          router.push('/b2b')
          return
        } catch (acceptError: unknown) {
          const errorMessage =
            acceptError instanceof Error
              ? acceptError.message
              : 'Failed to join organization. Please check your invite code.'
          setError(errorMessage)
          setLoading(false)
          return
        }
      }

      router.push('/b2b/onboarding')
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string }
      let errorMessage = 'Failed to create account. Please try again.'
      if (firebaseError.code) {
        switch (firebaseError.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email is already registered. Please sign in instead.'
            break
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address. Please check your email format.'
            break
          case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please use a stronger password.'
            break
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password sign-up is not enabled. Please contact support.'
            break
          default:
            errorMessage = firebaseError.message || errorMessage
        }
      } else if (firebaseError.message) {
        errorMessage = firebaseError.message
      }
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary-100 p-3 rounded-full">
              <UserPlus className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{t('title')}</h2>
          <p className="mt-2 text-sm text-gray-600">{t('subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                {t('fullName')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {t('email')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                {t('password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('confirmPassword')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-2">
                {t('inviteCode')} <span className="text-gray-400">{t('inviteCodeOptional')}</span>
              </label>
              <input
                id="inviteCode"
                name="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 uppercase"
                placeholder="Enter your invite code"
              />
              <p className="mt-1 text-xs text-gray-500">
                If you don’t have an invite code yet, you can create your account now and join an
                organization later.
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? t('creating') : t('createAccount')}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t('hasAccount')}{' '}
              <Link
                href="/b2b/login"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                {t('signIn')}
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            {t('backToHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
