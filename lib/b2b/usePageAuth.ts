import { useSearchParams } from 'next/navigation'
import { useAuth } from './AuthContext'
import type { SpecialistProfile } from './api'

export interface PageAuth {
  profile: SpecialistProfile | null
  orgId: string | undefined
  isAdmin: boolean
  isLoading: boolean
}

/**
 * Shared hook for B2B pages.
 * Reads auth state from the layout-level AuthContext (no manual token fetching needed)
 * and resolves orgId from the URL param or the user's first org.
 */
export function usePageAuth(): PageAuth {
  const { profile, isLoading } = useAuth()
  const searchParams = useSearchParams()

  const orgId = searchParams.get('orgId') || profile?.organizations[0]?.orgId || undefined
  const currentOrg =
    profile?.organizations.find((o) => o.orgId === orgId) ?? profile?.organizations[0]
  const isAdmin = currentOrg?.role === 'admin' || currentOrg?.role === 'org_admin'

  return { profile, orgId, isAdmin, isLoading }
}
