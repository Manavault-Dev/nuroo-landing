export interface Group {
  id: string
  name: string
  description: string | null
  color: string
  orgId: string
  parentCount: number
  lastAssignedAt: string | null
  lastAssignedTaskTitles: string[] | null
  createdAt: string | null
  ownerId?: string
  ownerName?: string
}

export interface Assignment {
  id: string
  groupId: string
  groupName: string
  title: string
  description: string | null
  dueDate: string | null
  taskTitles: string[]
  contentRoadmapIds: string[]
  roadmapNames: string[]
  childCount: number
  tasksCreated: number
  assignedBy: string
  assignedAt: string | null
  status: 'active' | 'closed'
}

export interface Submission {
  childId: string
  childName: string
  age?: number
  taskId: string | null
  status: 'pending' | 'submitted' | 'graded'
  submissionText: string | null
  fileUrl: string | null
  submittedAt: string | null
  grade: 'approved' | 'needs_revision' | null
  feedback: string | null
  feedbackAt: string | null
}

export interface AssignmentDetail extends Assignment {
  ownerId: string
  submissions: Submission[]
  roadmaps?: { id: string; name: string; taskTitles: string[] }[]
}

export interface Comment {
  id: string
  authorId: string
  authorName: string
  authorRole: string
  text: string
  createdAt: string | null
}

export interface Parent {
  parentUserId: string
  name: string
  email: string | null
  children: Array<{ id: string; name: string; age?: number }>
  addedAt: string | null
}

export interface ContentTaskItem {
  id: string
  title: string
  description?: string
}

export interface ContentRoadmapItem {
  id: string
  name: string
  description?: string
  taskIds: string[]
}

export type TimeT = (key: string, values?: Record<string, string | number>) => string
