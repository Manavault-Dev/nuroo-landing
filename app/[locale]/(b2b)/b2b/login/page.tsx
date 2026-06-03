'use client'

import { useState, FormEvent } from 'react'
import { signIn, signInWithGoogle, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react'

/** Google "G" logo — inline SVG, no extra dependency */
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

const DEMO_ACCOUNTS = {
  organizer: { email: 'aijan@gmail.com', password: 'aijan123', label: 'Организатор' },
  specialist: { email: 'akylai@gmail.com', password: 'akylai', label: 'Специалист' },
} as const

export default function LoginPage() {
  const t = useTranslations('b2b.login')
  const tCommon = useTranslations('b2b.common')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState<'organizer' | 'specialist' | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return

    setError('')
    setLoading(true)

    try {
      const userCredential = await signIn(email, password)
      const idToken = await userCredential.user.getIdToken()
      apiClient.setToken(idToken)

      const refreshedToken = await getIdToken(true)
      if (refreshedToken) apiClient.setToken(refreshedToken)

      // Don't navigate here — the layout's auth effect detects the new user
      // and redirects to the correct page (with ?redirect= support).
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('signInError'))
      setLoading(false)
    }
  }

  const handleDemoLogin = async (role: 'organizer' | 'specialist') => {
    if (isAnyLoading) return
    const account = DEMO_ACCOUNTS[role]
    setError('')
    setDemoLoading(role)
    setEmail(account.email)
    setPassword(account.password)
    try {
      const userCredential = await signIn(account.email, account.password)
      const idToken = await userCredential.user.getIdToken()
      apiClient.setToken(idToken)
      const refreshedToken = await getIdToken(true)
      if (refreshedToken) apiClient.setToken(refreshedToken)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('signInError'))
      setDemoLoading(null)
    }
  }

  const handleGoogleSignIn = async () => {
    if (googleLoading) return
    setError('')
    setGoogleLoading(true)

    try {
      const userCredential = await signInWithGoogle()
      const idToken = await userCredential.user.getIdToken()
      apiClient.setToken(idToken)

      const refreshedToken = await getIdToken(true)
      if (refreshedToken) apiClient.setToken(refreshedToken)

      // Layout auth effect handles redirect
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      // User closing the popup is not an error
      if (!msg.includes('popup-closed') && !msg.includes('cancelled')) {
        setError(t('googleError'))
      }
      setGoogleLoading(false)
    }
  }

  const isAnyLoading = loading || googleLoading || demoLoading !== null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-6">
        {/* ── Демо-доступ для жюри — первый экран ──────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 to-secondary-600 p-6 shadow-2xl">
          {/* декоративные круги */}
          <div className="pointer-events-none absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/10" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🎓</span>
              <p className="text-base font-bold text-white">Демо-доступ для жюри</p>
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest bg-white/20 text-white px-2.5 py-1 rounded-full">
                Demo
              </span>
            </div>
            <p className="text-sm text-white/75 mb-5"></p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isAnyLoading}
                onClick={() => handleDemoLogin('organizer')}
                className="flex items-center gap-3 px-5 py-4 rounded-xl bg-white hover:bg-primary-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-[0.98] text-left"
              >
                <span className="text-2xl shrink-0">
                  {demoLoading === 'organizer' ? (
                    <span className="inline-block w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    '🏢'
                  )}
                </span>
                <div>
                  <p className="text-sm font-bold text-primary-700">Войти как Организатор</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {DEMO_ACCOUNTS.organizer.email}
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={isAnyLoading}
                onClick={() => handleDemoLogin('specialist')}
                className="flex items-center gap-3 px-5 py-4 rounded-xl bg-white hover:bg-secondary-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-[0.98] text-left"
              >
                <span className="text-2xl shrink-0">
                  {demoLoading === 'specialist' ? (
                    <span className="inline-block w-6 h-6 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    '👩‍⚕️'
                  )}
                </span>
                <div>
                  <p className="text-sm font-bold text-secondary-700">Войти как Специалист</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {DEMO_ACCOUNTS.specialist.email}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ── Разделитель ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            или войти вручную
          </span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        {/* ── Заголовок ────────────────────────────────────────────────────── */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary-100 p-3 rounded-full">
              <LogIn className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{t('title')}</h2>
          <p className="mt-2 text-sm text-gray-600">{t('subtitle')}</p>
        </div>

        {/* ── Основная карточка логина ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Email / password form */}
          <form className="max-w-md mx-auto space-y-6" onSubmit={handleSubmit}>
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
                  placeholder="example@example.com"
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
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isAnyLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? tCommon('loading') : t('signIn')}
              </button>
            </div>
          </form>

          <div className="max-w-md mx-auto flex items-center gap-3 my-6">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              {t('orContinueWith')}
            </span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <div className="max-w-md mx-auto">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isAnyLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {googleLoading ? (
                <span className="w-5 h-5 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
              ) : (
                <GoogleLogo />
              )}
              <span className="text-sm font-medium text-gray-700">{t('googleSignIn')}</span>
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t('noAccount')}{' '}
              <Link
                href="/b2b/register"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                {t('register')}
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
