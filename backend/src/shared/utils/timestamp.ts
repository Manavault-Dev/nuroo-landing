import admin from 'firebase-admin'

/**
 * Create a Firestore timestamp from a Date
 */
export function toTimestamp(date: Date): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(date)
}

/**
 * Create a Firestore timestamp for the current time
 */
export function nowTimestamp(): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(new Date())
}

/**
 * Create a Firestore timestamp for a date in the future
 */
export function futureTimestamp(days: number): admin.firestore.Timestamp {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return admin.firestore.Timestamp.fromDate(date)
}

/**
 * Convert a Firestore timestamp to ISO string
 */
export function toISOString(timestamp: admin.firestore.Timestamp | undefined | null): string | null {
  return timestamp?.toDate?.()?.toISOString() || null
}

/**
 * Check if a timestamp has expired
 */
export function isExpired(timestamp: admin.firestore.Timestamp | undefined | null): boolean {
  if (!timestamp) return false
  return new Date() > timestamp.toDate()
}
