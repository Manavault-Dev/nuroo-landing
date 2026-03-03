import admin from 'firebase-admin';
/**
 * Create a Firestore timestamp from a Date
 */
export function toTimestamp(date) {
    return admin.firestore.Timestamp.fromDate(date);
}
/**
 * Create a Firestore timestamp for the current time
 */
export function nowTimestamp() {
    return admin.firestore.Timestamp.fromDate(new Date());
}
/**
 * Create a Firestore timestamp for a date in the future
 */
export function futureTimestamp(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return admin.firestore.Timestamp.fromDate(date);
}
/**
 * Convert a Firestore timestamp to ISO string
 */
export function toISOString(timestamp) {
    return timestamp?.toDate?.()?.toISOString() || null;
}
/**
 * Check if a timestamp has expired
 */
export function isExpired(timestamp) {
    if (!timestamp)
        return false;
    return new Date() > timestamp.toDate();
}
//# sourceMappingURL=timestamp.js.map