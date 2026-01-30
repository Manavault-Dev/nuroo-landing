import { apiClient } from '@/src/shared/lib/api'
import type { SpecialistProfile } from '@/src/shared/types'

export const organizationApi = {
  getProfile: () => {
    return apiClient.get<SpecialistProfile>('/me')
  },

  updateProfile: (name?: string) => {
    return apiClient.post<{ ok: boolean; specialist: SpecialistProfile }>('/me', { name })
  },
}
