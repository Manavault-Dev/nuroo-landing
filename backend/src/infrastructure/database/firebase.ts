import admin from 'firebase-admin'
import { config } from '../../config/index.js'

let app: admin.app.App | null = null

export function initializeFirebaseAdmin() {
  if (app) return app

  const env = config.NODE_ENV
  const projectId = config.FIREBASE_PROJECT_ID

  if (!projectId && !config.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn('Firebase Admin not configured')
    return null
  }

  console.log(`[FIREBASE] Initializing Firebase Admin for ${env} environment`)
  console.log(`[FIREBASE] Project ID: ${projectId}`)

  try {
    if (config.FIREBASE_CLIENT_EMAIL && config.FIREBASE_PRIVATE_KEY && projectId) {
      const privateKey = config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: config.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
        projectId,
      })
      console.log(`[FIREBASE] Firebase Admin initialized for ${env} environment`)
      console.log(`[FIREBASE] Using project: ${projectId}`)
      return app
    }

    app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    })
    console.log(`[FIREBASE] Firebase Admin initialized using application default credentials`)
    console.log(`[FIREBASE] Using project: ${projectId}`)
    return app
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error)
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

export function getStorage() {
  if (!app) app = initializeFirebaseAdmin()
  if (!app) throw new Error('Firebase Admin not initialized')
  return admin.storage()
}

export async function getStorageBucket() {
  const storage = getStorage()
  const projectId = getApp().options.projectId
  const configuredBucket = getApp().options.storageBucket
  const candidates = [
    configuredBucket,
    `${projectId}.firebasestorage.app`,
    `${projectId}.appspot.com`,
  ].filter(Boolean) as string[]
  for (const name of candidates) {
    try {
      const bucket = storage.bucket(name)
      const [exists] = await bucket.exists()
      if (exists) return bucket
    } catch {
      continue
    }
  }
  throw new Error('Storage bucket not found. Check FIREBASE_STORAGE_BUCKET config.')
}

export function getApp() {
  if (!app) app = initializeFirebaseAdmin()
  if (!app) throw new Error('Firebase Admin not initialized')
  return app
}

export { admin }
