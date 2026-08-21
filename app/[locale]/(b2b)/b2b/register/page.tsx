'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { register, signInWithGoogle } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { UserPlus, Mail, Lock, User, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/b2b/AuthContext'
import { getWorkspacePath, type B2bOrgMembership } from '@/src/config/routes'

const CURRENT_VERSIONS = { PUBLIC_OFFER: '1.0', PRIVACY_POLICY: '1.0', LEGAL_REPRESENTATIVE: '1.0' }

/** Reusable Google "G" logo — inline SVG, no extra dependency */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}

function RegisterForm() {
  const t = useTranslations('b2b.register')
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCodeParam = searchParams.get('invite') || searchParams.get('code') || ''
  const { refreshProfile } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState(inviteCodeParam)
  const [legalAccepted, setLegalAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  /** Record legal consent after successful auth */
  const recordLegalConsent = async () => {
    await Promise.allSettled([
      apiClient.acceptConsent('PUBLIC_OFFER', CURRENT_VERSIONS.PUBLIC_OFFER, 'ru'),
      apiClient.acceptConsent('PRIVACY_POLICY', CURRENT_VERSIONS.PRIVACY_POLICY, 'ru'),
      apiClient.acceptConsent('LEGAL_REPRESENTATIVE', CURRENT_VERSIONS.LEGAL_REPRESENTATIVE, 'ru'),
    ])
  }

  /** Shared post-auth flow: accept invite if present, then redirect */
  const handlePostAuth = async (userCredential: Awaited<ReturnType<typeof register>>) => {
    const idToken = await userCredential.user.getIdToken()
    apiClient.setToken(idToken)

    // Record legal consent — MUST happen before any workspace access
    await recordLegalConsent()

    if (inviteCode.trim()) {
      try {
        const result = await apiClient.acceptInvite(inviteCode.trim())
        apiClient.clearCache()
        const refreshedToken = await userCredential.user.getIdToken(true)
        apiClient.setToken(refreshedToken)
        await refreshProfile({ force: true })

        const membership: B2bOrgMembership = {
          orgId: result.orgId,
          role: result.role === 'specialist' ? 'specialist' : 'admin',
        }
        router.push(getWorkspacePath(membership))
        return
      } catch (acceptError: unknown) {
        throw new Error(
          acceptError instanceof Error ? acceptError.message : t('errorJoinOrganization')
        )
      }
    }

    router.push('/b2b/onboarding')
  }

  const handleGoogleSignIn = async () => {
    if (googleLoading) return
    if (!legalAccepted) {
      setError('Необходимо принять Публичную оферту и Политику конфиденциальности')
      return
    }
    setError('')
    setGoogleLoading(true)

    try {
      const userCredential = await signInWithGoogle()
      await handlePostAuth(userCredential)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (!msg.includes('popup-closed') && !msg.includes('cancelled')) {
        setError(msg || t('googleError'))
      }
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!legalAccepted) {
      setError('Необходимо принять Публичную оферту и Политику конфиденциальности')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError(t('errorValidEmail'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('errorPasswordsMismatch'))
      return
    }

    if (password.length < 6) {
      setError(t('errorPasswordLength'))
      return
    }

    setLoading(true)

    try {
      const userCredential = await register(email, password, name)
      await handlePostAuth(userCredential)
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string }
      let errorMessage = t('errorCreateAccount')
      if (firebaseError.code) {
        switch (firebaseError.code) {
          case 'auth/email-already-in-use':
            errorMessage = t('errorEmailInUse')
            break
          case 'auth/invalid-email':
            errorMessage = t('errorInvalidEmail')
            break
          case 'auth/weak-password':
            errorMessage = t('errorWeakPassword')
            break
          case 'auth/operation-not-allowed':
            errorMessage = t('errorOperationNotAllowed')
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

  const isAnyLoading = loading || googleLoading
  const canSubmit = legalAccepted && !isAnyLoading

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
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Email / password form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
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
                  placeholder={t('namePlaceholder')}
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
                placeholder={t('inviteCodePlaceholder')}
              />
              <p className="mt-1 text-xs text-gray-500">{t('inviteCodeHint')}</p>
            </div>

            {/* Legal consent — required, not pre-checked */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Юридические условия
              </p>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  id="legalAccepted"
                  checked={legalAccepted}
                  onChange={(e) => setLegalAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500 shrink-0 cursor-pointer"
                  aria-required="true"
                  aria-label="Принять Публичную оферту и Политику конфиденциальности"
                />
                <span className="text-sm text-gray-700 leading-relaxed">
                  Я прочитал(а) и принимаю{' '}
                  <a
                    href="/legal/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700 underline font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Публичную оферту
                  </a>
                  ,{' '}
                  <a
                    href="/legal/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700 underline font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Политику конфиденциальности
                  </a>{' '}
                  и{' '}
                  <a
                    href="/legal/parental-consent"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700 underline font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Согласие законного представителя
                  </a>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isAnyLoading || !legalAccepted}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('creating') : t('createAccount')}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              {t('orContinueWith')}
            </span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {googleLoading ? (
              <span className="w-5 h-5 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
            ) : (
              <GoogleLogo />
            )}
            <span className="text-sm font-medium text-gray-700">{t('googleSignUp')}</span>
          </button>

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
