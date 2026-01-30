import dotenv from 'dotenv'
import { z } from 'zod'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const nodeEnv = process.env.NODE_ENV || 'development'

// Load env files in priority order (later overrides earlier)
const envFiles = [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../.env.local'),
  path.join(__dirname, `../.env.${nodeEnv}`),
]

for (const envPath of envFiles) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  }
}

const envSchema = z.object({
  PORT: z.string().default(process.env.PORT || '3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  BOOTSTRAP_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_B2B_URL: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
})

export const config = envSchema.parse(process.env)
