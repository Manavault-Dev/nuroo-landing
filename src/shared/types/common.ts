export interface ChildSummary {
  id: string
  name: string
  age?: number
  speechStepId?: string
  speechStepNumber?: number
  lastActiveDate?: string
  completedTasksCount: number
}

export interface ChildDetail extends ChildSummary {
  organizationId: string
  recentTasks: Array<{
    id: string
    title: string
    status: 'completed' | 'pending' | 'in-progress'
    completedAt?: string
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
  createdAt: string
  updatedAt: string
}

export interface ParentFeedback {
  mood: 'good' | 'ok' | 'hard'
  comment?: string
  timestamp: string
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

export interface ApiResponse<T = unknown> {
  ok?: boolean
  error?: string
  data?: T
}
