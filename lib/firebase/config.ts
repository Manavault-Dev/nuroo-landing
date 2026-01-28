import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'

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

if (typeof window !== 'undefined') {
  const env = process.env.NODE_ENV || 'development'

  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig)
        console.log(`✅ [FIREBASE] Frontend initialized for ${env} environment`)
        console.log(`📋 [FIREBASE] Using project: ${firebaseConfig.projectId}`)
      } else {
        app = getApps()[0]
      }
      auth = getAuth(app)
      db = getFirestore(app)
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error)
    }
  } else {
    console.warn(
      '⚠️ Firebase config is missing. B2B authentication will not work. Add Firebase config to .env files'
    )
  }
}

export { auth, db }
