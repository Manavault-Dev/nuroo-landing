'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
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
  BookOpen,
  CheckSquare,
  BarChart3,
  Sparkles,
} from 'lucide-react'
import { type SpecialistProfile, apiClient } from '@/lib/b2b/api'
import { getIdToken } from '@/lib/b2b/authClient'

interface SidebarProps {
  profile: SpecialistProfile | null
  currentOrgId?: string
}

export function Sidebar({ profile, currentOrgId }: SidebarProps) {
  const pathname = usePathname()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const currentOrg =
    profile?.organizations.find((org) => org.orgId === currentOrgId) || profile?.organizations[0]
  const isOrgAdmin = currentOrg?.role === 'admin'

  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const idToken = await getIdToken(true)
        if (idToken) {
          apiClient.setToken(idToken)
          const result = await apiClient.checkSuperAdmin()
          setIsSuperAdmin(result.isSuperAdmin)
        }
      } catch (err) {
        // Not super admin or error - ignore
        setIsSuperAdmin(false)
      }
    }

    if (profile) {
      checkSuperAdmin()
    }
  }, [profile])

  const isActive = (href: string) => {
    if (href === '/b2b') {
      return pathname === '/b2b'
    }
    return pathname.startsWith(href)
  }

  // Super Admin: Professional Content Management Sidebar
  if (isSuperAdmin) {
    const contentNavItems = [
      { href: '/b2b/content', label: 'Content Manager', icon: FileText, badge: null },
    ]

    const quickActions = [
      {
        href: '/b2b/content?tab=tasks&action=create',
        label: 'New Task',
        icon: CheckSquare,
        color: 'green',
      },
      {
        href: '/b2b/content?tab=roadmaps&action=create',
        label: 'New Roadmap',
        icon: BookOpen,
        color: 'blue',
      },
    ]

    return (
      <aside className="w-64 bg-gradient-to-b from-white via-gray-50 to-white border-r border-gray-200 min-h-screen flex flex-col shadow-lg">
        <div className="p-6 border-b border-gray-200 bg-white">
          <Link href="/b2b/content" className="flex items-center space-x-3 mb-4 group">
            <div className="relative">
              <img
                src="/logo.png"
                alt="Nuroo Logo"
                className="w-11 h-11 rounded-xl shadow-md group-hover:shadow-lg transition-all duration-200"
              />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full border-2 border-white shadow-sm"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Nuroo
              </h1>
              <p className="text-xs text-gray-500 font-medium">Content Platform</p>
            </div>
          </Link>
          <div className="mt-3">
            <span className="inline-flex items-center px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-purple-100 via-purple-50 to-purple-100 text-purple-700 rounded-lg border border-purple-200 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
              Super Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-3 overflow-y-auto">
          <div>
            <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
              <span className="w-1 h-1 rounded-full bg-purple-400 mr-2"></span>
              Content Management
            </p>
            {contentNavItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              if (!Icon) return null
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-r from-purple-50 via-purple-50 to-purple-100 text-purple-700 font-semibold shadow-md border border-purple-200'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 transition-colors ${active ? 'text-purple-600' : 'text-gray-400 group-hover:text-gray-600'}`}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-purple-200 text-purple-700 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {active && <ChevronRight className="w-4 h-4 text-purple-600 animate-pulse" />}
                </Link>
              )
            })}
          </div>

          <div className="pt-2">
            <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
              <span className="w-1 h-1 rounded-full bg-green-400 mr-2"></span>
              Quick Actions
            </p>
            <div className="space-y-1.5">
              {quickActions.map((action) => {
                const Icon = action.icon
                const colorClass = action.color === 'green' ? 'bg-green-500' : 'bg-blue-500'
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-150 hover:translate-x-1"
                  >
                    <div className={`w-2 h-2 rounded-full ${colorClass} shadow-sm`}></div>
                    {Icon && <Icon className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />}
                    <span className="flex-1">{action.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="pt-2">
            <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
              <span className="w-1 h-1 rounded-full bg-gray-400 mr-2"></span>
              System
            </p>
            <Link
              href="/b2b/settings"
              className={`group flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive('/b2b/settings')
                  ? 'bg-gray-100 text-gray-900 font-semibold shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Settings
                className={`w-5 h-5 ${isActive('/b2b/settings') ? 'text-gray-700' : 'text-gray-400 group-hover:text-gray-600'}`}
              />
              <span>Settings</span>
              {isActive('/b2b/settings') && (
                <ChevronRight className="w-4 h-4 ml-auto text-gray-600" />
              )}
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200 bg-gradient-to-br from-white to-gray-50">
          <div className="px-4 py-3.5 bg-gradient-to-r from-purple-50 via-purple-50 to-purple-100 rounded-xl border border-purple-200 shadow-sm">
            <div className="flex items-start space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-sm">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-purple-900 mb-0.5">Content Manager</p>
                <p className="text-xs text-purple-700 leading-tight">
                  Manage global content for all users
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    )
  }

  // Regular users (Specialist or Org Admin)
  const specialistNavItems = [
    { href: '/b2b', label: 'Dashboard', icon: Grid },
    {
      href: `/b2b/children${currentOrgId ? `?orgId=${currentOrgId}` : ''}`,
      label: 'Children',
      icon: Users,
    },
    {
      href: `/b2b/groups${currentOrgId ? `?orgId=${currentOrgId}` : ''}`,
      label: 'Groups',
      icon: Users2,
    },
    { href: '/b2b/settings', label: 'Settings', icon: Settings },
  ]

  const orgAdminNavItems = isOrgAdmin
    ? [
        {
          href: `/b2b/team${currentOrgId ? `?orgId=${currentOrgId}` : ''}`,
          label: 'Team Management',
          icon: UserCog,
        },
        {
          href: `/b2b/invites${currentOrgId ? `?orgId=${currentOrgId}` : ''}`,
          label: 'Invite Codes',
          icon: Key,
        },
        {
          href: `/b2b/organization${currentOrgId ? `?orgId=${currentOrgId}` : ''}`,
          label: 'Organization',
          icon: Building2,
        },
      ]
    : []

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <Link href="/b2b" className="flex items-center space-x-3 mb-4">
          <img src="/logo.png" alt="Nuroo Logo" className="w-8 h-8 rounded-lg" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nuroo</h1>
            <p className="text-xs text-gray-500">B2B Platform</p>
          </div>
        </Link>
        {currentOrg && (
          <div className="mt-2">
            <p className="text-sm font-medium text-gray-900">{currentOrg.orgName}</p>
            {isOrgAdmin && (
              <span className="inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium bg-primary-100 text-primary-800 rounded">
                Admin
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

        {orgAdminNavItems.length > 0 && (
          <>
            <div className="pt-4 mt-4 border-t border-gray-200">
              <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Administration
              </p>
            </div>
            {orgAdminNavItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              if (!Icon) return null
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
