'use client'

import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Grid,
  Users,
  Settings,
  UserCog,
  Key,
  Building2,
  ChevronRight,
  Users2,
  FileText,
  X,
  CreditCard,
  BarChart3,
  GitBranch,
  Wallet,
} from 'lucide-react'
import { clsx } from 'clsx'
import { type SpecialistProfile } from '@/lib/b2b/api'

interface SidebarProps {
  profile: SpecialistProfile | null
  currentOrgId?: string
  isMobileOpen?: boolean
  isClosing?: boolean
  onMobileClose?: () => void
}

export function Sidebar({
  profile,
  currentOrgId,
  isMobileOpen = false,
  isClosing = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname()
  const t = useTranslations('b2b.sidebar')
  const currentOrg =
    profile?.organizations.find((org) => org.orgId === currentOrgId) || profile?.organizations[0]
  const isOrgAdmin = currentOrg?.role === 'admin' || currentOrg?.role === 'org_admin'

  const pathForMatch = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || pathname
  const isActive = (href: string) => {
    const path = href.split('?')[0]
    if (path === '/b2b') {
      return pathForMatch === '/b2b' || pathForMatch === '/b2b/'
    }
    return pathForMatch.startsWith(path)
  }

  const withOrg = (path: string) => (currentOrgId ? `${path}?orgId=${currentOrgId}` : path)
  const specialistNavItems = [
    {
      href: currentOrgId ? `/b2b?orgId=${currentOrgId}` : '/b2b',
      labelKey: 'dashboard' as const,
      icon: Grid,
    },
    {
      href: withOrg('/b2b/children'),
      labelKey: 'children' as const,
      icon: Users,
    },
    {
      href: withOrg('/b2b/groups'),
      labelKey: 'groups' as const,
      icon: Users2,
    },
    {
      href: withOrg('/b2b/reports'),
      labelKey: 'reports' as const,
      icon: BarChart3,
    },
    {
      href: withOrg('/b2b/assignments'),
      labelKey: 'assignments' as const,
      icon: FileText,
    },
    ...(isOrgAdmin
      ? [
          { href: withOrg('/b2b/team'), labelKey: 'specialists' as const, icon: UserCog },
          { href: withOrg('/b2b/invites'), labelKey: 'inviteCodes' as const, icon: Key },
          {
            href: withOrg('/b2b/organization'),
            labelKey: 'organization' as const,
            icon: Building2,
          },
          { href: withOrg('/b2b/branches'), labelKey: 'branches' as const, icon: GitBranch },
          { href: withOrg('/b2b/finance'), labelKey: 'finance' as const, icon: Wallet },
        ]
      : []),
    { href: withOrg('/b2b/billing'), labelKey: 'billing' as const, icon: CreditCard },
    { href: '/b2b/settings', labelKey: 'settings' as const, icon: Settings },
  ]

  const mobileOpen = isMobileOpen && !isClosing
  return (
    <div
      className={clsx(
        'fixed inset-y-0 left-0 z-50 w-72 max-w-[min(320px,calc(100vw-2rem))] lg:static lg:w-64 lg:max-w-none min-h-screen flex flex-col bg-white border-r border-gray-200',
        'transition-[transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:transition-none',
        'lg:shadow-none',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
      )}
    >
      <div className="lg:hidden flex items-center justify-end p-2 border-b border-gray-200">
        <button
          type="button"
          onClick={onMobileClose}
          className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <aside className="flex-1 flex flex-col min-h-0 overflow-hidden w-full">
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <Link href="/b2b" className="flex items-center space-x-3 mb-4" onClick={onMobileClose}>
            <Image src="/logo.png" alt="Nuroo Logo" width={32} height={32} className="rounded-lg" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Nuroo</h1>
              <p className="text-xs text-gray-500">{t('b2bPlatform')}</p>
            </div>
          </Link>
          {currentOrg && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-900">{currentOrg.orgName}</p>
              {isOrgAdmin && (
                <span className="inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium bg-primary-100 text-primary-800 rounded">
                  {t('admin')}
                </span>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {specialistNavItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            if (!Icon) return null
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors min-h-[44px] items-center ${
                  active
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{t(item.labelKey)}</span>
                {active && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            )
          })}

          {profile && profile.organizations.length > 1 && (
            <div className="pt-4 mt-4 border-t border-gray-200">
              <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {t('organizations')}
              </p>
              {profile.organizations.map((org) => (
                <Link
                  key={org.orgId}
                  href={`/b2b?orgId=${org.orgId}`}
                  onClick={onMobileClose}
                  className={`flex items-center space-x-3 px-4 py-2 rounded-lg text-sm transition-colors min-h-[44px] items-center ${
                    org.orgId === currentOrgId
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span className="truncate">{org.orgName}</span>
                  {org.role === 'admin' && (
                    <span className="ml-auto text-xs text-primary-600">{t('admin')}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </nav>
      </aside>
    </div>
  )
}
