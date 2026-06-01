const API_BASE_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3101')
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3101')

// ─── Response Types ───────────────────────────────────────────────────────────

export interface ResetRequestResponse {
  ok: boolean
  message: string
}

export interface VerifyOtpResponse {
  ok: boolean
  customToken: string
}

export interface UpdatePasswordResponse {
  ok: boolean
}

export interface ApiErrorResponse {
  error: string
  retryAfter?: number
  attemptsRemaining?: number
}

// ─── Typed API Error ──────────────────────────────────────────────────────────

export class PasswordResetApiError extends Error {
  public readonly status: number
  public readonly retryAfter?: number
  public readonly attemptsRemaining?: number

  constructor(
    message: string,
    status: number,
    extras?: { retryAfter?: number; attemptsRemaining?: number }
  ) {
    super(message)
    this.name = 'PasswordResetApiError'
    this.status = status
    this.retryAfter = extras?.retryAfter
    this.attemptsRemaining = extras?.attemptsRemaining
  }
}

// ─── Core Fetch Utility ───────────────────────────────────────────────────────

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit & { token?: string }
): Promise<T> {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const { token: _token, ...fetchOptions } = options
  void _token // consumed above

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  })

  const json = (await response.json().catch(() => ({ error: `HTTP ${response.status}` }))) as
    | T
    | ApiErrorResponse

  if (!response.ok) {
    const errBody = json as ApiErrorResponse
    throw new PasswordResetApiError(errBody.error ?? 'Request failed', response.status, {
      retryAfter: errBody.retryAfter,
      attemptsRemaining: errBody.attemptsRemaining,
    })
  }

  return json as T
}

// ─── Public API Functions ─────────────────────────────────────────────────────

/**
 * Step 1: Request a 6-digit OTP to be sent to the provided email.
 * Rate-limited to 1 request per 60 seconds per email.
 */
export async function requestPasswordReset(
  email: string,
  locale: 'en' | 'ru' | 'ky'
): Promise<ResetRequestResponse> {
  return apiFetch<ResetRequestResponse>('/auth/reset-password-request', {
    method: 'POST',
    body: JSON.stringify({ email, locale }),
  })
}

/**
 * Step 2: Verify the OTP code and receive a Firebase Custom Token.
 * The custom token carries the `passwordReset: true` claim.
 */
export async function verifyOtp(email: string, code: string): Promise<VerifyOtpResponse> {
  return apiFetch<VerifyOtpResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
}

/**
 * Step 3: Update the user's password using the Firebase idToken obtained
 * from signing in with the Custom Token returned by verifyOtp().
 */
export async function updatePassword(
  idToken: string,
  newPassword: string
): Promise<UpdatePasswordResponse> {
  return apiFetch<UpdatePasswordResponse>('/me/password', {
    method: 'PATCH',
    token: idToken,
    body: JSON.stringify({ newPassword }),
  })
}
