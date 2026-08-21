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

export type B2bOrgMembership = {
  orgId: string
  role?: 'admin' | 'specialist' | 'independent_specialist'
  nurooPlan?: 'nuroo' | 'nuroo_business' | null
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

/** Safe internal path for post-login redirect (?redirect=) */
export function getSafeB2bRedirect(redirect: string | null | undefined): string | null {
  if (!redirect) return null
  const path = redirect.startsWith('/') ? redirect : `/${redirect}`
  if (!path.startsWith('/b2b')) return null
  if (isAuthRoute(path.split('?')[0] ?? path)) return null
  return path
}

/** Default B2B workspace for a membership (role + org). */
export function getWorkspacePath(org: B2bOrgMembership): string {
  const orgQuery = `orgId=${encodeURIComponent(org.orgId)}`
  if (org.role === 'specialist') {
    return `${ROUTES.CHILDREN}?${orgQuery}`
  }
  return `${ROUTES.DASHBOARD}?${orgQuery}`
}

export function getPostLoginPath(profile: { organizations?: B2bOrgMembership[] } | null): string {
  if (!profile?.organizations?.length) return '/b2b/onboarding'
  return getWorkspacePath(profile.organizations[0])
}

export function resolvePostLoginPath(
  profile: { organizations?: B2bOrgMembership[] } | null,
  redirect: string | null | undefined
): string {
  return getSafeB2bRedirect(redirect) ?? getPostLoginPath(profile)
}

export function withOrgId(path: string, orgId?: string): string {
  if (!orgId) return path
  return `${path}?orgId=${orgId}`
}
