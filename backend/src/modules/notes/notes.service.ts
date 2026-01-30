import { findNotesByChildId, createNote as createNoteRepo } from './notes.repository.js'
import type { SpecialistNote } from '../../shared/types/common.js'
import type { CreateNoteInput } from './notes.schema.js'

export async function getNotes(childId: string, orgId: string): Promise<SpecialistNote[]> {
  return findNotesByChildId(childId, orgId)
}

export async function addNote(
  childId: string,
  orgId: string,
  specialistId: string,
  input: CreateNoteInput
): Promise<SpecialistNote> {
  return createNoteRepo(childId, orgId, specialistId, input.text, input.tags)
}
