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

export interface SessionResponse {
  ok: boolean
  hasOrg: boolean
  orgId?: string
}
