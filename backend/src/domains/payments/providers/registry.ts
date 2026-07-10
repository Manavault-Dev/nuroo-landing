import type { Firestore } from 'firebase-admin/firestore'
import type { PaymentProvider } from './PaymentProvider.interface.js'
import { FinikPaymentProvider } from './FinikPaymentProvider.js'
import { config } from '../../../config/index.js'

export async function getOrgPaymentProvider(
  db: Firestore,
  orgId: string,
  providerName: 'finik'
): Promise<PaymentProvider | null> {
  const snap = await db.doc(`organizations/${orgId}/paymentProviders/${providerName}`).get()

  if (!snap.exists) return null

  const data = snap.data() as Record<string, unknown>
  if (!data || data.enabled !== true) return null

  if (providerName === 'finik') {
    // Org stores only merchantId. API key and signing credentials come from
    // the platform-level env vars — one key for the whole platform, per-org merchant accounts.
    return new FinikPaymentProvider({
      accountId: (data.merchantId as string | undefined) || undefined,
      apiKey: (data.apiKey as string | undefined) || config.FINIK_API_KEY || undefined,
      apiUrl: (data.apiUrl as string | undefined) || config.FINIK_API_URL || undefined,
      privatePem: (data.privatePem as string | undefined) || config.FINIK_PRIVATE_PEM || undefined,
      webhookSecret:
        (data.webhookSecret as string | undefined) || config.FINIK_WEBHOOK_SECRET || undefined,
    })
  }

  return null
}
