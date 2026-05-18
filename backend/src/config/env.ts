import { z } from 'zod'

export const envSchema = z.object({
  PORT: z.string().default('3101'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),

  FIREBASE_DEV_PROJECT_ID: z.string().optional(),
  FIREBASE_DEV_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_DEV_PRIVATE_KEY: z.string().optional(),

  FIREBASE_PROD_PROJECT_ID: z.string().optional(),
  FIREBASE_PROD_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PROD_PRIVATE_KEY: z.string().optional(),

  BOOTSTRAP_SECRET_KEY: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),

  NEXT_PUBLIC_B2B_URL: z.string().optional(),

  BACKEND_PUBLIC_URL: z.string().optional(),

  FINIK_API_KEY: z.string().optional(),
  FINIK_API_URL: z.string().optional(),
  FINIK_ACCOUNT_ID: z.string().optional(),
  FINIK_PRIVATE_PEM: z.string().optional(),
  FINIK_WEBHOOK_SECRET: z.string().optional(),
  FINIK_WEBHOOK_URL: z.string().optional(),
  FINIK_DEBUG_SIGNATURE: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>
