import { findOrgChildren, getChildSummary, getChildDetail as getChildDetailRepo, getChildTimeline as getChildTimelineRepo, } from './children.repository.js';
export async function listChildren(orgId, role, uid) {
    console.log('[CHILDREN] Organization:', orgId);
    const childIds = await findOrgChildren(orgId, role, uid);
    console.log('[CHILDREN] Found childIds from organizations/{orgId}/children:', childIds);
    if (childIds.length === 0) {
        console.log('[CHILDREN] No children found');
        return [];
    }
    const children = [];
    for (const childId of childIds) {
        console.log('[CHILDREN] Processing childId:', childId);
        const child = await getChildSummary(childId);
        if (child) {
            children.push(child);
        }
    }
    console.log('[CHILDREN] Returning', children.length, 'children');
    return children;
}
export async function getChildDetailById(orgId, childId) {
    return getChildDetailRepo(childId, orgId);
}
export async function getTimeline(childId, days) {
    const timelineDays = await getChildTimelineRepo(childId, days);
    return { days: timelineDays };
}
//# sourceMappingURL=children.service.js.map