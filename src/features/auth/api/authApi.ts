import { apiClient } from '@/src/shared/lib/api'
import type { SpecialistProfile, SessionResponse } from '@/src/shared/types'

export const authApi = {
  getMe: () => {
    return apiClient.get<SpecialistProfile>('/me')
  },

  createProfile: (name?: string) => {
    return apiClient.post<{ ok: boolean; specialist: SpecialistProfile; orgId?: string | null }>('/me', { name })
  },

  getSession: () => {
    return apiClient.get<SessionResponse>('/session')
  },

  joinOrganization: (inviteCode: string) => {
    return apiClient.post<{ ok: boolean; orgId: string }>('/join', { inviteCode })
  },

  acceptInvite: (code: string) => {
    return apiClient.post<{ ok: boolean; orgId: string; role: string; orgName: string }>('/invites/accept', { code })
  },

  checkSuperAdmin: () => {
    return apiClient.get<{ uid: string; email: string | undefined; isSuperAdmin: boolean; claims?: any }>('/dev/check-super-admin')
  },
}
