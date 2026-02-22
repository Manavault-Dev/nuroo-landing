import crypto from 'crypto'
import { config } from '../../config/index.js'
import {
  createPaymentRecord,
  updatePaymentStatus,
  getPayment,
  getPaymentByFinikTransaction,
  createOrUpdateBillingPlan,
  type PaymentRecord,
} from './payments.repository.js'
import type { CreatePaymentInput, WebhookInput } from './payments.schema.js'

// Finik Acquiring API: https://www.finik.kg/for-developers/
const FINIK_BASE_URL = (config.FINIK_API_URL || 'https://api.acquiring.averspay.kg').replace(/\/payment\/?$/, '')
const FINIK_API_KEY = config.FINIK_API_KEY
const FINIK_ACCOUNT_ID = config.FINIK_ACCOUNT_ID
// Ensure PEM has real newlines (dotenv may leave literal \n in some setups)
const FINIK_PRIVATE_PEM = config.FINIK_PRIVATE_PEM?.replace(/\\n/g, '\n')
const B2B_URL = config.NEXT_PUBLIC_B2B_URL || 'http://localhost:3000'
// Webhook URL for Finik: explicit FINIK_WEBHOOK_URL or BACKEND_PUBLIC_URL + /webhooks/finik
const FINIK_WEBHOOK_URL =
  config.FINIK_WEBHOOK_URL ||
  (config.BACKEND_PUBLIC_URL ? `${config.BACKEND_PUBLIC_URL.replace(/\/$/, '')}/webhooks/finik` : undefined)

/** JSON with sorted keys so canonical string is deterministic (Finik may verify the same way). */
function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']'
  const keys = Object.keys(obj as object).sort()
  const o = obj as Record<string, unknown>
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(o[k])).join(',') + '}'
}

/**
 * Sign request for Finik Acquiring API (RSA-SHA256).
 * Try: only x-api-* headers in canonical string (request only sends those + signature).
 * stringToSign = Method + "\n" + Path + "\n" + Headers + "\n" + Body.
 */
function signFinikRequest(
  method: string,
  path: string,
  apiKey: string,
  timestamp: string,
  bodyJson: string,
  privatePem: string
): string {
  const headerLines = [`x-api-key:${apiKey}`, `x-api-timestamp:${timestamp}`].join('\n')
  const stringToSign = [method, path, headerLines, bodyJson].join('\n')
  if (config.FINIK_DEBUG_SIGNATURE === '1') {
    const masked = stringToSign.replace(apiKey, '[API_KEY]')
    console.log('[Finik debug] String we sign (masked):\n---\n' + masked + '\n---')
  }
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(stringToSign, 'utf8')
  return sign.sign({ key: privatePem }, 'base64')
}

const PLAN_PRICES: Record<string, number> = {
  basic: 1000,
  professional: 3000,
  enterprise: 8000,
}

const PLAN_NAMES: Record<string, string> = {
  basic: 'Basic Plan',
  professional: 'Professional Plan',
  enterprise: 'Enterprise Plan',
}

function randomUuid(): string {
  const hex = (n: number) => Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(n, '0')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`
}

export async function createPayment(input: CreatePaymentInput, userId: string) {
  const missing: string[] = []
  if (!FINIK_API_KEY) missing.push('FINIK_API_KEY')
  if (!FINIK_ACCOUNT_ID) missing.push('FINIK_ACCOUNT_ID')
  if (!FINIK_PRIVATE_PEM) missing.push('FINIK_PRIVATE_PEM')
  if (missing.length > 0) {
    throw new Error(
      `Finik payment system is not configured. Add to backend/.env: ${missing.join(', ')}`
    )
  }

  const amount = PLAN_PRICES[input.planId]
  const planName = PLAN_NAMES[input.planId]

  if (!amount) {
    throw new Error(`Invalid plan ID: ${input.planId}`)
  }

  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const finikPaymentId = randomUuid()
  const successUrl = `${B2B_URL}/b2b/billing/success?paymentId=${paymentId}`
  const timestamp = Date.now().toString()

  const host = new URL(FINIK_BASE_URL).host
  const path = '/v1/payment'
  const dataObj: Record<string, unknown> = {
    accountId: FINIK_ACCOUNT_ID,
    merchantCategoryCode: '0742',
    name_en: `Nuroo: ${planName}`,
    description: planName,
  }
  if (FINIK_WEBHOOK_URL) dataObj.webhookUrl = FINIK_WEBHOOK_URL

  const body: Record<string, unknown> = {
    Amount: amount * 100, // tiyiyn (1 KGS = 100 tiyiyn)
    CardType: 'FINIK_QR',
    PaymentId: finikPaymentId,
    RedirectUrl: successUrl,
    Data: dataObj,
  }

  try {
    // Use canonical (sorted-key) JSON so signature matches what Finik expects
    const bodyStr = canonicalJson(body)
    const signature = signFinikRequest('POST', path, FINIK_API_KEY, timestamp, bodyStr, FINIK_PRIVATE_PEM)
    const url = `${FINIK_BASE_URL}${path}`
    const finikResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: host,
        'x-api-key': FINIK_API_KEY,
        'x-api-timestamp': timestamp,
        signature,
      },
      body: bodyStr,
      redirect: 'manual',
    })

    if (!finikResponse.ok && finikResponse.status !== 302) {
      const errorText = await finikResponse.text()
      throw new Error(`Finik API error: ${errorText}`)
    }

    const paymentRecord: Omit<PaymentRecord, 'createdAt' | 'updatedAt'> = {
      paymentId,
      orgId: input.orgId,
      planId: input.planId,
      amount,
      currency: 'KGS',
      status: 'pending',
      finikTransactionId: finikPaymentId,
    }
    await createPaymentRecord(paymentRecord)

    let paymentUrl: string | undefined
    if (finikResponse.status === 302) {
      paymentUrl = finikResponse.headers.get('location') ?? undefined
    } else {
      try {
        const finikData = await finikResponse.json() as { paymentUrl?: string; url?: string; redirectUrl?: string }
        paymentUrl = finikData.paymentUrl ?? finikData.url ?? finikData.redirectUrl
      } catch {
        // ignore
      }
    }

    return {
      ok: true,
      paymentId,
      paymentUrl: paymentUrl ?? url,
      qrCode: undefined,
      transactionId: finikPaymentId,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Error creating payment:', error)
    throw new Error(`Failed to create payment: ${msg}`)
  }
}

export async function handleWebhook(input: WebhookInput) {
  const payment = await getPaymentByFinikTransaction(input.paymentId)

  if (!payment) {
    console.warn(`Payment not found for transaction: ${input.paymentId}`)
    return { ok: false, error: 'Payment not found' }
  }

  await updatePaymentStatus(payment.paymentId, input.status, input.paymentId)

  if (input.status === 'completed' && payment.orgId && payment.planId) {
    await createOrUpdateBillingPlan(payment.orgId, payment.planId as any, 30)
  }

  return { ok: true, paymentId: payment.paymentId }
}

export async function verifyPayment(paymentId: string) {
  const payment = await getPayment(paymentId)

  if (!payment) {
    return { ok: false, error: 'Payment not found' }
  }

  return {
    ok: true,
    payment: {
      id: payment.paymentId,
      status: payment.status,
      planId: payment.planId,
      amount: payment.amount,
      currency: payment.currency,
    },
  }
}

export function getPlanPrices() {
  return PLAN_PRICES
}

export function getPlanNames() {
  return PLAN_NAMES
}
