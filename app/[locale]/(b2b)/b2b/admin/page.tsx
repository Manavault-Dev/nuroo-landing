'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import {
  Building2,
  Plus,
  Key,
  Copy,
  Check,
  Users,
  Shield,
  UserPlus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface Organization {
  orgId: string
  name: string
  country?: string | null
  createdAt?: string | null
  createdBy?: string | null
  isActive?: boolean
}

interface InviteCode {
  code: string
  inviteLink: string
  orgId: string
  orgName: string
  role: string
  expiresAt: string | null
  maxUses: number | null
}

interface SuperAdmin {
  uid: string
  email: string
  displayName: string | null
  createdAt: string
  lastSignIn: string | null
}

export default function AdminPage() {
  const router = useRouter()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([])

  // Create organization form
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgCountry, setOrgCountry] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)

  // Generate invite form
  const [showGenerateInvite, setShowGenerateInvite] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [inviteRole, setInviteRole] = useState<'org_admin' | 'specialist' | 'parent'>('org_admin')
  const [inviteExpiresAt, setInviteExpiresAt] = useState('')
  const [inviteMaxUses, setInviteMaxUses] = useState('')
  const [generatingInvite, setGeneratingInvite] = useState(false)

  // Super Admin management
  const [showAddSuperAdmin, setShowAddSuperAdmin] = useState(false)
  const [newSuperAdminEmail, setNewSuperAdminEmail] = useState('')
  const [addingSuperAdmin, setAddingSuperAdmin] = useState(false)
  const [removingSuperAdmin, setRemovingSuperAdmin] = useState<string | null>(null)

  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Organization details state
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)
  const [orgSpecialists, setOrgSpecialists] = useState<Record<string, unknown[]>>({})
  const [orgParents, setOrgParents] = useState<Record<string, unknown[]>>({})
  const [loadingOrgData, setLoadingOrgData] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const checkSuperAdmin = async () => {
      const user = getCurrentUser()
      if (!user) {
        router.push('/b2b/login')
        return
      }

      try {
        const idToken = await getIdToken(true) // Force refresh to get latest claims
        if (!idToken) {
          router.push('/b2b/login')
          return
        }
        apiClient.setToken(idToken)

        // Check if user is Super Admin
        const checkResult = await apiClient.checkSuperAdmin()
        if (!checkResult.isSuperAdmin) {
          router.push('/b2b')
          return
        }

        setIsSuperAdmin(true)
        await loadData()
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        if (errorMessage.includes('403') || errorMessage.includes('Super admin')) {
          router.push('/b2b')
          return
        }
        setError(errorMessage || 'Failed to check super admin status')
      } finally {
        setLoading(false)
      }
    }

    checkSuperAdmin()
  }, [router])

  const loadData = async () => {
    try {
      const [orgsData, invitesData, superAdminsData] = await Promise.all([
        apiClient.listOrganizations(),
        apiClient.listInvites(),
        apiClient.listSuperAdmins(),
      ])
      setOrganizations(orgsData.organizations)
      setInvites(invitesData.invites)
      setSuperAdmins(superAdminsData.superAdmins)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data'
      setError(errorMessage)
    }
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCreatingOrg(true)

    try {
      const result = await apiClient.createOrganization(
        orgName.trim(),
        orgCountry.trim() || undefined
      )

      // Reset form
      setOrgName('')
      setOrgCountry('')
      setShowCreateOrg(false)

      // Reload data
      await loadData()

      // Show success message
      alert(`Organization "${result.name}" created successfully!`)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create organization'
      setError(errorMessage)
    } finally {
      setCreatingOrg(false)
    }
  }

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedOrgId) {
      setError('Please select an organization')
      return
    }

    setGeneratingInvite(true)

    try {
      const result = await apiClient.generateInviteCode({
        orgId: selectedOrgId,
        role: inviteRole,
        expiresAt: inviteExpiresAt || undefined,
        maxUses: inviteMaxUses ? parseInt(inviteMaxUses) : undefined,
      })

      // Reload invites list to get full data
      const invitesData = await apiClient.listInvites()
      setInvites(invitesData.invites)

      // Reset form
      setSelectedOrgId('')
      setInviteRole('org_admin')
      setInviteExpiresAt('')
      setInviteMaxUses('')
      setShowGenerateInvite(false)

      // Copy to clipboard
      await copyToClipboard(result.inviteLink)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate invite code'
      setError(errorMessage)
    } finally {
      setGeneratingInvite(false)
    }
  }

  const handleAddSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setAddingSuperAdmin(true)

    try {
      const result = await apiClient.grantSuperAdmin(newSuperAdminEmail.trim())
      await loadData()
      setNewSuperAdminEmail('')
      setShowAddSuperAdmin(false)
      alert(
        `Super Admin rights granted to ${result.email}. They need to sign out and sign in again.`
      )
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to grant Super Admin rights'
      setError(errorMessage)
    } finally {
      setAddingSuperAdmin(false)
    }
  }

  const handleRemoveSuperAdmin = async (uid: string) => {
    if (!confirm('Are you sure you want to remove Super Admin rights from this user?')) {
      return
    }

    setRemovingSuperAdmin(uid)
    setError('')

    try {
      await apiClient.removeSuperAdmin(uid)
      await loadData()
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to remove Super Admin rights'
      setError(errorMessage)
    } finally {
      setRemovingSuperAdmin(null)
    }
  }

  const loadOrgData = async (orgId: string) => {
    if (orgSpecialists[orgId] && orgParents[orgId]) {
      return
    }

    setLoadingOrgData((prev) => ({ ...prev, [orgId]: true }))
    try {
      const [specialistsData, parentsData] = await Promise.all([
        apiClient.getOrgSpecialists(orgId).catch(() => ({ ok: true, specialists: [], count: 0 })),
        apiClient.getOrgParents(orgId).catch(() => ({ ok: true, parents: [], count: 0 })),
      ])

      setOrgSpecialists((prev) => ({ ...prev, [orgId]: specialistsData.specialists || [] }))
      setOrgParents((prev) => ({ ...prev, [orgId]: parentsData.parents || [] }))
    } finally {
      setLoadingOrgData((prev) => ({ ...prev, [orgId]: false }))
    }
  }

  const toggleOrgExpanded = (orgId: string) => {
    if (expandedOrg === orgId) {
      setExpandedOrg(null)
    } else {
      setExpandedOrg(orgId)
      loadOrgData(orgId)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      const code = text.split('code=')[1]?.split('&')[0] || text
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      // Clipboard API not available
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return null
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Super Admin Panel</h1>
            <p className="mt-2 text-gray-600">Manage organizations and generate invite codes</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowCreateOrg(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Create Organization</span>
            </button>
            <button
              onClick={() => setShowGenerateInvite(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-secondary-500 text-white rounded-lg hover:bg-secondary-600 transition-colors"
            >
              <Key className="w-5 h-5" />
              <span>Generate Invite</span>
            </button>
            <button
              onClick={() => setShowAddSuperAdmin(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              <span>Add Super Admin</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Organization</h2>
            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter organization name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country (optional)
                </label>
                <input
                  type="text"
                  value={orgCountry}
                  onChange={(e) => setOrgCountry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., US, UK, etc."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={creatingOrg}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  {creatingOrg ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateOrg(false)
                    setOrgName('')
                    setOrgCountry('')
                    setError('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Invite Modal */}
      {showGenerateInvite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Generate Invite Code</h2>
            <form onSubmit={handleGenerateInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization *
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Select an organization</option>
                  {organizations.map((org) => (
                    <option key={org.orgId} value={org.orgId}>
                      {org.name} {org.country ? `(${org.country})` : ''}
                    </option>
                  ))}
                </select>
                {organizations.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    No organizations yet. Create one first!
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as 'org_admin' | 'specialist' | 'parent')
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="org_admin">Organization Admin</option>
                  <option value="specialist">Specialist</option>
                  <option value="parent">Parent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expires At (optional)
                </label>
                <input
                  type="datetime-local"
                  value={inviteExpiresAt}
                  onChange={(e) => setInviteExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Uses (optional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={inviteMaxUses}
                  onChange={(e) => setInviteMaxUses(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Leave empty for unlimited"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={generatingInvite}
                  className="flex-1 px-4 py-2 bg-secondary-500 text-white rounded-lg hover:bg-secondary-600 disabled:opacity-50"
                >
                  {generatingInvite ? 'Generating...' : 'Generate'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGenerateInvite(false)
                    setSelectedOrgId('')
                    setInviteRole('org_admin')
                    setInviteExpiresAt('')
                    setInviteMaxUses('')
                    setError('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Super Admin Modal */}
      {showAddSuperAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Super Admin</h2>
            <form onSubmit={handleAddSuperAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">User Email *</label>
                <input
                  type="email"
                  required
                  value={newSuperAdminEmail}
                  onChange={(e) => setNewSuperAdminEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="user@example.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  User must already have an account. They will need to sign out and sign in again
                  after you grant Super Admin rights.
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={addingSuperAdmin}
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                >
                  {addingSuperAdmin ? 'Adding...' : 'Add Super Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSuperAdmin(false)
                    setNewSuperAdminEmail('')
                    setError('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Organizations List */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Organizations</h2>
        {organizations.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No organizations yet. Create your first organization!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {organizations.map((org) => (
              <div
                key={org.orgId}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleOrgExpanded(org.orgId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{org.name}</h3>
                      {org.country && <p className="text-sm text-gray-500 mt-1">{org.country}</p>}
                      <p className="text-xs text-gray-400 mt-2">ID: {org.orgId}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {orgSpecialists[org.orgId]?.length || 0} specialists,{' '}
                        {orgParents[org.orgId]?.length || 0} parents
                      </span>
                      {expandedOrg === org.orgId ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedOrg === org.orgId && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    {loadingOrgData[org.orgId] ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                        <p className="text-sm text-gray-500 mt-2">Loading...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Specialists */}
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                            <Users className="w-5 h-5 mr-2" />
                            Specialists ({orgSpecialists[org.orgId]?.length || 0})
                          </h4>
                          {orgSpecialists[org.orgId] && orgSpecialists[org.orgId].length > 0 ? (
                            <div className="space-y-2">
                              {orgSpecialists[org.orgId].map((spec: any) => (
                                <div
                                  key={spec.uid}
                                  className="bg-white p-3 rounded border border-gray-200"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-gray-900">{spec.name}</p>
                                      <p className="text-sm text-gray-500">{spec.email}</p>
                                      <p className="text-xs text-gray-400 mt-1">
                                        Role: {spec.role}
                                      </p>
                                    </div>
                                    {spec.joinedAt && (
                                      <p className="text-xs text-gray-400">
                                        Joined: {new Date(spec.joinedAt).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No specialists yet</p>
                          )}
                        </div>

                        {/* Parents */}
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                            <UserPlus className="w-5 h-5 mr-2" />
                            Parents ({orgParents[org.orgId]?.length || 0})
                          </h4>
                          {orgParents[org.orgId] && orgParents[org.orgId].length > 0 ? (
                            <div className="space-y-3">
                              {orgParents[org.orgId].map((parent: any) => (
                                <div
                                  key={parent.id}
                                  className="bg-white p-3 rounded border border-gray-200"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900">{parent.name}</p>
                                      {parent.email && (
                                        <p className="text-sm text-gray-500">{parent.email}</p>
                                      )}
                                      {parent.createdAt && (
                                        <p className="text-xs text-gray-400 mt-1">
                                          Linked: {new Date(parent.createdAt).toLocaleDateString()}
                                        </p>
                                      )}

                                      {/* Children for this parent */}
                                      {parent.linkedChildren && parent.linkedChildren.length > 0 ? (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                          <p className="text-xs font-medium text-gray-700 mb-2">
                                            Children ({parent.linkedChildren.length}):
                                          </p>
                                          <div className="space-y-2">
                                            {parent.linkedChildren.map((child: any) => (
                                              <div
                                                key={child.id}
                                                className="bg-gray-50 p-2 rounded text-sm"
                                              >
                                                <p className="font-medium text-gray-900">
                                                  {child.name}
                                                </p>
                                                {child.age && (
                                                  <p className="text-xs text-gray-500">
                                                    Age: {child.age}
                                                  </p>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                          <p className="text-xs text-gray-400">
                                            No children linked yet
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No parents yet</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Invite Codes */}
      {invites.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Recent Invite Codes</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Organization
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Expires
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invites.map((invite) => (
                  <tr key={invite.code}>
                    <td className="px-4 py-3">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {invite.code}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{invite.orgName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-primary-100 text-primary-800">
                        {invite.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => copyToClipboard(invite.inviteLink)}
                        className="text-primary-600 hover:text-primary-800"
                        title="Copy invite link"
                      >
                        {copiedCode === invite.code ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Super Admin Management */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Super Admins</h2>
          <span className="text-sm text-gray-500">{superAdmins.length} total</span>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Last Sign In
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {superAdmins.map((admin) => (
                <tr key={admin.uid}>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-gray-900">{admin.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {admin.lastSignIn ? new Date(admin.lastSignIn).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRemoveSuperAdmin(admin.uid)}
                      disabled={removingSuperAdmin === admin.uid}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      title="Remove Super Admin rights"
                    >
                      {removingSuperAdmin === admin.uid ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
