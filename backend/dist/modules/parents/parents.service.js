import { findParents, createParent as createParentRepo, findParent, updateParent as updateParentRepo, deleteParent as deleteParentRepo, } from './parents.repository.js';
export async function listParents(orgId) {
    const parents = await findParents(orgId);
    return { ok: true, parents };
}
export async function addParent(orgId, input) {
    const parent = await createParentRepo(orgId, input);
    return { ok: true, parent };
}
export async function getParent(orgId, parentId) {
    return findParent(orgId, parentId);
}
export async function editParent(orgId, parentId, input) {
    const parent = await updateParentRepo(orgId, parentId, input);
    return { ok: true, parent };
}
export async function removeParent(orgId, parentId) {
    await deleteParentRepo(orgId, parentId);
    return { ok: true, message: 'Parent contact deleted' };
}
//# sourceMappingURL=parents.service.js.map