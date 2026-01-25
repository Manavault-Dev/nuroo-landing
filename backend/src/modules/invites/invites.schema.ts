import { z } from 'zod'

export const createOrgInviteSchema = z.object({
  role: z.enum(['specialist', 'admin']).default('specialist'),
  maxUses: z.number().min(1).max(1000).optional(),
  expiresInDays: z.number().min(1).max(365).default(30),
})

export const joinOrgSchema = z.object({
  inviteCode: z.string().min(1).max(100),
})

export const acceptInviteSchema = z.object({
  code: z.string().min(1).max(20),
})

export const validateParentInviteSchema = z.object({
  inviteCode: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(100).optional(),
})

export const useParentInviteSchema = z.object({
  inviteCode: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(100).optional(),
  childId: z.string().min(1),
})

export type CreateOrgInviteInput = z.infer<typeof createOrgInviteSchema>
export type JoinOrgInput = z.infer<typeof joinOrgSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
