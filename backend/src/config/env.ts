import { z } from 'zod'

export const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Firebase Admin (Backend)
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // Development Firebase (optional, overrides FIREBASE_PROJECT_ID in dev)
  FIREBASE_DEV_PROJECT_ID: z.string().optional(),
  FIREBASE_DEV_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_DEV_PRIVATE_KEY: z.string().optional(),

  // Production Firebase (optional, overrides FIREBASE_PROJECT_ID in prod)
  FIREBASE_PROD_PROJECT_ID: z.string().optional(),
  FIREBASE_PROD_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PROD_PRIVATE_KEY: z.string().optional(),

  BOOTSTRAP_SECRET_KEY: z.string().optional(),

  // Frontend URL
  NEXT_PUBLIC_B2B_URL: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>
