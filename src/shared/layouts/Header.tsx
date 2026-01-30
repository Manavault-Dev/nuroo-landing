'use client'

import { useState, useEffect } from 'react'
import { LogOut, User, Bell, Shield } from 'lucide-react'
import { apiClient } from '@/src/shared/lib/api'
import type { SpecialistProfile } from '@/src/shared/types'

interface HeaderProps {
  profile: SpecialistProfile | null
  onSignOut: () => void
}

export function Header({ profile, onSignOut }: HeaderProps) {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const result = await apiClient.get<{ isSuperAdmin: boolean }>('/dev/check-super-admin')
        setIsSuperAdmin(result.isSuperAdmin)
      } catch {
        setIsSuperAdmin(false)
      }
    }

    if (profile) {
      checkSuperAdmin()
    }
  }, [profile])

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
      </div>

      <div className="flex items-center space-x-4">
        <button
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium text-gray-900">{profile?.name || 'Specialist'}</p>
              {isSuperAdmin && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                  <Shield className="w-3 h-3 mr-1" />
                  Super Admin
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{profile?.email}</p>
          </div>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
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

        <button
          onClick={onSignOut}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  )
}
