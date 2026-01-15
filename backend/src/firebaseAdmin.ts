import admin from 'firebase-admin'
import { config } from './config.js'

let app: admin.app.App | null = null

export function initializeFirebaseAdmin() {
  if (app) return app

  if (!config.FIREBASE_PROJECT_ID && !config.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn('⚠️ Firebase Admin not configured')
    return null
  }

  try {
    if (config.FIREBASE_CLIENT_EMAIL && config.FIREBASE_PRIVATE_KEY && config.FIREBASE_PROJECT_ID) {
      const privateKey = config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.FIREBASE_PROJECT_ID,
          clientEmail: config.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
        projectId: config.FIREBASE_PROJECT_ID,
      })
      console.log('✅ Firebase Admin initialized')
      return app
    }
    
    if (config.GOOGLE_APPLICATION_CREDENTIALS) {
      app = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: config.FIREBASE_PROJECT_ID,
      })
      console.log('✅ Firebase Admin initialized')
      return app
    }

    console.warn('⚠️ Firebase Admin credentials incomplete')
    return null
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error)
    return null
  }
}

export function getFirestore() {
  if (!app) app = initializeFirebaseAdmin()
  if (!app) throw new Error('Firebase Admin not initialized')
  return admin.firestore()
}

export function getAuth() {
  if (!app) app = initializeFirebaseAdmin()
  if (!app) throw new Error('Firebase Admin not initialized')
  return admin.auth()
}
