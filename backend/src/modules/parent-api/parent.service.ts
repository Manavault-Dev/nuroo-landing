import {
  getChildSpecialists,
  getChildNotesForParent,
  getParentLinkedOrganizations,
  getParentChildren,
  verifyParentChildAccess,
  type LinkedSpecialist,
  type LinkedOrganization,
} from './parent.repository.js'
import type { SpecialistNote } from '../../shared/types/common.js'

export interface ParentChildData {
  childId: string
  specialists: LinkedSpecialist[]
  notes: SpecialistNote[]
}

/**
 * Get specialists with access to a child
 */
export async function listChildSpecialists(
  childId: string,
  parentUid: string
): Promise<LinkedSpecialist[]> {
  return getChildSpecialists(childId, parentUid)
}

/**
 * Get notes for a child visible to parent
 */
export async function listChildNotes(
  childId: string,
  parentUid: string
): Promise<SpecialistNote[]> {
  return getChildNotesForParent(childId, parentUid)
}

/**
 * Get all organizations linked to a parent
 */
export async function listParentOrganizations(parentUid: string): Promise<LinkedOrganization[]> {
  return getParentLinkedOrganizations(parentUid)
}

/**
 * Get all children linked to a parent
 */
export async function listParentLinkedChildren(parentUid: string): Promise<string[]> {
  return getParentChildren(parentUid)
}

/**
 * Verify parent has access to child
 */
export async function verifyAccess(childId: string, parentUid: string): Promise<boolean> {
  return verifyParentChildAccess(childId, parentUid)
}
