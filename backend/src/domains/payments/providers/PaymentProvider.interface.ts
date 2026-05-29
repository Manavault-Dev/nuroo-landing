export interface CreateInvoiceInput {
  orgId: string
  parentId: string
  childId: string
  amount: number
  currency: 'KGS'
  description: string
  dueDate: string // ISO date
  invoiceId: string // our internal ID used as external reference
  callbackUrl: string // webhook URL
  returnUrl: string // where parent is redirected after payment
}

export interface InvoiceResult {
  providerPaymentId: string
  paymentUrl: string
  status: 'pending'
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'canceled'
export type InvoiceStatus = PaymentStatus | 'upcoming' | 'overdue'

export interface WebhookResult {
  invoiceId: string // our internal invoice ID (from reference)
  providerPaymentId: string
  status: PaymentStatus
  paidAt?: Date
}

export interface PaymentProvider {
  readonly name: string
  createInvoice(input: CreateInvoiceInput): Promise<InvoiceResult>
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus>
  handleWebhook(payload: unknown, headers: Record<string, string>): Promise<WebhookResult>
  cancelInvoice(providerPaymentId: string): Promise<void>
  validateConfig(config: Record<string, string>): Promise<{ valid: boolean; error?: string }>
}
