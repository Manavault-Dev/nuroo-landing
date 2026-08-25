'use client'

import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function ForgotPasswordPage() {
  const t = useTranslations('forgotPassword')
  const locale = useLocale()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError(t('enter_email'))
      return
    }

    setLoading(true)
    try {
      // Send via backend → Resend (branded email, no spam)
      await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), lang: locale }),
      })
      // Always show success (never reveal if email exists)
      setSent(true)
    } catch {
      setError(t('send_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link
          href="/b2b/login"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('back_to_signin')}
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {sent ? (
            // Success state
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-teal-500" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('check_inbox')}</h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-1">{t('email_sent_to')}</p>
              <p className="text-teal-600 font-semibold text-sm mb-4">{email}</p>
              <p className="text-xs text-gray-400 mb-8">{t('check_spam')}</p>
              <Link
                href="/b2b/login"
                className="inline-flex justify-center w-full py-3 px-4 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
              >
                {t('back_to_signin')}
              </Link>
            </div>
          ) : (
            // Form state
            <>
              <div className="mb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center">
                    <Mail className="w-8 h-8 text-teal-500" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">{t('title')}</h1>
                <p className="text-sm text-gray-500 text-center">{t('subtitle')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('email_label')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      placeholder="example@example.com"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('sending') : t('send_button')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
