export interface AuthenticatedUser {
  uid: string
  email: string | undefined
}

export interface OrgMember {
  uid: string
  role: 'admin' | 'specialist'
  status: 'active' | 'inactive'
  addedAt: Date
}

export interface ChildSummary {
  id: string
  name: string
  age?: number
  speechStepId?: string
  speechStepNumber?: number
  lastActiveDate?: Date
  completedTasksCount: number
}

export interface ChildDetail extends ChildSummary {
  organizationId: string
  recentTasks: Array<{
    id: string
    title: string
    status: 'completed' | 'pending' | 'in-progress'
    completedAt?: Date
  }>
}

export interface SpecialistNote {
  id: string
  childId: string
  orgId: string
  specialistId: string
  specialistName: string
  text: string
  tags?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface SpecialistProfile {
  uid: string
  email: string
  name: string
  organizations: Array<{
    orgId: string
    orgName: string
    role: 'admin' | 'specialist'
  }>
}

export interface ParentFeedback {
  mood: 'good' | 'ok' | 'hard'
  comment?: string
  timestamp: Date
}

export interface ActivityDay {
  date: string
  tasksAttempted: number
  tasksCompleted: number
  feedback?: ParentFeedback
}

export interface TimelineResponse {
  days: ActivityDay[]
}
