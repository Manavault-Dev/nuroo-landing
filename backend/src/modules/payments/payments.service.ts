import crypto from 'crypto'
import { config } from '../../config/index.js'
import {
  createPaymentRecord,
  updatePaymentStatus,
  getPayment,
  getPaymentByFinikTransaction,
  createOrUpdateBillingPlan,
} from './payments.repository.js'
import type { CreatePaymentInput, WebhookInput } from './payments.schema.js'

// Configuration
const FINIK_HOST = 'api.acquiring.averspay.kg'
const FINIK_PATH = '/v1/payment'
const FINIK_URL = `https://${FINIK_HOST}${FINIK_PATH}`
const FINIK_API_KEY = config.FINIK_API_KEY
const FINIK_ACCOUNT_ID = config.FINIK_ACCOUNT_ID
const FINIK_PRIVATE_KEY = config.FINIK_PRIVATE_PEM?.replace(/\\n/g, '\n')
const FINIK_WEBHOOK_URL =
  config.FINIK_WEBHOOK_URL ||
  (config.BACKEND_PUBLIC_URL
    ? `${config.BACKEND_PUBLIC_URL.replace(/\/$/, '')}/webhooks/finik`
    : undefined)
const B2B_URL = config.NEXT_PUBLIC_B2B_URL || 'http://localhost:3000'

const PLANS: Record<string, { price: number; name: string }> = {
  starter: { price: 1500, name: 'Starter' },
  growth: { price: 3500, name: 'Growth' },
  enterprise: { price: 10000, name: 'Enterprise' },
}

// Signature utilities
function deepSort(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(deepSort)
  return Object.keys(obj as Record<string, unknown>)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = deepSort((obj as Record<string, unknown>)[key])
        return acc
      },
      {} as Record<string, unknown>
    )
}

function buildCanonicalString(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: Record<string, unknown>
): string {
  const headerStr = Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase(), v] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('&')

  return `${method.toLowerCase()}\n${path}\n${headerStr}\n${JSON.stringify(deepSort(body))}`
}

function sign(data: string, privateKey: string): string {
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(data, 'utf8')
  signer.end()
  return signer.sign(privateKey, 'base64')
}

// Payment service
export async function createPayment(input: CreatePaymentInput, userId: string) {
  if (!FINIK_API_KEY || !FINIK_ACCOUNT_ID || !FINIK_PRIVATE_KEY) {
    throw new Error('Finik payment system is not configured')
  }

  const plan = PLANS[input.planId]
  if (!plan) {
    throw new Error(`Invalid plan: ${input.planId}`)
  }

  const paymentId = `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const finikPaymentId = crypto.randomUUID()
  const timestamp = Date.now().toString()

  const body: Record<string, unknown> = {
    Amount: plan.price,
    CardType: 'FINIK_QR',
    Data: {
      accountId: FINIK_ACCOUNT_ID,
      description: plan.name,
      merchantCategoryCode: '0742',
      name_en: `Nuroo: ${plan.name}`,
      ...(FINIK_WEBHOOK_URL && { webhookUrl: FINIK_WEBHOOK_URL }),
    },
    PaymentId: finikPaymentId,
    RedirectUrl: `${B2B_URL}/b2b/billing/success?paymentId=${paymentId}`,
  }

  const headers = {
    host: FINIK_HOST,
    'x-api-key': FINIK_API_KEY,
    'x-api-timestamp': timestamp,
  }

  const canonical = buildCanonicalString('POST', FINIK_PATH, headers, body)
  const signature = sign(canonical, FINIK_PRIVATE_KEY)

  const response = await fetch(FINIK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Host: FINIK_HOST,
      'x-api-key': FINIK_API_KEY,
      'x-api-timestamp': timestamp,
      signature,
    },
    body: JSON.stringify(deepSort(body)),
    redirect: 'manual',
  })

  if (response.status !== 302 && !response.ok) {
    const error = await response.text()
    throw new Error(`Finik API error: ${error}`)
  }

  await createPaymentRecord({
    paymentId,
    orgId: input.orgId,
    planId: input.planId,
    amount: plan.price,
    currency: 'KGS',
    status: 'pending',
    finikTransactionId: finikPaymentId,
  })

  const paymentUrl =
    response.status === 302
      ? response.headers.get('location')
      : ((await response.json().catch(() => ({}))) as { paymentUrl?: string }).paymentUrl

  return {
    ok: true,
    paymentId,
    paymentUrl: paymentUrl ?? FINIK_URL,
    transactionId: finikPaymentId,
  }
}

export async function handleWebhook(input: WebhookInput) {
  const payment = await getPaymentByFinikTransaction(input.paymentId)
  if (!payment) {
    return { ok: false, error: 'Payment not found' }
  }

  await updatePaymentStatus(payment.paymentId, input.status, input.paymentId)

  if (input.status === 'completed' && payment.orgId && payment.planId) {
    if (['starter', 'growth', 'enterprise'].includes(payment.planId)) {
      await createOrUpdateBillingPlan(payment.orgId, payment.planId, 30)
    }
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

export const getPlanPrices = () =>
  Object.fromEntries(Object.entries(PLANS).map(([k, v]) => [k, v.price]))
export const getPlanNames = () =>
  Object.fromEntries(Object.entries(PLANS).map(([k, v]) => [k, v.name]))
