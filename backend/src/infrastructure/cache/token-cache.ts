/**
 * Token cache — distributed-ready Firebase token verification cache.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are set (recommended for Cloud Run multi-instance deployments).
 * Falls back to an in-process LRU Map when Redis is not configured.
 *
 * To enable Redis:
 *   1. Create a free Upstash Redis database at https://console.upstash.com
 *   2. Add to backend environment:
 *        UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
 *        UPSTASH_REDIS_REST_TOKEN=AXxx...
 *   3. `npm install @upstash/redis` in backend/
 */

import type { DecodedIdToken } from 'firebase-admin/auth'

const TTL_MS = 5 * 60 * 1000   // 5 min — aligns with Firebase public-key cache
const TTL_S  = TTL_MS / 1000
const MAX_LOCAL_SIZE = 500

// ─── Redis client (lazy, optional) ────────────────────────────────────────────

interface UpstashRedis {
  get(key: string): Promise<string | null>
  set(key: string, value: string, opts: { ex: number }): Promise<unknown>
  del(key: string): Promise<unknown>
}

let redis: UpstashRedis | null = null

async function getRedis(): Promise<UpstashRedis | null> {
  if (redis !== null) return redis

  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  try {
    // Dynamic import so the package is optional — won't crash if not installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('@upstash/redis' as any)
    const RedisClass = mod.Redis ?? mod.default?.Redis
    redis = new RedisClass({ url, token }) as UpstashRedis
    console.log('[TokenCache] Using Upstash Redis 🟢')
  } catch {
    console.warn('[TokenCache] @upstash/redis not installed — falling back to in-process Map')
    redis = null
  }
  return redis
}

// ─── Local LRU fallback ────────────────────────────────────────────────────────

const localCache = new Map<string, { decoded: DecodedIdToken; expiresAt: number }>()

function localGet(token: string): DecodedIdToken | null {
  const entry = localCache.get(token)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) { localCache.delete(token); return null }
  return entry.decoded
}

function localSet(token: string, decoded: DecodedIdToken, expiresAt: number): void {
  localCache.set(token, { decoded, expiresAt })
  if (localCache.size > MAX_LOCAL_SIZE) {
    const oldest = localCache.keys().next().value
    if (oldest) localCache.delete(oldest)
  }
}

function localDel(token: string): void {
  localCache.delete(token)
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function cacheGet(token: string): Promise<DecodedIdToken | null> {
  const r = await getRedis()
  if (r) {
    try {
      const raw = await r.get(`tkn:${token}`)
      if (!raw) return null
      return JSON.parse(raw) as DecodedIdToken
    } catch { /* Redis error — fall through to local */ }
  }
  return localGet(token)
}

export async function cacheSet(token: string, decoded: DecodedIdToken, tokenExpMs: number): Promise<void> {
  const expiresAt = Math.min(Date.now() + TTL_MS, tokenExpMs)
  const r = await getRedis()
  if (r) {
    try {
      const ttlSeconds = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000))
      await r.set(`tkn:${token}`, JSON.stringify(decoded), { ex: Math.min(ttlSeconds, TTL_S) })
      return
    } catch { /* Redis error — fall through to local */ }
  }
  localSet(token, decoded, expiresAt)
}

export async function cacheDel(token: string): Promise<void> {
  const r = await getRedis()
  if (r) {
    try { await r.del(`tkn:${token}`); return } catch { /* fall through */ }
  }
  localDel(token)
}
