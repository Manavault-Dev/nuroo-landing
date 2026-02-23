import { z } from 'zod'

export const createPaymentSchema = z.object({
  planId: z.enum(['starter', 'growth']),
  orgId: z.string().min(1),
})

export const webhookSchema = z.object({
  paymentId: z.string(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']),
  amount: z.number(),
  currency: z.string().default('KGS'),
  metadata: z
    .object({
      orgId: z.string().optional(),
      planId: z.string().optional(),
    })
    .optional(),
})

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type WebhookInput = z.infer<typeof webhookSchema>
