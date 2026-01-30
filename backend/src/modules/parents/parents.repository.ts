import { getOrgParentsRef } from '../../infrastructure/database/collections.js'
import { nowTimestamp, toISOString } from '../../shared/utils/timestamp.js'
import type { CreateParentInput, UpdateParentInput } from './parents.schema.js'

export async function findParents(orgId: string) {
  const parentsRef = getOrgParentsRef(orgId)
  const parentsSnap = await parentsRef.get()

  return parentsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: toISOString(doc.data().createdAt),
    updatedAt: toISOString(doc.data().updatedAt),
  }))
}

export async function createParent(orgId: string, input: CreateParentInput) {
  const parentsRef = getOrgParentsRef(orgId)
  const parentRef = parentsRef.doc()
  const parentId = parentRef.id
  const now = nowTimestamp()

  const parentData = {
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    linkedChildren: input.childIds || [],
    createdAt: now,
    updatedAt: now,
  }

  await parentRef.set(parentData)

  console.log(`[PARENTS] Created parent contact: ${parentId} in org ${orgId}`)

  return {
    id: parentId,
    ...parentData,
    createdAt: now.toDate().toISOString(),
    updatedAt: now.toDate().toISOString(),
  }
}

export async function findParent(orgId: string, parentId: string) {
  const parentRef = getOrgParentsRef(orgId).doc(parentId)
  const parentSnap = await parentRef.get()
  return parentSnap.exists ? { ref: parentRef, data: parentSnap.data()! } : null
}

export async function updateParent(orgId: string, parentId: string, input: UpdateParentInput) {
  const parentRef = getOrgParentsRef(orgId).doc(parentId)
  const now = nowTimestamp()

  const updateData: Record<string, unknown> = { updatedAt: now }

  if (input.name !== undefined) updateData.name = input.name
  if (input.email !== undefined) updateData.email = input.email || null
  if (input.phone !== undefined) updateData.phone = input.phone || null
  if (input.linkedChildren !== undefined) updateData.linkedChildren = input.linkedChildren

  await parentRef.update(updateData)

  const updatedData = (await parentRef.get()).data()!

  return {
    id: parentId,
    ...updatedData,
    createdAt: toISOString(updatedData.createdAt),
    updatedAt: toISOString(updatedData.updatedAt),
  }
}

export async function deleteParent(orgId: string, parentId: string) {
  const parentRef = getOrgParentsRef(orgId).doc(parentId)
  await parentRef.delete()
  console.log(`[PARENTS] Deleted parent contact: ${parentId} from org ${orgId}`)
}
