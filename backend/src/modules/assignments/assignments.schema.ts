import { z } from 'zod'

export const assignChildSchema = z.object({
  childId: z.string().min(1),
  specialistId: z.string().min(1),
})

export const unassignChildSchema = z.object({
  childId: z.string().min(1),
})

export type AssignChildInput = z.infer<typeof assignChildSchema>
export type UnassignChildInput = z.infer<typeof unassignChildSchema>
