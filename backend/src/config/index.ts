import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { envSchema, type Env } from './env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Load .env from backend folder (works when running from repo root or from backend/)
const backendDir = path.resolve(__dirname, '../..')
const envPath = path.join(backendDir, '.env')
const loaded = dotenv.config({ path: envPath })
if (loaded.error && process.env.NODE_ENV !== 'production') {
  console.warn('[config] No .env file at', envPath, '- using process.env')
}

const rawConfig = envSchema.parse(process.env)

// Select Firebase credentials based on environment
function getFirebaseConfig(raw: Env) {
  const env = raw.NODE_ENV

  if (env === 'development' && raw.FIREBASE_DEV_PROJECT_ID) {
    return {
      projectId: raw.FIREBASE_DEV_PROJECT_ID,
      clientEmail: raw.FIREBASE_DEV_CLIENT_EMAIL,
      privateKey: raw.FIREBASE_DEV_PRIVATE_KEY,
    }
  }

  if (env === 'production' && raw.FIREBASE_PROD_PROJECT_ID) {
    return {
      projectId: raw.FIREBASE_PROD_PROJECT_ID,
      clientEmail: raw.FIREBASE_PROD_CLIENT_EMAIL,
      privateKey: raw.FIREBASE_PROD_PRIVATE_KEY,
    }
  }

  // Fallback to default credentials
  return {
    projectId: raw.FIREBASE_PROJECT_ID,
    clientEmail: raw.FIREBASE_CLIENT_EMAIL,
    privateKey: raw.FIREBASE_PRIVATE_KEY,
  }
}

const firebaseConfig = getFirebaseConfig(rawConfig)

export const config = {
  ...rawConfig,
  // Override with environment-specific config
  FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  FIREBASE_CLIENT_EMAIL: firebaseConfig.clientEmail,
  FIREBASE_PRIVATE_KEY: firebaseConfig.privateKey,
}

export type Config = typeof config
