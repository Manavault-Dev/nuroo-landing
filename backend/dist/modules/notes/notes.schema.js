import { z } from 'zod';
export const createNoteSchema = z.object({
    text: z.string().min(1).max(5000),
    tags: z.array(z.string()).optional(),
    visibleToParent: z.boolean().optional().default(true),
});
//# sourceMappingURL=notes.schema.js.map