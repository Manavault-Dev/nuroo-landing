'use client'

import { signOut } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import { useRouter } from 'next/navigation'
import { LogOut, User, Bell } from 'lucide-react'
import { type SpecialistProfile } from '@/lib/b2b/api'

interface HeaderProps {
  profile: SpecialistProfile | null
}

export function Header({ profile }: HeaderProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await signOut()
      apiClient.setToken(null)
      router.push('/b2b/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

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
            <p className="text-sm font-medium text-gray-900">{profile?.name || 'Specialist'}</p>
            <p className="text-xs text-gray-500">{profile?.email}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="w-5 h-5 text-primary-600" />
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  )
}


