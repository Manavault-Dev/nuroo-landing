import { z } from 'zod'

export const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  country: z.string().max(100).optional(),
})

export const createAdminInviteSchema = z.object({
  orgId: z.string().min(1),
  role: z.enum(['org_admin', 'specialist', 'parent']),
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().min(1).max(1000).optional(),
})

export const setSuperAdminSchema = z.object({
  email: z.string().email(),
})

export const bootstrapSuperAdminSchema = z.object({
  email: z.string().email(),
  secretKey: z.string().min(1),
})

export type CreateOrgInput = z.infer<typeof createOrgSchema>
export type CreateAdminInviteInput = z.infer<typeof createAdminInviteSchema>
export type SetSuperAdminInput = z.infer<typeof setSuperAdminSchema>
export type BootstrapSuperAdminInput = z.infer<typeof bootstrapSuperAdminSchema>
