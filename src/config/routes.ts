export const ROUTES = {
  // Auth routes
  LOGIN: '/b2b/login',
  REGISTER: '/b2b/register',
  JOIN: '/b2b/join',

  // Main routes
  DASHBOARD: '/b2b',
  CHILDREN: '/b2b/children',
  CHILD_DETAIL: (childId: string) => `/b2b/children/${childId}`,
  SETTINGS: '/b2b/settings',

  // Admin routes
  TEAM: '/b2b/team',
  INVITES: '/b2b/invites',
  ORGANIZATION: '/b2b/organization',

  // Super Admin routes
  ADMIN: '/b2b/admin',
} as const

export const AUTH_ROUTES = [ROUTES.LOGIN, ROUTES.REGISTER, ROUTES.JOIN]

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.includes(pathname as any)
}

export function withOrgId(path: string, orgId?: string): string {
  if (!orgId) return path
  return `${path}?orgId=${orgId}`
}
