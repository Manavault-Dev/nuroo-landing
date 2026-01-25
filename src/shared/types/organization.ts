export interface Organization {
  orgId: string
  name: string
  country: string | null
  createdAt: string | null
  createdBy: string | null
  isActive: boolean
}

export interface OrgMember {
  uid: string
  email: string
  name: string
  role: 'org_admin' | 'specialist'
  status: 'active' | 'inactive'
  joinedAt: string
}

export interface Invite {
  code: string
  inviteLink: string
  orgId: string
  orgName: string
  role: string
  expiresAt: string | null
  maxUses: number | null
  usedCount: number
  isActive: boolean
  createdAt: string | null
}
