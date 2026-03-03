import { requireOrgMember, requireChildAccess } from '../../shared/guards/index.js';
import { getNotes, addNote } from './notes.service.js';
import { createNoteSchema } from './notes.schema.js';
export const notesRoutes = async (fastify) => {
    // GET /orgs/:orgId/children/:childId/notes - Get notes for a child
    fastify.get('/orgs/:orgId/children/:childId/notes', async (request, reply) => {
        const { orgId, childId } = request.params;
        await requireOrgMember(request, reply, orgId);
        await requireChildAccess(request, reply, orgId, childId);
        const notes = await getNotes(childId, orgId);
        return notes;
    });
    // POST /orgs/:orgId/children/:childId/notes - Create a note
    fastify.post('/orgs/:orgId/children/:childId/notes', async (request, reply) => {
        const { orgId, childId } = request.params;
        if (!request.user) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
        const body = createNoteSchema.parse(request.body);
        await requireOrgMember(request, reply, orgId);
        await requireChildAccess(request, reply, orgId, childId);
        const note = await addNote(childId, orgId, request.user.uid, body);
        return reply.code(201).send(note);
    });
};
//# sourceMappingURL=notes.routes.js.map