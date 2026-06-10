'use client'

import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Users,
  Settings,
  UserCog,
  Key,
  Building2,
  Users2,
  FileText,
  X,
  CreditCard,
  BarChart3,
  GitBranch,
  CalendarDays,
  Wallet,
  ChevronRight,
  Palette,
} from 'lucide-react'
import { clsx } from 'clsx'
import { type SpecialistProfile } from '@/lib/b2b/api'
import { useBranding } from '@/lib/b2b/brandingContext'
import { usePlan } from '@/lib/b2b/planContext'
import { type PlanId } from '@/lib/pricing/planFeatureConfig'

interface SidebarProps {
  profile: SpecialistProfile | null
  currentOrgId?: string
  isMobileOpen?: boolean
  isClosing?: boolean
  onMobileClose?: () => void
}

interface NavItem {
  href: string
  labelKey: string
  icon: React.ElementType
  /** If set, show an "Upgrade" badge when the current plan is below this. */
  requiredPlan?: PlanId
}

interface NavGroup {
  labelKey: string
  items: NavItem[]
}

function valueOrDefault(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function logoCropStyle(branding: ReturnType<typeof useBranding>['branding']) {
  return {
    objectPosition: `${valueOrDefault(branding?.logoPositionX, 50)}% ${valueOrDefault(
      branding?.logoPositionY,
      50
    )}%`,
    transform: `scale(${valueOrDefault(branding?.logoScale, 1)})`,
  }
}

function NavLink({
  item,
  active,
  onClick,
  isLocked,
}: {
  item: NavItem
  active: boolean
  onClick?: () => void
  isLocked?: boolean
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3.5 px-4 py-3 rounded-xl text-[16px] font-medium transition-colors min-h-[48px] group',
        active ? 'b2b-nav-active font-bold' : 'b2b-nav-link',
        isLocked && 'opacity-70'
      )}
    >
      <Icon
        className={clsx(
          'w-[21px] h-[21px] shrink-0 transition-colors',
          active ? 'b2b-nav-icon-active' : 'b2b-nav-icon-idle'
        )}
      />
      <span className="flex-1 truncate">{item.labelKey}</span>
      {isLocked && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 leading-none whitespace-nowrap shrink-0">
          ↑
        </span>
      )}
      {!isLocked && active && (
        <ChevronRight className="w-[17px] h-[17px] b2b-nav-icon-active shrink-0 opacity-60" />
      )}
    </Link>
  )
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
  const isOrgAdmin = currentOrg?.role === 'admin'

  const { branding } = useBranding()
  const { meetsPlan } = usePlan()

  const pathForMatch = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || pathname
  const isActive = (href: string) => {
    const path = href.split('?')[0]
    if (path === '/b2b') return pathForMatch === '/b2b' || pathForMatch === '/b2b/'
    return pathForMatch.startsWith(path)
  }

  const withOrg = (path: string) => (currentOrgId ? `${path}?orgId=${currentOrgId}` : path)

  // ── Navigation groups ─────────────────────────────────────────────────────

  const coreGroup: NavGroup = {
    labelKey: 'core',
    items: [
      {
        href: currentOrgId ? `/b2b?orgId=${currentOrgId}` : '/b2b',
        labelKey: t('dashboard'),
        icon: LayoutDashboard,
      },
      { href: withOrg('/b2b/children'), labelKey: t('children'), icon: Users },
      { href: withOrg('/b2b/groups'), labelKey: t('groups'), icon: Users2 },
      { href: withOrg('/b2b/assignments'), labelKey: t('assignments'), icon: FileText },
    ],
  }

  const operationsGroup: NavGroup = {
    labelKey: 'operations',
    items: [
      { href: withOrg('/b2b/reports'), labelKey: t('reports'), icon: BarChart3 },
      ...(!isOrgAdmin
        ? [
            {
              href: `${withOrg('/b2b/finance')}${currentOrgId ? '&tab=attendance' : '?tab=attendance'}`,
              labelKey: t('attendance'),
              icon: CalendarDays,
              requiredPlan: 'enterprise' as PlanId,
            },
          ]
        : []),
      ...(isOrgAdmin
        ? [
            {
              href: `${withOrg('/b2b/finance')}${currentOrgId ? '&tab=invoices' : '?tab=invoices'}`,
              labelKey: t('finance'),
              icon: Wallet,
              requiredPlan: 'enterprise' as PlanId,
            },
            {
              href: withOrg('/b2b/branches'),
              labelKey: t('branches'),
              icon: GitBranch,
              requiredPlan: 'enterprise' as PlanId,
            },
          ]
        : []),
    ],
  }

  const teamGroup: NavGroup = {
    labelKey: 'teamSection',
    items: [
      ...(isOrgAdmin
        ? [{ href: withOrg('/b2b/team'), labelKey: t('specialists'), icon: UserCog }]
        : []),
      { href: withOrg('/b2b/invites'), labelKey: t('inviteCodes'), icon: Key },
    ],
  }

  const adminGroup: NavGroup | null = isOrgAdmin
    ? {
        labelKey: 'adminSection',
        items: [
          { href: withOrg('/b2b/organization'), labelKey: t('organization'), icon: Building2 },
          {
            href: withOrg('/b2b/brand'),
            labelKey: t('brandSettings'),
            icon: Palette,
            requiredPlan: 'growth' as PlanId,
          },
          { href: withOrg('/b2b/billing'), labelKey: t('billing'), icon: CreditCard },
        ],
      }
    : null

  const settingsItem: NavItem = {
    href: '/b2b/settings',
    labelKey: t('settings'),
    icon: Settings,
  }

  const groups = [coreGroup, operationsGroup, teamGroup, ...(adminGroup ? [adminGroup] : [])]

  const mobileOpen = isMobileOpen && !isClosing

  return (
    <div
      className={clsx(
        'b2b-sidebar fixed inset-y-0 left-0 w-[17rem] max-w-[min(320px,calc(100vw-2rem))] h-[100dvh] md:top-0 md:bottom-0 md:w-[17rem] md:max-w-none md:h-screen flex flex-col overflow-hidden bg-white border-r border-gray-100',
        mobileOpen ? 'z-50' : 'z-[38] md:z-30',
        'transition-[transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:transition-none',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0',
        !mobileOpen ? 'pointer-events-none md:pointer-events-auto' : ''
      )}
    >
      {/* Mobile close */}
      <div className="b2b-sidebar-close-row md:hidden flex items-center justify-end p-2 border-b border-gray-100 shrink-0">
        <button
          type="button"
          onClick={onMobileClose}
          className="b2b-sidebar-close-btn flex items-center justify-center w-10 h-10 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          aria-label={t('closeMenu')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <aside className="flex-1 flex flex-col min-h-0 overflow-hidden w-full">
        {/* Identity — one block, org name appears exactly once */}
        <div className="b2b-sidebar-divider px-4 py-5 border-b border-gray-100 shrink-0">
          <Link href="/b2b" className="flex items-center gap-3.5 min-w-0" onClick={onMobileClose}>
            {branding?.logo ? (
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl">
                <img
                  src={branding.logo}
                  alt={branding.name || 'Logo'}
                  className="h-full w-full object-cover"
                  style={logoCropStyle(branding)}
                />
              </div>
            ) : (
              <Image
                src="/Logo.svg"
                alt="Nuroo"
                width={48}
                height={48}
                className="rounded-xl flex-shrink-0"
                unoptimized
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="b2b-sidebar-org-name text-xl font-bold text-gray-900 block leading-tight truncate">
                {branding?.name || currentOrg?.orgName || 'Nuroo'}
              </span>
              <span className="b2b-sidebar-role text-sm text-primary-500 font-semibold leading-tight mt-1 block">
                {isOrgAdmin ? t('admin') : t('b2bPlatform')}
              </span>
            </div>
          </Link>
        </div>

        {/* Nav — no section labels, groups separated by thin dividers */}
        <nav className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="space-y-1">
            {groups.map((group, gi) => (
              <div key={group.labelKey}>
                {gi > 0 && (
                  <div className="b2b-sidebar-divider my-2.5 mx-3.5 border-t border-gray-100" />
                )}
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    onClick={onMobileClose}
                    isLocked={!!item.requiredPlan && !meetsPlan(item.requiredPlan)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Settings */}
          <div className="b2b-sidebar-divider mt-2.5 pt-2.5 border-t border-gray-100">
            <NavLink
              item={settingsItem}
              active={isActive(settingsItem.href)}
              onClick={onMobileClose}
            />
          </div>

          {/* Switch org — only shown when user belongs to multiple orgs */}
          {profile && profile.organizations.length > 1 && (
            <div className="b2b-sidebar-divider mt-2 pt-2 border-t border-gray-100">
              <p className="b2b-sidebar-muted-text px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                {t('switchCenter')}
              </p>
              <div className="space-y-0.5">
                {profile.organizations.map((org) => (
                  <Link
                    key={org.orgId}
                    href={`/b2b?orgId=${org.orgId}`}
                    onClick={onMobileClose}
                    className={clsx(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors',
                      org.orgId === currentOrgId
                        ? 'b2b-org-switch-active bg-primary-50 text-primary-700 font-medium'
                        : 'b2b-org-switch-link text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                    )}
                  >
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="flex-1 truncate">{org.orgName}</span>
                    {org.role === 'admin' && (
                      <span className="text-[10px] text-primary-500 font-medium">{t('admin')}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="b2b-sidebar-footer shrink-0 border-t border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Image
              src="/Logo.svg"
              alt="Nuroo"
              width={20}
              height={20}
              className="shrink-0"
              unoptimized
            />
            <span>
              {t('poweredBy')}{' '}
              <span className="b2b-sidebar-role font-semibold text-primary-600">Nuroo</span>
            </span>
          </div>
        </div>
      </aside>
    </div>
  )
}
