import crypto from 'crypto'
import { createRequire } from 'module'
import { config } from '../../config/index.js'
import {
  createPaymentRecord,
  updatePaymentStatus,
  getPayment,
  getPaymentByFinikTransaction,
  createOrUpdateBillingPlan,
} from './payments.repository.js'
import type { CreatePaymentInput, WebhookInput } from './payments.schema.js'

// Official Finik signing library (@mancho.devs/authorizer)
const _require = createRequire(import.meta.url)
const { Signer } = _require('@mancho.devs/authorizer') as {
  Signer: new (data: {
    httpMethod: string
    path: string
    headers: Record<string, string>
    body: Record<string, unknown>
  }) => {
    sign(privateKey: string): Promise<string>
    getData(): string
  }
}

// Configuration
const _finikRawUrl = config.FINIK_API_URL || 'https://api.acquiring.averspay.kg/payment'
const _finikParsed = new URL(_finikRawUrl)
const FINIK_HOST = _finikParsed.hostname
const FINIK_PATH = _finikParsed.pathname
const FINIK_URL = _finikRawUrl
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

// Shallow sort — matches official Finik library behavior
function shallowSort(body: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(body)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce(
      (acc, [k, v]) => {
        acc[k] = v
        return acc
      },
      {} as Record<string, unknown>
    )
}

// Payment service
export async function createPayment(input: CreatePaymentInput, _userId: string) {
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

  // Sign using the official Finik authorizer package
  const signer = new Signer({
    httpMethod: 'POST',
    path: FINIK_PATH,
    headers: {
      Host: FINIK_HOST,
      'x-api-key': FINIK_API_KEY,
      'x-api-timestamp': timestamp,
    },
    body,
  })

  const canonical = signer.getData()
  const signature = await signer.sign(FINIK_PRIVATE_KEY)

  if (config.FINIK_DEBUG_SIGNATURE === '1') {
    console.log('[FINIK DEBUG] URL:', FINIK_URL)
    console.log('[FINIK DEBUG] canonical:\n', canonical)
    console.log('[FINIK DEBUG] signature (first 40):', signature.substring(0, 40))
  }

  const response = await fetch(FINIK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': FINIK_API_KEY,
      'x-api-timestamp': timestamp,
      signature,
    },
    body: JSON.stringify(shallowSort(body)),
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
    const planId = payment.planId
    if (planId === 'starter' || planId === 'growth' || planId === 'enterprise') {
      await createOrUpdateBillingPlan(payment.orgId, planId, 30)
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
