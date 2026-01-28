import dotenv from 'dotenv'
import { z } from 'zod'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment-specific .env files
// Priority: .env.{NODE_ENV} > .env.local > .env
// IMPORTANT: .env.{NODE_ENV} loads LAST to override .env.local
// This ensures environment-specific settings always win
const nodeEnv = process.env.NODE_ENV || 'development'

console.log(`🔧 [CONFIG] Loading environment: ${nodeEnv}`)
console.log(
  `🔧 [CONFIG] NODE_ENV from process.env: ${process.env.NODE_ENV || 'undefined (defaulting to development)'}`
)

// Load in order of priority (later files override earlier ones)
// Files are in backend/ directory
// 1. Base .env (lowest priority)
const baseEnvPath = path.join(__dirname, '../.env')
if (fs.existsSync(baseEnvPath)) {
  const result = dotenv.config({ path: baseEnvPath })
  console.log(`📋 [CONFIG] Loaded .env: ${result.error ? 'ERROR: ' + result.error.message : 'OK'}`)
  if (!result.error) {
    console.log(
      `📋 [CONFIG] FIREBASE_PROJECT_ID from .env: ${process.env.FIREBASE_PROJECT_ID || 'not set'}`
    )
  }
} else {
  console.log(`📋 [CONFIG] .env not found`)
}

// 2. .env.local (for local overrides, but will be overridden by .env.{NODE_ENV})
const localPath = path.join(__dirname, '../.env.local')
if (fs.existsSync(localPath)) {
  const result = dotenv.config({ path: localPath })
  console.log(
    `📋 [CONFIG] Loaded .env.local: ${result.error ? 'ERROR: ' + result.error.message : 'OK'}`
  )
  if (!result.error) {
    console.log(
      `📋 [CONFIG] FIREBASE_PROJECT_ID from .env.local: ${process.env.FIREBASE_PROJECT_ID || 'not set'}`
    )
  }
} else {
  console.log(`📋 [CONFIG] .env.local not found`)
}

// 3. Environment-specific .env.{NODE_ENV} (HIGHEST priority - loads LAST)
// This ensures .env.development or .env.production always wins
const envSpecificPath = path.join(__dirname, `../.env.${nodeEnv}`)
if (fs.existsSync(envSpecificPath)) {
  const result = dotenv.config({ path: envSpecificPath })
  console.log(
    `✅ [CONFIG] Loaded .env.${nodeEnv}: ${result.error ? 'ERROR: ' + result.error.message : 'OK'}`
  )
  if (!result.error) {
    console.log(
      `✅ [CONFIG] FIREBASE_PROJECT_ID from .env.${nodeEnv}: ${process.env.FIREBASE_PROJECT_ID || 'not set'}`
    )
  }
} else {
  console.log(`⚠️  [CONFIG] .env.${nodeEnv} not found - using .env and .env.local only`)
}

// Final check
console.log(
  `🎯 [CONFIG] Final FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID || 'NOT SET'}`
)
console.log(`🎯 [CONFIG] Final NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`)

const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Firebase Admin (Backend)
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  BOOTSTRAP_SECRET_KEY: z.string().optional(),

  // Frontend URL
  NEXT_PUBLIC_B2B_URL: z.string().optional(),
})

export const config = envSchema.parse(process.env)
