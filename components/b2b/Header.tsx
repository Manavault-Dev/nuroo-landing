'use client'

import { useRouter, usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { LogOut, User, Bell, Shield, Menu, X } from 'lucide-react'
import { useAuth } from '@/lib/b2b/AuthContext'
import { type SpecialistProfile } from '@/lib/b2b/api'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'

interface HeaderProps {
  profile: SpecialistProfile | null
  isSidebarOpen?: boolean
  onMenuClick?: () => void
}

const PAGE_PATH_KEYS: Record<string, string> = {
  '/b2b': 'dashboard',
  '/b2b/children': 'children',
  '/b2b/groups': 'groups',
  '/b2b/team': 'team',
  '/b2b/invites': 'invites',
  '/b2b/organization': 'organization',
  '/b2b/settings': 'settings',
  '/b2b/content': 'content',
  '/b2b/admin': 'admin',
  '/b2b/onboarding': 'onboarding',
}

export function Header({ profile, isSidebarOpen = false, onMenuClick }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isSuperAdmin, logout } = useAuth()
  const t = useTranslations('b2b.header')

  const handleSignOut = async () => {
    await logout()
    router.push('/b2b/login')
  }

  const pathForMatch = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || pathname
  const getPageTitle = () => {
    if (PAGE_PATH_KEYS[pathForMatch]) {
      return t(PAGE_PATH_KEYS[pathForMatch] as keyof typeof PAGE_PATH_KEYS)
    }
    const basePath = Object.keys(PAGE_PATH_KEYS).find(
      (path) => path !== '/b2b' && pathForMatch.startsWith(path)
    )
    if (basePath) {
      return t(PAGE_PATH_KEYS[basePath] as keyof typeof PAGE_PATH_KEYS)
    }
    return t('dashboard')
  }

  return (
    <header className="bg-white border-b border-gray-200 min-h-14 lg:h-16 flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
            aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
          >
            <span className="relative w-5 h-5">
              <Menu
                className={[
                  'absolute inset-0 w-5 h-5 transition-all duration-200 ease-out',
                  isSidebarOpen ? 'scale-0 opacity-0 rotate-90' : 'scale-100 opacity-100 rotate-0',
                ].join(' ')}
              />
              <X
                className={[
                  'absolute inset-0 w-5 h-5 transition-all duration-200 ease-out',
                  isSidebarOpen ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 -rotate-90',
                ].join(' ')}
              />
            </span>
          </button>
        )}
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
          {getPageTitle()}
        </h2>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 lg:gap-4 flex-shrink-0">
        <LocaleSwitcher />
        <button
          className="p-2 sm:p-2.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
          aria-label={t('notifications')}
        >
          <Bell className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center space-x-3">
          <div className="text-right max-w-[140px] lg:max-w-none">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profile?.name || t('specialist')}
              </p>
              {isSuperAdmin && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded flex-shrink-0">
                  <Shield className="w-3 h-3 mr-1" />
                  {t('superAdmin')}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
          </div>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isSuperAdmin ? 'bg-purple-100' : 'bg-primary-100'
            }`}
          >
            {isSuperAdmin ? (
              <Shield className="w-5 h-5 text-purple-600" />
            ) : (
              <User className="w-5 h-5 text-primary-600" />
            )}
          </div>
        </div>
        <div className="flex sm:hidden w-9 h-9 rounded-full bg-primary-100 items-center justify-center flex-shrink-0">
          {isSuperAdmin ? (
            <Shield className="w-4 h-4 text-purple-600" />
          ) : (
            <User className="w-4 h-4 text-primary-600" />
          )}
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] sm:min-h-0"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">{t('signOut')}</span>
        </button>
      </div>
    </header>
  )
}
