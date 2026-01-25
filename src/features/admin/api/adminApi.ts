import { apiClient } from '@/src/shared/lib/api'
import type { Organization, Invite } from '@/src/shared/types'

interface SuperAdmin {
  uid: string
  email: string
  displayName: string | null
  createdAt: string
  lastSignIn: string | null
}

export const adminApi = {
  // Organizations
  listOrganizations: () => {
    return apiClient.get<{
      ok: boolean
      organizations: Organization[]
      count: number
    }>('/admin/organizations')
  },

  createOrganization: (name: string, country?: string) => {
    return apiClient.post<{ ok: boolean; orgId: string; name: string; country: string | null }>('/admin/organizations', { name, country })
  },

  // Invites
  listInvites: () => {
    return apiClient.get<{
      ok: boolean
      invites: Invite[]
      count: number
    }>('/admin/invites')
  },

  generateInviteCode: (data: {
    orgId: string
    role: 'org_admin' | 'specialist' | 'parent'
    expiresAt?: string
    maxUses?: number
  }) => {
    return apiClient.post<{
      ok: boolean
      code: string
      inviteLink: string
      orgId: string
      orgName: string
      role: string
      expiresAt: string | null
      maxUses: number | null
    }>('/admin/invites', data)
  },

  // Super Admin Management
  listSuperAdmins: () => {
    return apiClient.get<{ ok: boolean; superAdmins: SuperAdmin[]; count: number }>('/admin/super-admin')
  },

  grantSuperAdmin: (email: string) => {
    return apiClient.post<{ ok: boolean; message: string; uid: string; email: string; note: string }>('/admin/super-admin', { email })
  },

  removeSuperAdmin: (uid: string) => {
    return apiClient.delete<{ ok: boolean; message: string; uid: string; email: string }>(`/admin/super-admin/${uid}`)
  },

  // Dev check
  checkSuperAdmin: () => {
    return apiClient.get<{ uid: string; email: string | undefined; isSuperAdmin: boolean; claims?: any }>('/dev/check-super-admin')
  },
}
