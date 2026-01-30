import { z } from 'zod'

export const getTimelineQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = parseInt(val || '30', 10)
      return Math.min(Math.max(parsed, 7), 90)
    }),
})

export type GetTimelineQuery = z.infer<typeof getTimelineQuerySchema>
