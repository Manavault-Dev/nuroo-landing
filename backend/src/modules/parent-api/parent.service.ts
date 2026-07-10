import {
  getChildSpecialists,
  getChildNotesForParent,
  getParentLinkedOrganizations,
  getParentChildren,
  verifyParentChildAccess,
  type LinkedSpecialist,
  type LinkedOrganization,
} from './parent.repository.js'
import type { SpecialistNote } from '../../shared/types/domain.js'

export interface ParentChildData {
  childId: string
  specialists: LinkedSpecialist[]
  notes: SpecialistNote[]
}

export async function listChildSpecialists(
  childId: string,
  parentUid: string
): Promise<LinkedSpecialist[]> {
  return getChildSpecialists(childId, parentUid)
}

export async function listChildNotes(
  childId: string,
  parentUid: string
): Promise<SpecialistNote[]> {
  return getChildNotesForParent(childId, parentUid)
}

export async function listParentOrganizations(parentUid: string): Promise<LinkedOrganization[]> {
  return getParentLinkedOrganizations(parentUid)
}

export async function listParentLinkedChildren(parentUid: string): Promise<string[]> {
  return getParentChildren(parentUid)
}

export async function verifyAccess(childId: string, parentUid: string): Promise<boolean> {
  return verifyParentChildAccess(childId, parentUid)
}
