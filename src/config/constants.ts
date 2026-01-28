// App metadata
export const APP_NAME = 'Nuroo'
export const APP_DESCRIPTION = 'B2B Platform for Speech Therapists'

// Pagination
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// Invite codes
export const INVITE_CODE_LENGTH = 8
export const PARENT_INVITE_CODE_LENGTH = 6
export const INVITE_EXPIRY_DAYS = 30
export const PARENT_INVITE_EXPIRY_DAYS = 365

// Timeline
export const DEFAULT_TIMELINE_DAYS = 30
export const MIN_TIMELINE_DAYS = 7
export const MAX_TIMELINE_DAYS = 90

// Notes
export const MAX_NOTE_LENGTH = 5000

// Roles
export const ROLES = {
  ORG_ADMIN: 'org_admin',
  SPECIALIST: 'specialist',
  PARENT: 'parent',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]
