export type PresetId = 'nuroo' | 'ocean' | 'forest' | 'sunset' | 'violet'

export interface OrgBranding {
  logo?: string | null
  logoPositionX?: number | null
  logoPositionY?: number | null
  logoScale?: number | null
  name?: string | null
  description?: string | null
  /** @deprecated Use presetId instead. Kept for backward compatibility. */
  primaryColor?: string | null
  /** Color theme preset. Defaults to 'nuroo' if not set. */
  presetId?: PresetId | null
  /**
   * CSS variable map generated from the org's logo color.
   * When present, overrides presetId for theme rendering.
   * Keys are CSS variable names (e.g. '--brand-sidebar-bg').
   */
  generatedThemeTokens?: Record<string, string> | null
  welcomeMessage?: string | null
  coverImage?: string | null
  coverPositionX?: number | null
  coverPositionY?: number | null
  coverScale?: number | null
  phone?: string | null
  address?: string | null
  website?: string | null
}

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
