import admin from 'firebase-admin'
import { getFirestore } from '../../infrastructure/database/firebase.js'

const db = getFirestore()

export interface PaymentRecord {
  paymentId: string
  orgId: string
  planId: string
  amount: number
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  finikTransactionId?: string
  createdAt: admin.firestore.Timestamp
  updatedAt: admin.firestore.Timestamp
  completedAt?: admin.firestore.Timestamp
}

export type BillingPlanId = 'starter' | 'growth' | 'enterprise'

export interface BillingPlan {
  planId: string
  orgId: string
  status: 'active' | 'expired' | 'cancelled'
  currentPlan: BillingPlanId | null
  expiresAt?: admin.firestore.Timestamp
  createdAt: admin.firestore.Timestamp
  updatedAt: admin.firestore.Timestamp
}

export async function createPaymentRecord(payment: Omit<PaymentRecord, 'createdAt' | 'updatedAt'>) {
  const now = admin.firestore.Timestamp.now()
  const paymentRef = db.collection('payments').doc(payment.paymentId)

  await paymentRef.set({
    ...payment,
    createdAt: now,
    updatedAt: now,
  })

  return paymentRef
}

export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentRecord['status'],
  finikTransactionId?: string
) {
  const paymentRef = db.collection('payments').doc(paymentId)
  const updateData: any = {
    status,
    updatedAt: admin.firestore.Timestamp.now(),
  }

  if (status === 'completed') {
    updateData.completedAt = admin.firestore.Timestamp.now()
  }

  if (finikTransactionId) {
    updateData.finikTransactionId = finikTransactionId
  }

  await paymentRef.update(updateData)
  return paymentRef
}

export async function getPayment(paymentId: string) {
  const paymentRef = db.collection('payments').doc(paymentId)
  const snapshot = await paymentRef.get()

  if (!snapshot.exists) {
    return null
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as PaymentRecord & { id: string }
}

export async function getPaymentByFinikTransaction(finikTransactionId: string) {
  const snapshot = await db
    .collection('payments')
    .where('finikTransactionId', '==', finikTransactionId)
    .limit(1)
    .get()

  if (snapshot.empty) {
    return null
  }

  const doc = snapshot.docs[0]
  return {
    id: doc.id,
    ...doc.data(),
  } as PaymentRecord & { id: string }
}

export async function getBillingPlan(orgId: string) {
  const billingRef = db.collection('organizations').doc(orgId).collection('billing').doc('current')
  const snapshot = await billingRef.get()

  if (!snapshot.exists) {
    return null
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as BillingPlan & { id: string }
}

export async function createOrUpdateBillingPlan(
  orgId: string,
  planId: BillingPlanId,
  expiresInDays: number = 30
) {
  const billingRef = db.collection('organizations').doc(orgId).collection('billing').doc('current')
  const now = admin.firestore.Timestamp.now()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  const billingData: BillingPlan = {
    planId,
    orgId,
    status: 'active',
    currentPlan: planId,
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    createdAt: now,
    updatedAt: now,
  }

  const snapshot = await billingRef.get()
  if (snapshot.exists) {
    await billingRef.update({
      ...billingData,
      createdAt: snapshot.data()?.createdAt || now,
    })
  } else {
    await billingRef.set(billingData)
  }

  await db.collection('organizations').doc(orgId).update({
    billingPlan: planId,
    billingStatus: 'active',
    billingUpdatedAt: now,
  })

  return billingRef
}
