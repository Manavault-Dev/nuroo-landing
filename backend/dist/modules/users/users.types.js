import { z } from 'zod';
export const updateProfileSchema = z.object({
    name: z.string().min(1).max(100).optional(),
});
//# sourceMappingURL=users.types.js.map