import { apiClient } from '@/src/shared/lib/api'

export const invitesApi = {
  createOrgInvite: (orgId: string, options?: {
    role?: 'specialist' | 'admin'
    maxUses?: number
    expiresInDays?: number
  }) => {
    return apiClient.post<{
      ok: boolean
      inviteCode: string
      expiresAt: string
      role: 'specialist' | 'admin'
      maxUses: number | null
    }>(`/orgs/${orgId}/invites`, {
      role: options?.role || 'specialist',
      maxUses: options?.maxUses,
      expiresInDays: options?.expiresInDays || 30,
    })
  },

  createParentInvite: () => {
    return apiClient.post<{
      ok: boolean
      inviteCode: string
      expiresAt: string
      orgId: string
    }>('/specialists/invites', {})
  },

  validateParentInvite: (inviteCode: string) => {
    return apiClient.post<{
      ok: boolean
      valid: boolean
      specialistId: string
      specialistName: string
      orgId: string
      orgName: string
    }>('/api/org/parent-invites/validate', { inviteCode })
  },

  useParentInvite: (inviteCode: string, childId: string) => {
    return apiClient.post<{
      ok: boolean
      orgId: string
      childId: string
      message: string
    }>('/api/org/parent-invites/use', { inviteCode, childId })
  },
}
