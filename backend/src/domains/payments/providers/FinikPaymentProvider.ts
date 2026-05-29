import crypto from 'crypto'
import { createRequire } from 'module'
import { config } from '../../../config/index.js'
import type {
  PaymentProvider,
  CreateInvoiceInput,
  InvoiceResult,
  PaymentStatus,
  WebhookResult,
} from './PaymentProvider.interface.js'

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

export interface FinikProviderConfig {
  apiUrl?: string
  apiKey?: string
  accountId?: string
  privatePem?: string
  webhookSecret?: string
}

export class FinikPaymentProvider implements PaymentProvider {
  readonly name = 'finik'

  private readonly apiUrl: string
  private readonly apiKey: string
  private readonly accountId: string
  private readonly privatePem: string
  private readonly webhookSecret: string

  constructor(orgConfig?: FinikProviderConfig) {
    this.apiUrl =
      orgConfig?.apiUrl || config.FINIK_API_URL || 'https://api.acquiring.averspay.kg/payment'
    this.apiKey = orgConfig?.apiKey || config.FINIK_API_KEY || ''
    this.accountId = orgConfig?.accountId || config.FINIK_ACCOUNT_ID || ''
    this.privatePem = (orgConfig?.privatePem || config.FINIK_PRIVATE_PEM || '').replace(
      /\\n/g,
      '\n'
    )
    this.webhookSecret = orgConfig?.webhookSecret || config.FINIK_WEBHOOK_SECRET || ''
  }

  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceResult> {
    if (!this.apiKey || !this.accountId || !this.privatePem) {
      throw new Error('Finik payment provider is not fully configured')
    }

    const parsed = new URL(this.apiUrl)
    const host = parsed.hostname
    const path = parsed.pathname
    const timestamp = Date.now().toString()

    const body: Record<string, unknown> = {
      Amount: input.amount,
      CardType: 'FINIK_QR',
      Data: {
        accountId: this.accountId,
        description: input.description,
        merchantCategoryCode: '0742',
        name_en: input.description,
        webhookUrl: input.callbackUrl,
        reference: `${input.orgId}__${input.invoiceId}`,
      },
      PaymentId: input.invoiceId,
      RedirectUrl: input.returnUrl,
    }

    const signer = new Signer({
      httpMethod: 'POST',
      path,
      headers: {
        Host: host,
        'x-api-key': this.apiKey,
        'x-api-timestamp': timestamp,
      },
      body,
    })

    const signature = await signer.sign(this.privatePem)

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'x-api-timestamp': timestamp,
        signature,
      },
      body: JSON.stringify(shallowSort(body)),
      redirect: 'manual',
    })

    if (response.status !== 302 && !response.ok) {
      const errText = await response.text()
      throw new Error(`Finik API error: ${response.status}`)
    }

    const paymentUrl =
      response.status === 302
        ? (response.headers.get('location') ?? this.apiUrl)
        : ((await response.json().catch(() => ({}))) as { paymentUrl?: string }).paymentUrl ??
          this.apiUrl

    return {
      providerPaymentId: input.invoiceId,
      paymentUrl,
      status: 'pending',
    }
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus> {
    if (!this.apiKey) {
      throw new Error('Finik payment provider is not fully configured')
    }

    const parsed = new URL(this.apiUrl)
    const host = parsed.hostname
    const statusPath = `${parsed.pathname}/${providerPaymentId}/status`
    const timestamp = Date.now().toString()

    const statusUrl = `${parsed.protocol}//${host}${statusPath}`

    const signer = new Signer({
      httpMethod: 'GET',
      path: statusPath,
      headers: {
        Host: host,
        'x-api-key': this.apiKey,
        'x-api-timestamp': timestamp,
      },
      body: {},
    })

    const signature = await signer.sign(this.privatePem)

    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey,
        'x-api-timestamp': timestamp,
        signature,
      },
    })

    if (!response.ok) {
      throw new Error(`Finik status check failed: ${response.status}`)
    }

    const data = (await response.json()) as { status?: string }
    return mapFinikStatus(data.status)
  }

  async handleWebhook(payload: unknown, headers: Record<string, string>): Promise<WebhookResult> {
    if (!this.webhookSecret) {
      throw new Error('Webhook secret is not configured')
    }

    const rawBody =
      typeof payload === 'string'
        ? payload
        : Buffer.isBuffer(payload)
          ? payload.toString('utf8')
          : JSON.stringify(payload)

    const receivedSig = headers['x-signature'] || headers['x-webhook-signature'] || ''
    const expectedSig = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex')

    const receivedBuf = Buffer.from(receivedSig, 'hex')
    const expectedBuf = Buffer.from(expectedSig, 'hex')

    if (
      receivedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(receivedBuf, expectedBuf)
    ) {
      throw new Error('Invalid webhook signature')
    }

    const data =
      typeof payload === 'string'
        ? (JSON.parse(payload) as Record<string, unknown>)
        : (payload as Record<string, unknown>)

    const rawRef = (data.reference as string | undefined) || ''
    const rawPaymentId =
      (data.PaymentId as string | undefined) ||
      (data.paymentId as string | undefined) ||
      ''

    // Reference may be composite `${orgId}__${invoiceId}` — extract the invoice part
    let invoiceId: string
    if (rawRef.includes('__')) {
      invoiceId = rawRef.slice(rawRef.indexOf('__') + 2)
    } else {
      invoiceId = rawRef || rawPaymentId
    }

    const providerPaymentId =
      (data.transactionId as string | undefined) ||
      rawPaymentId ||
      invoiceId

    const rawStatus = (data.status as string | undefined) || (data.Status as string | undefined)
    const status = mapFinikStatus(rawStatus)

    const paidAt = status === 'paid' ? new Date() : undefined

    return {
      invoiceId,
      providerPaymentId,
      status,
      paidAt,
    }
  }

  async cancelInvoice(providerPaymentId: string): Promise<void> {
    if (!this.apiKey || !this.privatePem) {
      throw new Error('Finik payment provider is not fully configured')
    }

    const parsed = new URL(this.apiUrl)
    const host = parsed.hostname
    const cancelPath = `${parsed.pathname}/${providerPaymentId}/cancel`
    const timestamp = Date.now().toString()
    const cancelUrl = `${parsed.protocol}//${host}${cancelPath}`

    const body = { PaymentId: providerPaymentId }

    const signer = new Signer({
      httpMethod: 'POST',
      path: cancelPath,
      headers: {
        Host: host,
        'x-api-key': this.apiKey,
        'x-api-timestamp': timestamp,
      },
      body,
    })

    const signature = await signer.sign(this.privatePem)

    const response = await fetch(cancelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'x-api-timestamp': timestamp,
        signature,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Finik cancel failed: ${response.status}`)
    }
  }

  async validateConfig(cfg: Record<string, string>): Promise<{ valid: boolean; error?: string }> {
    const merchantId = cfg.merchantId
    if (!merchantId || merchantId.trim() === '') {
      return { valid: false, error: 'merchantId is required' }
    }
    return { valid: true }
  }
}

function mapFinikStatus(raw?: string): PaymentStatus {
  if (!raw) return 'pending'
  const s = raw.toLowerCase()
  if (s === 'completed' || s === 'success' || s === 'paid') return 'paid'
  if (s === 'failed' || s === 'error' || s === 'declined') return 'failed'
  if (s === 'expired') return 'expired'
  if (s === 'canceled' || s === 'cancelled') return 'canceled'
  return 'pending'
}
