import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'
import type { Analytics } from 'firebase/analytics'

// Next.js automatically loads .env.local, .env.development, .env.production
// based on NODE_ENV, so we just use the standard variable names
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined
let analytics: Analytics | undefined
let analyticsPromise: Promise<Analytics | undefined> | null = null

if (typeof window !== 'undefined') {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig)
      } else {
        app = getApps()[0]
      }
      auth = getAuth(app)
      db = getFirestore(app)
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error)
    }
  }
}

export function getClientAnalytics(): Promise<Analytics | undefined> {
  if (typeof window === 'undefined' || !app) {
    return Promise.resolve(undefined)
  }

  if (analytics) {
    return Promise.resolve(analytics)
  }

  if (analyticsPromise) {
    return analyticsPromise
  }

  analyticsPromise = import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      const supported = await isSupported()
      if (!supported || !app) return undefined

      try {
        analytics = getAnalytics(app)
        return analytics
      } catch {
        return undefined
      }
    })
    .catch(() => undefined)
    .finally(() => {
      analyticsPromise = null
    })

  return analyticsPromise
}

export { auth, db }
