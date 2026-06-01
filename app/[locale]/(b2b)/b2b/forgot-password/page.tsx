'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
  type ClipboardEvent,
  type ChangeEvent,
} from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { Link } from '@/i18n/navigation'
import {
  requestPasswordReset,
  verifyOtp,
  updatePassword,
  PasswordResetApiError,
} from '@/lib/b2b/passwordResetApi'
import {
  Mail,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'email' | 'otp' | 'password' | 'success'

// ─── Step Indicator ───────────────────────────────────────────────────────────

interface StepIndicatorProps {
  current: Step
  labels: { email: string; otp: string; password: string }
}

function StepIndicator({ current, labels }: StepIndicatorProps) {
  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'email', label: labels.email, icon: <Mail size={14} /> },
    { key: 'otp', label: labels.otp, icon: <KeyRound size={14} /> },
    { key: 'password', label: labels.password, icon: <ShieldCheck size={14} /> },
  ]

  const stepIndex = { email: 0, otp: 1, password: 2, success: 3 }
  const currentIndex = stepIndex[current]

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, idx) => {
        const isDone = currentIndex > idx
        const isActive = currentIndex === idx
        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300
                ${isDone ? 'bg-emerald-100 text-emerald-700' : isActive ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'}
              `}
            >
              {isDone ? <CheckCircle2 size={14} /> : step.icon}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 transition-all duration-500 ${currentIndex > idx ? 'bg-emerald-400' : 'bg-gray-200'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── OTP Input ────────────────────────────────────────────────────────────────

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

function OtpInput({ value, onChange, disabled = false }: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')

  const focusNext = (idx: number) => {
    inputRefs.current[idx + 1]?.focus()
  }
  const focusPrev = (idx: number) => {
    inputRefs.current[idx - 1]?.focus()
  }

  const handleChange = (idx: number, e: ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = char
    onChange(next.join(''))
    if (char) focusNext(idx)
  }

  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits]
        next[idx] = ''
        onChange(next.join(''))
      } else {
        focusPrev(idx)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusPrev(idx)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusNext(idx)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted.padEnd(6, '').slice(0, 6))
    // Focus last filled or next empty
    const nextEmpty = pasted.length < 6 ? pasted.length : 5
    inputRefs.current[nextEmpty]?.focus()
  }

  return (
    <div className="flex items-center justify-center gap-3">
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputRefs.current[idx] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(idx, e)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={`
            w-11 h-14 text-center text-2xl font-bold rounded-xl border-2 outline-none
            transition-all duration-200 bg-white
            ${digit ? 'border-primary-500 text-primary-700 bg-primary-50' : 'border-gray-200 text-gray-800'}
            focus:border-primary-500 focus:ring-2 focus:ring-primary-200
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          aria-label={`Digit ${idx + 1}`}
          id={`otp-digit-${idx}`}
        />
      ))}
    </div>
  )
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm"
    >
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const t = useTranslations('b2b.forgotPassword')
  const locale = useLocale()

  // Step state
  const [step, setStep] = useState<Step>('email')

  // Form state
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Token for PATCH /me/password
  const [idToken, setIdToken] = useState<string | null>(null)

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  // ── Resend cooldown timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(id)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  // ── Error mapping ─────────────────────────────────────────────────────────
  const mapApiError = useCallback(
    (err: unknown): string => {
      if (err instanceof PasswordResetApiError) {
        if (err.status === 429) {
          const seconds = err.retryAfter ?? 60
          setResendCooldown(seconds)
          return t('errorRateLimit', { seconds })
        }
        const msg = err.message.toLowerCase()
        if (msg.includes('expired')) return t('errorExpiredCode')
        if (msg.includes('incorrect') || msg.includes('invalid code')) return t('errorWrongCode')
        if (msg.includes('too many')) return t('errorTooManyAttempts')
        if (msg.includes('failed to update')) return t('errorUpdateFailed')
        return err.message
      }
      if (err instanceof Error) return err.message
      return t('errorGeneric')
    },
    [t]
  )

  // ─── Step 1: Request OTP ──────────────────────────────────────────────────
  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await requestPasswordReset(email, locale as 'en' | 'ru' | 'ky')
      setResendCooldown(60)
      setStep('otp')
    } catch (err: unknown) {
      setError(mapApiError(err))
    } finally {
      setLoading(false)
    }
  }

  // ─── Step 2: Verify OTP ───────────────────────────────────────────────────
  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (otpCode.length !== 6) return
    setError(null)
    setLoading(true)

    try {
      const { customToken } = await verifyOtp(email, otpCode)

      // Exchange custom token for idToken via Firebase SDK
      if (!auth) throw new Error('Firebase Auth not initialized')
      const credential = await signInWithCustomToken(auth, customToken)
      const token = await credential.user.getIdToken()
      setIdToken(token)
      setStep('password')
    } catch (err: unknown) {
      setError(mapApiError(err))
      setOtpCode('')
    } finally {
      setLoading(false)
    }
  }

  // ─── Resend OTP ───────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError(null)
    setLoading(true)
    setOtpCode('')

    try {
      await requestPasswordReset(email, locale as 'en' | 'ru' | 'ky')
      setResendCooldown(60)
    } catch (err: unknown) {
      setError(mapApiError(err))
    } finally {
      setLoading(false)
    }
  }

  // ─── Step 3: Update Password ──────────────────────────────────────────────
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError(t('errorPasswordLength'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('errorPasswordsMismatch'))
      return
    }
    if (!idToken) {
      setError(t('errorGeneric'))
      return
    }

    setLoading(true)
    try {
      await updatePassword(idToken, newPassword)
      setStep('success')
    } catch (err: unknown) {
      setError(mapApiError(err))
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-primary-600 rounded-2xl p-3 shadow-lg">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
        </div>

        {/* Step indicator */}
        {step !== 'success' && (
          <StepIndicator
            current={step}
            labels={{
              email: t('stepEmail'),
              otp: t('stepCode'),
              password: t('stepNewPassword'),
            }}
          />
        )}

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Accent bar */}
          <div className="h-1 bg-gradient-to-r from-primary-500 via-indigo-500 to-purple-500" />

          <div className="p-8">
            {/* ── Step: Email ──────────────────────────────────────────── */}
            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{t('emailTitle')}</h2>
                  <p className="text-sm text-gray-500">{t('emailSubtitle')}</p>
                </div>

                {error && <ErrorBanner message={error} />}

                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    {t('emailLabel')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('emailPlaceholder')}
                      className="block w-full pl-9 pr-3 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  id="send-otp-btn"
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      {t('sending')}
                    </span>
                  ) : (
                    <>{t('sendCode')}</>
                  )}
                </button>
              </form>
            )}

            {/* ── Step: OTP ────────────────────────────────────────────── */}
            {step === 'otp' && (
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{t('codeTitle')}</h2>
                  <p className="text-sm text-gray-500">{t('codeSubtitle', { email })}</p>
                </div>

                {error && <ErrorBanner message={error} />}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 text-center">
                    {t('codeLabel')}
                  </label>
                  <OtpInput value={otpCode} onChange={setOtpCode} disabled={loading} />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  id="verify-otp-btn"
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      {t('verifying')}
                    </span>
                  ) : (
                    <>{t('verifyCode')}</>
                  )}
                </button>

                {/* Resend + change email */}
                <div className="flex items-center justify-between text-sm pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email')
                      setOtpCode('')
                      setError(null)
                    }}
                    className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    {t('changeEmail')}
                  </button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || loading}
                    id="resend-otp-btn"
                    className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw size={14} className={resendCooldown > 0 ? '' : ''} />
                    {resendCooldown > 0
                      ? t('resendIn', { seconds: resendCooldown })
                      : t('resendCode')}
                  </button>
                </div>
              </form>
            )}

            {/* ── Step: New Password ────────────────────────────────────── */}
            {step === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{t('newPasswordTitle')}</h2>
                  <p className="text-sm text-gray-500">{t('newPasswordSubtitle')}</p>
                </div>

                {error && <ErrorBanner message={error} />}

                {/* New password */}
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    {t('newPasswordLabel')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <KeyRound className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('newPasswordPlaceholder')}
                      className="block w-full pl-9 pr-10 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {newPassword.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4].map((level) => {
                        const strength = Math.min(Math.floor(newPassword.length / 3), 4)
                        return (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                              level <= strength
                                ? strength <= 1
                                  ? 'bg-red-400'
                                  : strength <= 2
                                    ? 'bg-amber-400'
                                    : strength <= 3
                                      ? 'bg-blue-400'
                                      : 'bg-emerald-400'
                                : 'bg-gray-200'
                            }`}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    {t('confirmPasswordLabel')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <KeyRound className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t('confirmPasswordPlaceholder')}
                      className={`block w-full pl-9 pr-10 py-3 border rounded-xl text-sm focus:ring-2 outline-none transition-colors ${
                        confirmPassword && confirmPassword !== newPassword
                          ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                          : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword === newPassword && (
                    <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Passwords match
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                  id="update-password-btn"
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      {t('updating')}
                    </span>
                  ) : (
                    <>
                      <ShieldCheck size={16} /> {t('updatePassword')}
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ── Step: Success ─────────────────────────────────────────── */}
            {step === 'success' && (
              <div className="text-center space-y-5 py-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{t('successTitle')}</h2>
                  <p className="text-sm text-gray-500 leading-relaxed">{t('successSubtitle')}</p>
                </div>
                <Link
                  href="/b2b/login"
                  id="go-to-login-btn"
                  className="inline-flex items-center gap-2 w-full justify-center py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {t('goToLogin')}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Back link */}
        {step !== 'success' && (
          <div className="text-center">
            <Link
              href="/b2b/login"
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 transition-colors"
            >
              <ArrowLeft size={14} />
              {t('backToLogin')}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
