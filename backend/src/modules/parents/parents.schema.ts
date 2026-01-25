import { z } from 'zod'

export const createParentSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  childIds: z.array(z.string()).optional(),
})

export const updateParentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  linkedChildren: z.array(z.string()).optional(),
})

export type CreateParentInput = z.infer<typeof createParentSchema>
export type UpdateParentInput = z.infer<typeof updateParentSchema>
