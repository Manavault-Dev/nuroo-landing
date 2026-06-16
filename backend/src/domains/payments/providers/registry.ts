import type { Firestore } from 'firebase-admin/firestore'
import type { PaymentProvider } from './PaymentProvider.interface.js'
import { FinikPaymentProvider } from './FinikPaymentProvider.js'

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
    return new FinikPaymentProvider({
      accountId: (data.merchantId as string | undefined) || undefined,
      apiKey: (data.apiKey as string | undefined) || undefined,
      apiUrl: (data.apiUrl as string | undefined) || undefined,
      privatePem: (data.privatePem as string | undefined) || undefined,
      webhookSecret: (data.webhookSecret as string | undefined) || undefined,
    })
  }

  return null
}
