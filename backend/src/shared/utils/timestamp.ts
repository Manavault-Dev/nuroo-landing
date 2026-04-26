import admin from 'firebase-admin'

export function toTimestamp(date: Date): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(date)
}

export function nowTimestamp(): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(new Date())
}

export function futureTimestamp(days: number): admin.firestore.Timestamp {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return admin.firestore.Timestamp.fromDate(date)
}

export function toISOString(
  timestamp: admin.firestore.Timestamp | undefined | null
): string | null {
  return timestamp?.toDate?.()?.toISOString() || null
}

export function isExpired(timestamp: admin.firestore.Timestamp | undefined | null): boolean {
  if (!timestamp) return false
  return new Date() > timestamp.toDate()
}
