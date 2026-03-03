import { z } from 'zod';
export const assignChildSchema = z.object({
    childId: z.string().min(1),
    specialistId: z.string().min(1),
});
export const unassignChildSchema = z.object({
    childId: z.string().min(1),
});
//# sourceMappingURL=assignments.schema.js.map