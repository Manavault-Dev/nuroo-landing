import {
  findParents,
  createParent as createParentRepo,
  findParent,
  updateParent as updateParentRepo,
  deleteParent as deleteParentRepo,
} from './parents.repository.js'
import type { CreateParentInput, UpdateParentInput } from './parents.schema.js'

export async function listParents(orgId: string) {
  const parents = await findParents(orgId)
  return { ok: true, parents }
}

export async function addParent(orgId: string, input: CreateParentInput) {
  const parent = await createParentRepo(orgId, input)
  return { ok: true, parent }
}

export async function getParent(orgId: string, parentId: string) {
  return findParent(orgId, parentId)
}

export async function editParent(orgId: string, parentId: string, input: UpdateParentInput) {
  const parent = await updateParentRepo(orgId, parentId, input)
  return { ok: true, parent }
}

export async function removeParent(orgId: string, parentId: string) {
  await deleteParentRepo(orgId, parentId)
  return { ok: true, message: 'Parent contact deleted' }
}
