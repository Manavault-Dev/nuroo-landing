'use client'

import { useState, FormEvent, useRef } from 'react'
import { signIn, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { LogIn, Mail, Lock, AlertCircle, ChevronDown } from 'lucide-react'

const DEMO_ACCOUNTS = [
  {
    id: 'organizer',
    email: 'pont@gmail.com',
    password: 'pont123',
  },
  {
    id: 'specialist',
    email: 'sezim@gmail.com',
    password: 'sezim123',
  },
] as const

export default function LoginPage() {
  const t = useTranslations('b2b.login')
  const demoSectionRef = useRef<HTMLDivElement | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const performLogin = async (nextEmail: string, nextPassword: string) => {
    if (loading) return

    setError('')
    setLoading(true)

    try {
      const userCredential = await signIn(nextEmail, nextPassword)
      const idToken = await userCredential.user.getIdToken()
      apiClient.setToken(idToken)

      const idTokenForCheck = await getIdToken(true)
      if (idTokenForCheck) {
        apiClient.setToken(idTokenForCheck)
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to sign in. Please check your credentials.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await performLogin(email, password)
  }

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail)
    setPassword(demoPassword)
    await performLogin(demoEmail, demoPassword)
  }

  const scrollToDemoSection = () => {
    demoSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary-100 p-3 rounded-full">
              <LogIn className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{t('title')}</h2>
          <p className="mt-2 text-sm text-gray-600">{t('subtitle')}</p>
          <div className="mt-4 mx-auto max-w-md rounded-2xl border border-primary-100 bg-white/85 px-4 py-4 shadow-sm backdrop-blur-sm">
            <button
              type="button"
              onClick={scrollToDemoSection}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-transform transition-colors hover:bg-primary-600 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <span>{t('jury.cta')}</span>
              <ChevronDown className="h-4 w-4 animate-bounce" />
            </button>
          </div>
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
                {loading ? t('signingIn') : t('signIn')}
              </button>
            </div>
          </form>

          <div ref={demoSectionRef} className="mt-8 border-t border-gray-100 pt-8">
            <div className="max-w-3xl mx-auto">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">{t('demo.title')}</h3>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm"
                  >
                    <div className="space-y-4">
                      <h4 className="text-base font-semibold text-gray-900">
                        {t(`demo.${account.id}.title`)}
                      </h4>

                      <div className="space-y-3">
                        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {t('demo.emailLabel')}
                          </p>
                          <p className="mt-1 break-all text-sm font-medium text-gray-900">
                            {account.email}
                          </p>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {t('demo.passwordLabel')}
                          </p>
                          <p className="mt-1 text-sm font-medium text-gray-900">
                            {account.password}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleDemoLogin(account.email, account.password)}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? t('signingIn') : t(`demo.${account.id}.cta`)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
