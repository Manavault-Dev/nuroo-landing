'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import { Users, Plus, Edit2, Trash2, X, Save, UserPlus } from 'lucide-react'

interface Group {
  id: string
  name: string
  description: string | null
  color: string
  orgId: string
  parentCount: number
  createdAt: string | null
  updatedAt: string | null
}

interface Parent {
  parentUserId: string
  name: string
  email: string | null
  children: Array<{
    id: string
    name: string
    age?: number
  }>
  addedAt: string | null
}

export default function GroupsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)

  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [groupColor, setGroupColor] = useState('#6366f1')
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [groupParents, setGroupParents] = useState<Parent[]>([])
  const [loadingGroupDetails, setLoadingGroupDetails] = useState(false)
  const [showAddParentModal, setShowAddParentModal] = useState(false)
  const [availableParents, setAvailableParents] = useState<any[]>([])
  const [selectedParentId, setSelectedParentId] = useState('')
  const [loadingParents, setLoadingParents] = useState(false)

  const presetColors = [
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#ef4444',
    '#14b8a6',
  ]

  useEffect(() => {
    const loadData = async () => {
      const user = getCurrentUser()
      if (!user) {
        router.push('/b2b/login')
        return
      }

      try {
        const idToken = await getIdToken()
        if (!idToken) {
          router.push('/b2b/login')
          return
        }
        apiClient.setToken(idToken)

        const orgIdParam = searchParams.get('orgId')
        if (!orgIdParam) {
          try {
            const profile = await apiClient.getMe()
            const firstOrg = profile.organizations[0]
            if (firstOrg) {
              setOrgId(firstOrg.orgId)
              router.replace(`/b2b/groups?orgId=${firstOrg.orgId}`)
              return
            }
          } catch (err) {
            console.error('Failed to get profile:', err)
          }
          router.push('/b2b')
          return
        }

        setOrgId(orgIdParam)
        await loadGroups(orgIdParam)
      } catch {
        router.push('/b2b/login')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, searchParams])

  const loadGroups = async (orgId: string) => {
    try {
      const data = await apiClient.getGroups(orgId)
      setGroups(data.groups || [])
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load groups'
      alert(errorMessage)
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !groupName.trim()) return

    try {
      if (editingGroup) {
        await apiClient.updateGroup(orgId, editingGroup.id, {
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
          color: groupColor,
        })
      } else {
        await apiClient.createGroup(
          orgId,
          groupName.trim(),
          groupDescription.trim() || undefined,
          groupColor
        )
      }

      await loadGroups(orgId)
      setShowGroupModal(false)
      resetGroupForm()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save group'
      alert(errorMessage)
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!orgId) return
    if (
      !confirm(
        'Are you sure you want to delete this group? All parents will be removed from the group.'
      )
    ) {
      return
    }

    try {
      await apiClient.deleteGroup(orgId, groupId)
      await loadGroups(orgId)
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null)
        setGroupParents([])
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete group'
      alert(errorMessage)
    }
  }

  const handleViewGroup = async (group: Group) => {
    if (!orgId) return

    setSelectedGroup(group)
    setLoadingGroupDetails(true)

    try {
      const data = await apiClient.getGroup(orgId, group.id)
      setGroupParents(data.group.parents || [])
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load group details'
      alert(errorMessage)
    } finally {
      setLoadingGroupDetails(false)
    }
  }

  const handleOpenAddParent = async () => {
    if (!orgId) return

    setLoadingParents(true)
    try {
      const parentsData = await apiClient.getParents(orgId)
      setAvailableParents(parentsData.parents || [])
      setShowAddParentModal(true)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load parents'
      alert(errorMessage)
    } finally {
      setLoadingParents(false)
    }
  }

  const handleAddParent = async () => {
    if (!orgId || !selectedGroup || !selectedParentId) return

    try {
      await apiClient.addParentToGroup(orgId, selectedGroup.id, selectedParentId)
      await handleViewGroup(selectedGroup) // Reload group details
      setShowAddParentModal(false)
      setSelectedParentId('')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add parent to group'
      alert(errorMessage)
    }
  }

  const handleRemoveParent = async (parentUserId: string) => {
    if (!orgId || !selectedGroup) return
    if (!confirm('Remove this parent from the group?')) return

    try {
      await apiClient.removeParentFromGroup(orgId, selectedGroup.id, parentUserId)
      await handleViewGroup(selectedGroup) // Reload group details
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to remove parent from group'
      alert(errorMessage)
    }
  }

  const resetGroupForm = () => {
    setEditingGroup(null)
    setGroupName('')
    setGroupDescription('')
    setGroupColor('#6366f1')
  }

  const openCreateModal = () => {
    resetGroupForm()
    setShowGroupModal(true)
  }

  const openEditModal = (group: Group) => {
    setEditingGroup(group)
    setGroupName(group.name)
    setGroupDescription(group.description || '')
    setGroupColor(group.color)
    setShowGroupModal(true)
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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Groups</h1>
            <p className="mt-2 text-gray-600">Organize parents into groups for better management</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No groups yet</h3>
          <p className="text-gray-600 mb-6">Create your first group to organize parents</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Group</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleViewGroup(group)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: group.color }} />
                  <h3 className="font-semibold text-gray-900">{group.name}</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditModal(group)
                    }}
                    className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                    title="Edit group"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteGroup(group.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete group"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {group.description && (
                <p className="text-sm text-gray-600 mb-4">{group.description}</p>
              )}

              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Users className="w-4 h-4" />
                <span>
                  {group.parentCount} parent{group.parentCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingGroup ? 'Edit Group' : 'Create Group'}</h2>
              <button
                onClick={() => {
                  setShowGroupModal(false)
                  resetGroupForm()
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Name *</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., Morning Group, Evening Group"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Add a description for this group"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-2">
                    {presetColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setGroupColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          groupColor === color
                            ? 'border-gray-900 scale-110'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={groupColor}
                    onChange={(e) => setGroupColor(e.target.value)}
                    className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Save className="w-4 h-4 inline mr-2" />
                  {editingGroup ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupModal(false)
                    resetGroupForm()
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: selectedGroup.color }}
                />
                <h2 className="text-xl font-bold">{selectedGroup.name}</h2>
              </div>
              <button
                onClick={() => {
                  setSelectedGroup(null)
                  setGroupParents([])
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedGroup.description && (
              <p className="text-gray-600 mb-6">{selectedGroup.description}</p>
            )}

            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Parents ({groupParents.length})</h3>
              <button
                onClick={handleOpenAddParent}
                className="flex items-center space-x-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Parent</span>
              </button>
            </div>

            {loadingGroupDetails ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : groupParents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No parents in this group yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupParents.map((parent) => (
                  <div
                    key={parent.parentUserId}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{parent.name}</p>
                        {parent.email && <p className="text-sm text-gray-500">{parent.email}</p>}
                        {parent.children.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-gray-700 mb-2">Children:</p>
                            <div className="space-y-1">
                              {parent.children.map((child) => (
                                <div key={child.id} className="text-sm text-gray-600">
                                  • {child.name}
                                  {child.age && ` (${child.age} years old)`}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveParent(parent.parentUserId)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove from group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showAddParentModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Add Parent to Group</h2>
              <button
                onClick={() => {
                  setShowAddParentModal(false)
                  setSelectedParentId('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingParents ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Parent
                  </label>
                  <select
                    value={selectedParentId}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Choose a parent...</option>
                    {availableParents
                      .filter((p) => !groupParents.some((gp) => gp.parentUserId === p.id))
                      .map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {parent.name} {parent.email && `(${parent.email})`}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleAddParent}
                    disabled={!selectedParentId}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Parent
                  </button>
                  <button
                    onClick={() => {
                      setShowAddParentModal(false)
                      setSelectedParentId('')
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
