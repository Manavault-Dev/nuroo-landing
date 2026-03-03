import { findNotesByChildId, createNote as createNoteRepo } from './notes.repository.js';
export async function getNotes(childId, orgId) {
    return findNotesByChildId(childId, orgId);
}
export async function addNote(childId, orgId, specialistId, input) {
    return createNoteRepo(childId, orgId, specialistId, input.text, input.tags);
}
//# sourceMappingURL=notes.service.js.map