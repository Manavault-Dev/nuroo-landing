/**
 * token-cache.ts — in-process LRU cache for Firebase ID token verification.
 *
 * Firebase's verifyIdToken() validates a JWT signature locally (after caching
 * the public keys on first call). The bottleneck is the first call per instance.
 * This cache prevents redundant verifications within the same Cloud Run instance
 * for the duration of the token's lifetime (capped at 5 min).
 *
 * If multi-instance cache sharing is needed in the future, swap the Map for
 * an Upstash Redis client — the public API (cacheGet / cacheSet / cacheDel)
 * stays the same.
 */

import type { DecodedIdToken } from 'firebase-admin/auth'

const TTL_MS = 5 * 60 * 1000 // 5 min
const MAX_SIZE = 500 // max tokens in memory

const store = new Map<string, { decoded: DecodedIdToken; expiresAt: number }>()

export function cacheGet(token: string): DecodedIdToken | null {
  const entry = store.get(token)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    store.delete(token)
    return null
  }
  return entry.decoded
}

export function cacheSet(token: string, decoded: DecodedIdToken, tokenExpMs: number): void {
  const expiresAt = Math.min(Date.now() + TTL_MS, tokenExpMs)
  store.set(token, { decoded, expiresAt })
  if (store.size > MAX_SIZE) {
    const oldest = store.keys().next().value
    if (oldest) store.delete(oldest)
  }
}

export function cacheDel(token: string): void {
  store.delete(token)
}
