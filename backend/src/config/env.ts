import { z } from 'zod'

export const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Firebase Admin (Backend)
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),

  // Development Firebase (optional, overrides FIREBASE_PROJECT_ID in dev)
  FIREBASE_DEV_PROJECT_ID: z.string().optional(),
  FIREBASE_DEV_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_DEV_PRIVATE_KEY: z.string().optional(),

  // Production Firebase (optional, overrides FIREBASE_PROJECT_ID in prod)
  FIREBASE_PROD_PROJECT_ID: z.string().optional(),
  FIREBASE_PROD_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PROD_PRIVATE_KEY: z.string().optional(),

  BOOTSTRAP_SECRET_KEY: z.string().optional(),

  // Frontend URL (redirect after payment)
  NEXT_PUBLIC_B2B_URL: z.string().optional(),

  // Backend public URL (Cloud Run, etc.). Used to build FINIK_WEBHOOK_URL if not set.
  BACKEND_PUBLIC_URL: z.string().optional(),

  // Finik Payment System (RSA-SHA256 signature; see finik.kg/for-developers)
  FINIK_API_KEY: z.string().optional(),
  FINIK_API_URL: z.string().optional(),
  FINIK_ACCOUNT_ID: z.string().optional(),
  FINIK_PRIVATE_PEM: z.string().optional(), // contents of finik_private.pem (send public key to Finik)
  FINIK_WEBHOOK_SECRET: z.string().optional(),
  FINIK_WEBHOOK_URL: z.string().optional(), // full webhook URL; if unset, uses BACKEND_PUBLIC_URL + /webhooks/finik
  FINIK_DEBUG_SIGNATURE: z.string().optional(), // set to 1 to log the string we sign (for Finik support)
})

export type Env = z.infer<typeof envSchema>
