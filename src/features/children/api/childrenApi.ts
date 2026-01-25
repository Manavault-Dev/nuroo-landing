import { apiClient } from '@/src/shared/lib/api'
import type { ChildSummary, ChildDetail, SpecialistNote, TimelineResponse } from '@/src/shared/types'

export const childrenApi = {
  getChildren: (orgId: string) => {
    return apiClient.get<ChildSummary[]>(`/orgs/${orgId}/children`)
  },

  getChildDetail: (orgId: string, childId: string) => {
    return apiClient.get<ChildDetail>(`/orgs/${orgId}/children/${childId}`)
  },

  getTimeline: (orgId: string, childId: string, days: number = 30) => {
    return apiClient.get<TimelineResponse>(`/orgs/${orgId}/children/${childId}/timeline?days=${days}`)
  },

  getNotes: (orgId: string, childId: string) => {
    return apiClient.get<SpecialistNote[]>(`/orgs/${orgId}/children/${childId}/notes`)
  },

  createNote: (orgId: string, childId: string, text: string, tags?: string[]) => {
    return apiClient.post<SpecialistNote>(`/orgs/${orgId}/children/${childId}/notes`, { text, tags })
  },
}
