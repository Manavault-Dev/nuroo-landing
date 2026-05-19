'use client'

import { useState, FormEvent } from 'react'
import { signIn, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const t = useTranslations('b2b.login')
  const tCommon = useTranslations('b2b.common')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      setError(
        err instanceof Error ? err.message : 'Failed to sign in. Please check your credentials.'
      )
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary-100 p-3 rounded-full">
              <LogIn className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{t('title')}</h2>
          <p className="mt-2 text-sm text-gray-600">{t('subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <form className="max-w-md mx-auto space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

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
                  placeholder="tilek.dzenisev@gmail.com"
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
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? tCommon('loading') : t('signIn')}
              </button>
            </div>
          </form>

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
