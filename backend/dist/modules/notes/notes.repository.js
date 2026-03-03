import { getChildNotesRef, getSpecialistRef } from '../../infrastructure/database/collections.js';
import { nowTimestamp } from '../../shared/utils/timestamp.js';
export async function findNotesByChildId(childId, orgId) {
    const notesRef = getChildNotesRef(childId);
    const notesSnapshot = await notesRef.orderBy('createdAt', 'desc').get();
    return notesSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            childId,
            orgId: data.orgId || orgId,
            specialistId: data.specialistId,
            specialistName: data.specialistName || 'Unknown',
            text: data.text || data.content || '',
            tags: data.tags || [],
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt?.toDate() || data.createdAt.toDate(),
        };
    });
}
export async function createNote(childId, orgId, specialistId, text, tags, visibleToParent = true) {
    // Get specialist name
    const specialistRef = getSpecialistRef(specialistId);
    const specialistSnap = await specialistRef.get();
    const specialistName = specialistSnap.exists
        ? specialistSnap.data()?.name || 'Specialist'
        : 'Specialist';
    const notesRef = getChildNotesRef(childId);
    const now = nowTimestamp();
    const noteData = {
        orgId,
        specialistId,
        specialistName,
        text,
        tags: tags || [],
        visibleToParent,
        createdAt: now,
        updatedAt: now,
    };
    const noteRef = await notesRef.add(noteData);
    const nowDate = now.toDate();
    return {
        id: noteRef.id,
        childId,
        orgId,
        specialistId,
        specialistName,
        text,
        tags,
        visibleToParent,
        createdAt: nowDate,
        updatedAt: nowDate,
    };
}
//# sourceMappingURL=notes.repository.js.map