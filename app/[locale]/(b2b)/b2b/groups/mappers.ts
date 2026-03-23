import type { Assignment, ContentRoadmapItem, ContentTaskItem, Parent } from './types'

export function mapAssignmentsFromHistory(
  raw: any[],
  assignmentDefaultTitle: string
): Assignment[] {
  return raw.map((a) => ({
    id: a.id,
    groupId: a.groupId,
    groupName: a.groupName,
    title: a.title || (a.taskTitles && a.taskTitles[0]) || assignmentDefaultTitle,
    description: null,
    dueDate: null,
    status: 'active' as const,
    taskTitles: a.taskTitles || [],
    contentRoadmapIds: a.contentRoadmapIds || [],
    roadmapNames: a.roadmapNames || [],
    childCount: a.childCount,
    tasksCreated: a.tasksCreated,
    assignedBy: a.assignedBy,
    assignedAt: a.assignedAt,
  }))
}

export function mapContentTasks(tasks: any[]): ContentTaskItem[] {
  return tasks.map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description,
  }))
}

export function mapContentRoadmaps(roadmaps: any[], noNameLabel: string): ContentRoadmapItem[] {
  return roadmaps.map((r: any) => ({
    id: r.id,
    name: r.name || noNameLabel,
    description: r.description,
    taskIds: Array.isArray(r.taskIds)
      ? r.taskIds
      : r.steps?.map((s: any) => s.taskId).filter(Boolean) || [],
  }))
}

export function mapConnectionsToParents(connections: any[], unnamedLabel: string): Parent[] {
  return connections.map((c: any) => ({
    parentUserId: c.parentUserId,
    name: c.parentName || unnamedLabel,
    email: c.parentEmail || null,
    children: (c.children || []).map((ch: any) => ({
      id: ch.childId || ch.id,
      name: ch.childName || ch.name || unnamedLabel,
      age: ch.childAge || ch.age,
    })),
    addedAt: null,
  }))
}
