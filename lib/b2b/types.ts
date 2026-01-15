export interface Organization {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface Specialist {
  id: string
  email: string
  name: string
  organizationId: string
  createdAt: Date
  updatedAt: Date
}

export interface ChildSummary {
  id: string
  name: string
  organizationId: string
  speechRoadmapStep?: number
  completedTasksCount: number
  lastActiveDate?: Date
  assignedSpecialistIds: string[]
}

export interface SpecialistNote {
  id: string
  childId: string
  specialistId: string
  specialistName: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface ChildProfile extends ChildSummary {
  recentTasks: Array<{
    id: string
    title: string
    completedAt?: Date
    status: 'completed' | 'pending' | 'in-progress'
  }>
  notes: SpecialistNote[]
}
