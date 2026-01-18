'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  UserCog,
  Key,
  Building2,
  FileText,
  ChevronRight
} from 'lucide-react'
import { type SpecialistProfile } from '@/lib/b2b/api'

interface SidebarProps {
  profile: SpecialistProfile | null
  currentOrgId?: string
}

export function Sidebar({ profile, currentOrgId }: SidebarProps) {
  const pathname = usePathname()
  const currentOrg = profile?.organizations.find(org => org.orgId === currentOrgId) || profile?.organizations[0]
  const isAdmin = currentOrg?.role === 'admin'
  const isPersonalOrg = currentOrg?.orgName?.includes("'s Practice")

  const navItems = [
    { href: '/b2b', label: 'Dashboard', icon: LayoutDashboard },
    { href: `/b2b/children${currentOrgId ? `?orgId=${currentOrgId}` : ''}`, label: 'Children', icon: Users },
    { href: '/b2b/settings', label: 'Profile Settings', icon: Settings },
  ]

  const adminItems = isAdmin ? [
    { href: `/b2b/team${currentOrgId ? `?orgId=${currentOrgId}` : ''}`, label: 'Team Management', icon: UserCog },
    { href: `/b2b/invites${currentOrgId ? `?orgId=${currentOrgId}` : ''}`, label: 'Invite Codes', icon: Key },
    { href: `/b2b/organization${currentOrgId ? `?orgId=${currentOrgId}` : ''}`, label: 'Organization', icon: Building2 },
  ] : []

  const isActive = (href: string) => {
    if (href === '/b2b') {
      return pathname === '/b2b'
    }
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <Link href="/b2b" className="flex items-center space-x-3 mb-4">
          <img 
            src="/logo.png" 
            alt="Nuroo Logo" 
            className="w-8 h-8 rounded-lg"
          />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nuroo</h1>
            <p className="text-xs text-gray-500">B2B Platform</p>
          </div>
        </Link>
        {currentOrg && (
          <div className="mt-2">
            <p className="text-sm font-medium text-gray-900">{currentOrg.orgName}</p>
            {isAdmin && (
              <span className="inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium bg-primary-100 text-primary-800 rounded">
                Admin
              </span>
            )}
            {isPersonalOrg && (
              <p className="text-xs text-gray-500 mt-1">Personal Workspace</p>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
              {active && <ChevronRight className="w-4 h-4 ml-auto" />}
            </Link>
          )
        })}

        {adminItems.length > 0 && (
          <>
            <div className="pt-4 mt-4 border-t border-gray-200">
              <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Administration
              </p>
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              )
            })}
          </>
        )}

        {profile && profile.organizations.length > 1 && (
          <div className="pt-4 mt-4 border-t border-gray-200">
            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Organizations
            </p>
            {profile.organizations.map((org) => (
              <Link
                key={org.orgId}
                href={`/b2b?orgId=${org.orgId}`}
                className={`flex items-center space-x-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                  org.orgId === currentOrgId
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span className="truncate">{org.orgName}</span>
                {org.role === 'admin' && (
                  <span className="ml-auto text-xs text-primary-600">Admin</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </aside>
  )
}

