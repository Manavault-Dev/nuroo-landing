'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'
import type {
  Assignment,
  AssignmentDetail,
  ContentRoadmapItem,
  ContentTaskItem,
  Group,
  Parent,
  Submission,
} from './types'
import {
  mapAssignmentsFromHistory,
  mapConnectionsToParents,
  mapContentRoadmaps,
  mapContentTasks,
} from './mappers'
import { PRESET_COLORS, formatDate, pluralChildren } from './utils'
import { Modal, Skeleton, Toast } from './ui'
import { useAlert } from '@/components/ui/AlertDialog'
import {
  AssignmentsTab,
  GroupCard,
  Lightbox,
  MembersTab,
  SubmissionCard,
  SubmissionImagePreview,
} from './components'
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  UserPlus,
  UserCircle,
  ClipboardList,
  Loader2,
  Copy,
  Check,
  Send,
  ThumbsUp,
  RotateCcw,
  Clock,
  BookOpen,
  ArrowLeft,
  Lock,
  Unlock,
  FileText,
  ChevronDown,
  ChevronUp,
  ListChecks,
} from 'lucide-react'

// ─── GroupsPage (Main) ────────────────────────────────────────────────────────

export default function GroupsPage() {
  const t = useTranslations('b2b.pages.groups')
  const locale = useLocale()
  const router = useRouter()
  const { profile, orgId: resolvedOrgId, isAdmin, isLoading: authLoading } = usePageAuth()

  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const isOrgAdmin = isAdmin
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const { confirm } = useAlert()

  // Group panel (right drawer)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [groupParents, setGroupParents] = useState<Parent[]>([])
  const [groupAssignments, setGroupAssignments] = useState<Assignment[]>([])
  const [groupDetailLoading, setGroupDetailLoading] = useState(false)
  const [groupPanelTab, setGroupPanelTab] = useState<'assignments' | 'members'>('assignments')

  // Assignment detail (full-screen overlay)
  const [assignmentDetail, setAssignmentDetail] = useState<AssignmentDetail | null>(null)
  const [assignmentDetailLoading, setAssignmentDetailLoading] = useState(false)
  const [submissionFilter, setSubmissionFilter] = useState<
    'all' | 'pending' | 'submitted' | 'graded'
  >('all')

  // Roadmap accordion (expanded ids in assignment detail)
  const [expandedRoadmapIds, setExpandedRoadmapIds] = useState<Set<string>>(new Set())

  // Grade modal
  const [gradeTarget, setGradeTarget] = useState<Submission | null>(null)
  const [gradeValue, setGradeValue] = useState<'approved' | 'needs_revision'>('approved')
  const [feedbackInput, setFeedbackInput] = useState('')
  const [submittingGrade, setSubmittingGrade] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Group form modal
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [groupColor, setGroupColor] = useState('#6366f1')
  const [savingGroup, setSavingGroup] = useState(false)

  // Assign from library modal
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [contentTaskLibrary, setContentTaskLibrary] = useState<ContentTaskItem[]>([])
  const [contentRoadmapLibrary, setContentRoadmapLibrary] = useState<ContentRoadmapItem[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set())
  const [selectedRoadmapIds, setSelectedRoadmapIds] = useState<Set<string>>(new Set())
  const [assignDueDate, setAssignDueDate] = useState('')
  const [creatingAssignment, setCreatingAssignment] = useState(false)

  // Parent management
  const [showAddParentModal, setShowAddParentModal] = useState(false)
  const [availableParents, setAvailableParents] = useState<Parent[]>([])
  const [selectedParentId, setSelectedParentId] = useState('')
  const [parentSearchQuery, setParentSearchQuery] = useState('')
  const [loadingParents, setLoadingParents] = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  // Invite
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [copiedInvite, setCopiedInvite] = useState(false)

  const showToast = (message: string, type: 'success' | 'error' = 'success') =>
    setToast({ message, type })

  const canManageGroup = useCallback(
    (group: Group | null | undefined) => {
      if (!group) return false
      return !group.ownerId || group.ownerId === profile?.uid
    },
    [profile?.uid]
  )

  // ─── Auth ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/b2b/login')
      return
    }
    if (!authLoading && profile && resolvedOrgId) {
      setOrgId(resolvedOrgId)
      loadGroups(resolvedOrgId).finally(() => setLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile, resolvedOrgId, router])

  const loadGroups = async (oid: string) => {
    try {
      const data = await apiClient.getGroups(oid)
      setGroups(data.groups || [])
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorLoadGroups'), 'error')
    }
  }

  // ─── Group panel ────────────────────────────────────────────────────────────

  const handleSelectGroup = useCallback(
    async (group: Group) => {
      if (!orgId) return
      setSelectedGroup(group)
      setGroupPanelTab('assignments')
      setGroupDetailLoading(true)
      setGroupParents([])
      setGroupAssignments([])
      setAssignmentDetail(null)
      try {
        const [detailData, historyData] = await Promise.all([
          apiClient.getGroup(orgId, group.id, group.ownerId),
          apiClient
            .getGroupAssignments(orgId, group.id, group.ownerId)
            .catch(() => ({ assignments: [] })),
        ])
        setGroupParents(detailData.group?.parents || [])
        const raw = historyData.assignments || []
        const mapped = mapAssignmentsFromHistory(raw, t('assignmentDefaultTitle'))
        setGroupAssignments(mapped)

        // Sync the group card with live assignment data so it never shows
        // stale titles. Use assignment-level titles (matching the panel list)
        // rather than individual task titles from inside each assignment.
        const liveSummary = {
          lastAssignedAt: mapped[0]?.assignedAt ?? null,
          lastAssignedTaskTitles: mapped.length > 0 ? mapped.slice(0, 3).map((a) => a.title) : null,
        }
        setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, ...liveSummary } : g)))
        setSelectedGroup((prev) => (prev ? { ...prev, ...liveSummary } : prev))
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : t('errorLoadGroup'), 'error')
      } finally {
        setGroupDetailLoading(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [orgId, t]
  )

  // ─── Assignment detail ──────────────────────────────────────────────────────

  const handleSelectAssignment = useCallback(
    async (assignment: Assignment) => {
      if (!orgId || !selectedGroup) return
      setAssignmentDetailLoading(true)
      setAssignmentDetail(null)
      setSubmissionFilter('all')
      setExpandedRoadmapIds(new Set())
      try {
        const detailRes = await apiClient.getGroupAssignment(
          orgId,
          selectedGroup.id,
          assignment.id,
          selectedGroup.ownerId
        )
        setAssignmentDetail(detailRes.assignment as AssignmentDetail)
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : t('errorLoadAssignment'), 'error')
      } finally {
        setAssignmentDetailLoading(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [orgId, selectedGroup, t]
  )

  // ─── Group CRUD ─────────────────────────────────────────────────────────────

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !groupName.trim()) return
    setSavingGroup(true)
    try {
      if (editingGroup) {
        await apiClient.updateGroup(orgId, editingGroup.id, {
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
          color: groupColor,
        })
        showToast(t('toastGroupUpdated'))
      } else {
        await apiClient.createGroup(
          orgId,
          groupName.trim(),
          groupDescription.trim() || undefined,
          groupColor
        )
        showToast(t('toastGroupCreated'))
      }
      await loadGroups(orgId)
      setShowGroupModal(false)
      resetGroupForm()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorGeneric'), 'error')
    } finally {
      setSavingGroup(false)
    }
  }

  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!orgId) return
    const confirmed = await confirm(t('confirmDeleteGroup'))
    if (!confirmed) return
    try {
      await apiClient.deleteGroup(orgId, groupId)
      if (selectedGroup?.id === groupId) setSelectedGroup(null)
      setGroups((prev) => prev.filter((g) => g.id !== groupId))
      showToast(t('toastGroupDeleted'))
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorGeneric'), 'error')
    }
  }

  const resetGroupForm = () => {
    setEditingGroup(null)
    setGroupName('')
    setGroupDescription('')
    setGroupColor('#6366f1')
  }
  const openEditGroupModal = (group: Group, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingGroup(group)
    setGroupName(group.name)
    setGroupDescription(group.description || '')
    setGroupColor(group.color)
    setShowGroupModal(true)
  }

  // ─── Assignment CRUD ─────────────────────────────────────────────────────────

  const openAssignFromLibraryModal = async () => {
    if (!orgId) return
    setShowAssignmentModal(true)
    setSelectedContentIds(new Set())
    setSelectedRoadmapIds(new Set())
    setAssignDueDate('')
    setLoadingLibrary(true)
    try {
      const [tasksRes, roadmapsRes] = await Promise.all([
        apiClient.getOrgContentTasks(orgId),
        apiClient.getOrgContentRoadmaps(orgId),
      ])
      setContentTaskLibrary(mapContentTasks(tasksRes.tasks || []))
      setContentRoadmapLibrary(mapContentRoadmaps(roadmapsRes.roadmaps || [], t('noName')))
    } catch {
      showToast(t('errorLibrary'), 'error')
    } finally {
      setLoadingLibrary(false)
    }
  }

  const handleAssignFromLibrary = async (e: React.FormEvent) => {
    e.preventDefault()
    const taskIds = Array.from(selectedContentIds)
    const roadmapIds = Array.from(selectedRoadmapIds)
    if (!orgId || !selectedGroup || (taskIds.length === 0 && roadmapIds.length === 0)) return
    setCreatingAssignment(true)
    try {
      await apiClient.assignGroupTasks(
        orgId,
        selectedGroup.id,
        taskIds,
        assignDueDate || null,
        selectedGroup.ownerId,
        roadmapIds
      )
      const parts: string[] = []
      if (selectedContentIds.size > 0) parts.push(t('partTasks', { n: selectedContentIds.size }))
      if (selectedRoadmapIds.size > 0) parts.push(t('partPrograms', { n: selectedRoadmapIds.size }))
      showToast(
        parts.length
          ? t('toastAssigned', {
              details: parts.join(', '),
              count: selectedContentIds.size + selectedRoadmapIds.size,
            })
          : t('toastAssignedCount', { count: selectedContentIds.size + selectedRoadmapIds.size })
      )
      setShowAssignmentModal(false)
      setSelectedContentIds(new Set())
      setSelectedRoadmapIds(new Set())
      setAssignDueDate('')
      await handleSelectGroup(selectedGroup)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorAssign'), 'error')
    } finally {
      setCreatingAssignment(false)
    }
  }

  const toggleContentId = (id: string) => {
    setSelectedContentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleRoadmapId = (id: string) => {
    setSelectedRoadmapIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalTasksToAssign = (() => {
    let n = selectedContentIds.size
    for (const roadmapId of selectedRoadmapIds) {
      const r = contentRoadmapLibrary.find((x) => x.id === roadmapId)
      if (r?.taskIds?.length) n += r.taskIds.length
    }
    return n
  })()
  const hasSelection = selectedContentIds.size > 0 || selectedRoadmapIds.size > 0
  const libraryEmpty = contentTaskLibrary.length === 0 && contentRoadmapLibrary.length === 0

  const handleDeleteAssignment = async (a: Assignment) => {
    if (!orgId || !selectedGroup) return
    const confirmedDeleteAssignment = await confirm(
      t('confirmDeleteAssignment', { title: a.title })
    )
    if (!confirmedDeleteAssignment) return
    try {
      await apiClient.deleteGroupAssignment(orgId, selectedGroup.id, a.id)
      const remainingAssignments = groupAssignments.filter((x) => x.id !== a.id)
      // Use assignment titles (matching the panel) — not internal task titles.
      // Do NOT call loadGroups() here: the backend doesn't update
      // lastAssignedTaskTitles on delete, so re-fetching would overwrite the
      // correct local state with stale data.
      const nextGroupSummary = {
        lastAssignedAt: remainingAssignments[0]?.assignedAt ?? null,
        lastAssignedTaskTitles:
          remainingAssignments.length > 0
            ? remainingAssignments.slice(0, 3).map((x) => x.title)
            : null,
      }

      setGroupAssignments(remainingAssignments)
      setGroups((prev) =>
        prev.map((group) =>
          group.id === selectedGroup.id ? { ...group, ...nextGroupSummary } : group
        )
      )
      setSelectedGroup((prev) => (prev ? { ...prev, ...nextGroupSummary } : prev))
      if (assignmentDetail?.id === a.id) setAssignmentDetail(null)
      showToast(t('toastAssignmentDeleted'))
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorGeneric'), 'error')
    }
  }

  const handleToggleAssignmentStatus = async (a: Assignment) => {
    if (!orgId || !selectedGroup) return
    const newStatus = a.status === 'active' ? 'closed' : 'active'
    try {
      await apiClient.updateGroupAssignment(orgId, selectedGroup.id, a.id, { status: newStatus })
      setGroupAssignments((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, status: newStatus } : x))
      )
      if (assignmentDetail?.id === a.id)
        setAssignmentDetail((prev) => (prev ? { ...prev, status: newStatus } : prev))
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorGeneric'), 'error')
    }
  }

  // ─── Grading ─────────────────────────────────────────────────────────────────

  const handleSubmitGrade = async () => {
    if (!orgId || !selectedGroup || !assignmentDetail || !gradeTarget) return
    setSubmittingGrade(true)
    try {
      await apiClient.reviewSubmission(
        orgId,
        selectedGroup.id,
        assignmentDetail.id,
        gradeTarget.childId,
        {
          grade: gradeValue,
          feedback: feedbackInput.trim() || undefined,
        }
      )
      setAssignmentDetail((prev) =>
        prev
          ? {
              ...prev,
              submissions: prev.submissions.map((s) =>
                s.childId === gradeTarget.childId
                  ? {
                      ...s,
                      grade: gradeValue,
                      feedback: feedbackInput.trim() || null,
                      status: 'graded',
                    }
                  : s
              ),
            }
          : prev
      )
      showToast(gradeValue === 'approved' ? t('toastWorkApproved') : t('toastSentForRevision'))
      setGradeTarget(null)
      setGradeValue('approved')
      setFeedbackInput('')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorGeneric'), 'error')
    } finally {
      setSubmittingGrade(false)
    }
  }

  // ─── Parent management ────────────────────────────────────────────────────────

  const handleOpenAddParent = async () => {
    if (!orgId) return
    setLoadingParents(true)
    try {
      const data = await apiClient.getConnections(orgId)
      setAvailableParents(mapConnectionsToParents(data.connections || [], t('unnamed')))
      setShowAddParentModal(true)
      setParentSearchQuery('')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorLoadParents'), 'error')
    } finally {
      setLoadingParents(false)
    }
  }

  const handleAddParent = async () => {
    if (!orgId || !selectedGroup || !selectedParentId) return
    try {
      await apiClient.addParentToGroup(orgId, selectedGroup.id, selectedParentId)
      await handleSelectGroup(selectedGroup)
      setShowAddParentModal(false)
      setSelectedParentId('')
      setParentSearchQuery('')
      showToast(t('toastParentAdded'))
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorGeneric'), 'error')
    }
  }

  const handleRemoveParent = async (parentUserId: string) => {
    if (!orgId || !selectedGroup) return
    const confirmedRemoveParent = await confirm(t('confirmRemoveParent'))
    if (!confirmedRemoveParent) return
    try {
      await apiClient.removeParentFromGroup(orgId, selectedGroup.id, parentUserId)
      setGroupParents((prev) => prev.filter((p) => p.parentUserId !== parentUserId))
      showToast(t('toastParentRemoved'))
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorGeneric'), 'error')
    }
  }

  const handleDisconnect = async (parentUserId: string) => {
    if (!orgId || !isOrgAdmin) return
    const confirmedDisconnect = await confirm(t('confirmDisconnectParent'))
    if (!confirmedDisconnect) return
    setDisconnecting(parentUserId)
    try {
      await apiClient.disconnectParent(orgId, parentUserId)
      setGroupParents((prev) => prev.filter((p) => p.parentUserId !== parentUserId))
      showToast(t('toastParentDisconnected'))
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorGeneric'), 'error')
    } finally {
      setDisconnecting(null)
    }
  }

  const handleCreateInvite = async () => {
    if (!orgId) return
    setGeneratingInvite(true)
    try {
      const result = await apiClient.createParentInvite(orgId)
      setInviteCode(result.inviteCode)
      setShowInviteModal(true)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorGeneric'), 'error')
    } finally {
      setGeneratingInvite(false)
    }
  }

  const totalChildren = groupParents.reduce((acc, p) => acc + p.children.length, 0)

  // ─── Loading skeleton ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Page header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:shrink-0">
          <button
            onClick={handleCreateInvite}
            disabled={generatingInvite || !orgId}
            className="flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 shadow-sm sm:w-auto"
          >
            {generatingInvite ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {t('invite')}
          </button>
          <button
            onClick={() => {
              resetGroupForm()
              setShowGroupModal(true)
            }}
            className="flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all shadow-sm sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            {t('newGroup')}
          </button>
        </div>
      </div>

      {/* Groups grid */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-5">
            <Users className="w-8 h-8 text-primary-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('noGroups')}</h3>
          <p className="text-sm text-gray-500 max-w-xs mb-6">{t('noGroupsHint')}</p>
          <button
            onClick={() => {
              resetGroupForm()
              setShowGroupModal(true)
            }}
            className="flex w-full items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            {t('createGroup')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              t={t}
              locale={locale}
              isSelected={selectedGroup?.id === group.id}
              canManage={canManageGroup(group)}
              onClick={() => handleSelectGroup(group)}
              onEdit={(e) => openEditGroupModal(group, e)}
              onDelete={(e) => handleDeleteGroup(group.id, e)}
              onAssign={(e) => {
                e.stopPropagation()
                handleSelectGroup(group).then(() => openAssignFromLibraryModal())
              }}
            />
          ))}
        </div>
      )}

      {/* ── Group Panel ──────────────────────────────────────────────────── */}
      {selectedGroup && (
        <>
          <div
            className="fixed inset-0 bg-black/35 z-[52]"
            onClick={() => {
              setSelectedGroup(null)
              setAssignmentDetail(null)
            }}
          />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white z-[60] shadow-2xl flex flex-col">
            {/* Panel header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: selectedGroup.color }}
              />
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900 truncate">{selectedGroup.name}</h2>
                {selectedGroup.ownerName && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <UserCircle className="w-3 h-3" />
                    {selectedGroup.ownerName}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {canManageGroup(selectedGroup) && (
                  <>
                    <button
                      onClick={(e) => openEditGroupModal(selectedGroup, e)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteGroup(selectedGroup.id, e)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setSelectedGroup(null)
                    setAssignmentDetail(null)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Primary action */}
            {canManageGroup(selectedGroup) && (
              <div className="px-5 py-3 bg-primary-50/80 border-b border-primary-100 shrink-0">
                <button
                  onClick={() => openAssignFromLibraryModal()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  {t('assignTask')}
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center border-b border-gray-100 px-5 shrink-0">
              {[
                {
                  key: 'assignments' as const,
                  label: t('tabAssignments'),
                  count: groupAssignments.length,
                  icon: ClipboardList,
                },
                {
                  key: 'members' as const,
                  label: t('tabMembers'),
                  count: groupParents.length,
                  icon: Users,
                },
              ].map(({ key, label, count, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setGroupPanelTab(key)}
                  className={`relative flex items-center gap-2 px-1 py-3.5 mr-6 text-sm font-medium transition-colors ${groupPanelTab === key ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {count > 0 && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${groupPanelTab === key ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {count}
                    </span>
                  )}
                  {groupPanelTab === key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t-full" />
                  )}
                </button>
              ))}
              {groupPanelTab === 'members' && canManageGroup(selectedGroup) && (
                <button
                  onClick={handleOpenAddParent}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors my-2"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {t('addMember')}
                </button>
              )}
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto">
              {groupDetailLoading ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : groupPanelTab === 'assignments' ? (
                <AssignmentsTab
                  t={t}
                  locale={locale}
                  assignments={groupAssignments}
                  isOwner={canManageGroup(selectedGroup)}
                  selectedId={assignmentDetail?.id}
                  onSelect={handleSelectAssignment}
                  onDelete={handleDeleteAssignment}
                  onToggleStatus={handleToggleAssignmentStatus}
                  onNew={() => openAssignFromLibraryModal()}
                />
              ) : (
                <MembersTab
                  t={t}
                  parents={groupParents}
                  selectedGroup={selectedGroup}
                  isOrgAdmin={isOrgAdmin}
                  canManage={canManageGroup(selectedGroup)}
                  disconnecting={disconnecting}
                  onRemove={handleRemoveParent}
                  onDisconnect={handleDisconnect}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Assignment Detail (full screen) ─────────────────────────────── */}
      {selectedGroup && (assignmentDetailLoading || assignmentDetail) && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
            <button
              onClick={() => {
                setAssignmentDetail(null)
              }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('back')}
            </button>
            {assignmentDetail && (
              <>
                <span className="text-gray-200">|</span>
                <div className="hidden md:flex items-center gap-2 text-xs text-gray-400 shrink-0">
                  <button
                    onClick={() => {
                      setAssignmentDetail(null)
                      setSelectedGroup(null)
                    }}
                    className="hover:text-gray-700 transition-colors"
                  >
                    {t('title')}
                  </button>
                  <span>/</span>
                  <button
                    onClick={() => setAssignmentDetail(null)}
                    className="hover:text-gray-700 transition-colors max-w-[140px] truncate"
                    title={assignmentDetail.groupName}
                  >
                    {assignmentDetail.groupName}
                  </button>
                  <span>/</span>
                </div>
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedGroup.color }}
                />
                <span className="text-sm text-gray-400 shrink-0 hidden sm:block">
                  {assignmentDetail.groupName} ›
                </span>
                <h2 className="font-semibold text-gray-900 truncate flex-1 min-w-0">
                  {assignmentDetail.title}
                </h2>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  {assignmentDetail.dueDate && (
                    <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      {t('dueDateUntil', { date: formatDate(assignmentDetail.dueDate, locale) })}
                    </span>
                  )}
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${assignmentDetail.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {assignmentDetail.status === 'active' ? t('statusActive') : t('statusClosed')}
                  </span>
                  {canManageGroup(selectedGroup) && (
                    <>
                      <button
                        onClick={() => handleToggleAssignmentStatus(assignmentDetail)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title={
                          assignmentDetail.status === 'active' ? t('closeAccept') : t('openAccept')
                        }
                      >
                        {assignmentDetail.status === 'active' ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <Unlock className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          handleDeleteAssignment(assignmentDetail)
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {assignmentDetailLoading ? (
            <div className="flex-1 w-full max-w-5xl mx-auto space-y-4 p-4 sm:p-6 lg:p-8">
              <Skeleton className="h-24" />
              <Skeleton className="h-64" />
            </div>
          ) : assignmentDetail ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6">
                  <div className="mb-4">
                    <button
                      onClick={() => setAssignmentDetail(null)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {t('back')} {t('tabAssignments').toLowerCase()}
                    </button>
                  </div>
                  {assignmentDetail.description && (
                    <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed">
                      {assignmentDetail.description}
                    </div>
                  )}

                  {/* Roadmap breakdown */}
                  {assignmentDetail.roadmaps && assignmentDetail.roadmaps.length > 0 && (
                    <div className="mb-5 rounded-xl border border-purple-100 bg-purple-50/40 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-100">
                        <BookOpen className="w-4 h-4 text-purple-500 shrink-0" />
                        <span className="text-sm font-semibold text-purple-800">
                          {t('programsLabel')}
                        </span>
                        <span className="ml-auto text-xs text-purple-400">
                          {assignmentDetail.roadmaps.length}
                        </span>
                      </div>
                      {assignmentDetail.roadmaps.map((roadmap) => {
                        const isOpen = expandedRoadmapIds.has(roadmap.id)
                        return (
                          <div
                            key={roadmap.id}
                            className="border-b border-purple-100 last:border-0"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedRoadmapIds((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(roadmap.id)) next.delete(roadmap.id)
                                  else next.add(roadmap.id)
                                  return next
                                })
                              }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-purple-50 transition-colors"
                            >
                              <ListChecks className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span className="flex-1 text-sm font-medium text-purple-900 truncate">
                                {roadmap.name}
                              </span>
                              <span className="text-xs text-purple-400 shrink-0 mr-1">
                                {roadmap.taskTitles.length}
                              </span>
                              {isOpen ? (
                                <ChevronUp className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              )}
                            </button>
                            {isOpen && roadmap.taskTitles.length > 0 && (
                              <ul className="px-4 pb-3 space-y-1">
                                {roadmap.taskTitles.map((title, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2 text-xs text-purple-800"
                                  >
                                    <span className="shrink-0 w-4 h-4 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center font-semibold text-[10px] mt-0.5">
                                      {i + 1}
                                    </span>
                                    {title}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Progress bar */}
                  {(() => {
                    const submitted = assignmentDetail.submissions.filter(
                      (s) => s.status !== 'pending'
                    ).length
                    const graded = assignmentDetail.submissions.filter(
                      (s) => s.status === 'graded'
                    ).length
                    const total = assignmentDetail.submissions.length
                    const pct = total > 0 ? Math.round((submitted / total) * 100) : 0
                    return (
                      <div className="mb-5 p-4 bg-white rounded-xl border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-700">
                            {t('progressSubmission')}
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            {submitted}/{total}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>
                            <span className="inline-block w-2 h-2 rounded-full bg-gray-300 mr-1" />
                            {total - submitted} {t('awaiting')}
                          </span>
                          <span>
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />
                            {submitted - graded} {t('underReview')}
                          </span>
                          <span>
                            <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />
                            {graded} {t('reviewed')}
                          </span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Filter tabs */}
                  <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 sm:flex sm:items-center">
                    {[
                      {
                        key: 'all' as const,
                        label: t('filterAll'),
                        count: assignmentDetail.submissions.length,
                      },
                      {
                        key: 'pending' as const,
                        label: t('filterPending'),
                        count: assignmentDetail.submissions.filter((s) => s.status === 'pending')
                          .length,
                      },
                      {
                        key: 'submitted' as const,
                        label: t('filterSubmitted'),
                        count: assignmentDetail.submissions.filter((s) => s.status === 'submitted')
                          .length,
                      },
                      {
                        key: 'graded' as const,
                        label: t('filterGraded'),
                        count: assignmentDetail.submissions.filter((s) => s.status === 'graded')
                          .length,
                      },
                    ].map(({ key, label, count }) => (
                      <button
                        key={key}
                        onClick={() => setSubmissionFilter(key)}
                        className={`flex min-w-0 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all sm:flex-1 ${submissionFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        {label}
                        {count > 0 && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${submissionFilter === key ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-500'}`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Submission cards */}
                  <div className="space-y-3">
                    {assignmentDetail.submissions
                      .filter((s) => submissionFilter === 'all' || s.status === submissionFilter)
                      .map((sub) => (
                        <SubmissionCard
                          key={sub.childId}
                          t={t}
                          locale={locale}
                          submission={sub}
                          groupColor={selectedGroup.color}
                          isOwner={canManageGroup(selectedGroup)}
                          onGrade={() => {
                            setGradeTarget(sub)
                            setGradeValue(sub.grade || 'approved')
                            setFeedbackInput(sub.feedback || '')
                          }}
                          onViewImage={setLightboxUrl}
                        />
                      ))}
                    {assignmentDetail.submissions.filter(
                      (s) => submissionFilter === 'all' || s.status === submissionFilter
                    ).length === 0 && (
                      <div className="text-center py-12 text-gray-400 text-sm">
                        {t('noRecordsInCategory')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Create/Edit Group Modal ──────────────────────────────────────── */}
      {showGroupModal && (
        <Modal
          onClose={() => {
            setShowGroupModal(false)
            resetGroupForm()
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {editingGroup ? t('editGroup') : t('newGroupTitle')}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {editingGroup ? t('editGroupDesc') : t('createGroupDesc')}
              </p>
            </div>
            <button
              onClick={() => {
                setShowGroupModal(false)
                resetGroupForm()
              }}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSaveGroup} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('nameLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('descriptionLabel')}
              </label>
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                rows={3}
                placeholder={t('descriptionPlaceholder')}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('colorLabel')}
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setGroupColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${groupColor === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={groupColor}
                  onChange={(e) => setGroupColor(e.target.value)}
                  className="w-8 h-8 rounded-full border border-gray-200 cursor-pointer overflow-hidden"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowGroupModal(false)
                  resetGroupForm()
                }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={savingGroup || !groupName.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {savingGroup && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingGroup ? t('save') : t('create')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Assign from Library Modal ─────────────────────────────────────── */}
      {showAssignmentModal && selectedGroup && (
        <Modal
          onClose={() => {
            setShowAssignmentModal(false)
            setSelectedContentIds(new Set())
            setSelectedRoadmapIds(new Set())
            setAssignDueDate('')
          }}
          maxWidth="max-w-lg"
          zIndex="z-[70]"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedGroup.color }}
              />
              <h2 className="text-lg font-bold text-gray-900">{t('assignTitle')}</h2>
            </div>
            <button
              onClick={() => setShowAssignmentModal(false)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1.5 mb-4">
            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
              {selectedGroup.name}
            </span>
            <span className="text-xs text-gray-400">{pluralChildren(totalChildren, t)}</span>
          </div>

          <form onSubmit={handleAssignFromLibrary} className="flex flex-col gap-4">
            {loadingLibrary ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            ) : libraryEmpty ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <BookOpen className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-gray-500">{t('libraryEmpty')}</p>
                <p className="text-xs text-gray-400">{t('libraryEmptyHint')}</p>
              </div>
            ) : (
              <>
                {/* Assignments */}
                {contentTaskLibrary.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('tasksLabel')}
                    </label>
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                      {contentTaskLibrary.map((task) => {
                        const selected = selectedContentIds.has(task.id)
                        return (
                          <label
                            key={task.id}
                            className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selected ? 'bg-primary-50' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleContentId(task.id)}
                              className="mt-0.5 w-4 h-4 rounded text-primary-600 border-gray-300 focus:ring-primary-500 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                  {task.description}
                                </p>
                              )}
                            </div>
                            {selected && (
                              <Check className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Programs */}
                {contentRoadmapLibrary.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('programsLabel')}
                    </label>
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                      {contentRoadmapLibrary.map((roadmap) => {
                        const selected = selectedRoadmapIds.has(roadmap.id)
                        const taskCount = roadmap.taskIds?.length ?? 0
                        return (
                          <label
                            key={roadmap.id}
                            className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selected ? 'bg-primary-50' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleRoadmapId(roadmap.id)}
                              className="mt-0.5 w-4 h-4 rounded text-primary-600 border-gray-300 focus:ring-primary-500 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {roadmap.name}
                              </p>
                              {roadmap.description && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                  {roadmap.description}
                                </p>
                              )}
                              {taskCount > 0 && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {t('tasksInProgram', { count: taskCount })}
                                </p>
                              )}
                            </div>
                            {selected && (
                              <Check className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {hasSelection && (
                  <p className="text-xs text-primary-600 font-medium">
                    {t('toAssign', { count: totalTasksToAssign })}
                  </p>
                )}
              </>
            )}

            {!libraryEmpty && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('dueDateLabel')}{' '}
                    <span className="text-gray-400 font-normal text-xs">
                      {t('dueDateOptional')}
                    </span>
                  </label>
                  <input
                    type="date"
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAssignmentModal(false)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={creatingAssignment || !hasSelection}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {creatingAssignment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {t('assignToGroup')}
                  </button>
                </div>
              </>
            )}
          </form>
        </Modal>
      )}

      {/* ── Add Parent Modal ─────────────────────────────────────────────── */}
      {showAddParentModal && selectedGroup && (
        <Modal
          onClose={() => {
            setShowAddParentModal(false)
            setSelectedParentId('')
            setParentSearchQuery('')
          }}
          zIndex="z-[70]"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">{t('addParticipant')}</h2>
            <button
              onClick={() => {
                setShowAddParentModal(false)
                setSelectedParentId('')
                setParentSearchQuery('')
              }}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {loadingParents ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : (
            <>
              {(() => {
                const selectableParents = availableParents.filter(
                  (p) => !groupParents.some((gp) => gp.parentUserId === p.parentUserId)
                )
                const query = parentSearchQuery.trim().toLowerCase()
                const filteredParents = query
                  ? selectableParents.filter((p) => {
                      const name = p.name?.toLowerCase() || ''
                      const email = p.email?.toLowerCase() || ''
                      return name.includes(query) || email.includes(query)
                    })
                  : selectableParents

                return (
                  <>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {t('selectParent')}
                      </label>
                      <input
                        type="text"
                        value={parentSearchQuery}
                        onChange={(e) => setParentSearchQuery(e.target.value)}
                        placeholder={t('parentSearchPlaceholder')}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      />
                    </div>

                    <div className="mb-5">
                      <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
                        {filteredParents.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-gray-400">
                            {t('noParentsFound')}
                          </div>
                        ) : (
                          filteredParents.map((p) => {
                            const selected = selectedParentId === p.parentUserId
                            return (
                              <button
                                key={p.parentUserId}
                                type="button"
                                onClick={() => setSelectedParentId(p.parentUserId)}
                                className={`w-full text-left px-4 py-3 transition-colors ${selected ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                              >
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {p.name}
                                </p>
                                {p.email && (
                                  <p className="text-xs text-gray-500 truncate">{p.email}</p>
                                )}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </>
                )
              })()}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddParentModal(false)
                    setSelectedParentId('')
                    setParentSearchQuery('')
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleAddParent}
                  disabled={!selectedParentId}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {t('addMember')}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ── Invite Modal ─────────────────────────────────────────────────── */}
      {showInviteModal && inviteCode && (
        <Modal
          onClose={() => {
            setShowInviteModal(false)
            setInviteCode(null)
            setCopiedInvite(false)
          }}
          maxWidth="max-w-sm"
          zIndex="z-[70]"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">{t('inviteCodeTitle')}</h2>
            <button
              onClick={() => {
                setShowInviteModal(false)
                setInviteCode(null)
              }}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-5">{t('inviteCodeHint')}</p>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4 text-center">
            <p className="text-3xl font-mono font-bold tracking-[0.25em] text-gray-900 mb-3">
              {inviteCode}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteCode)
                setCopiedInvite(true)
                setTimeout(() => setCopiedInvite(false), 2000)
              }}
              className={`flex items-center gap-2 mx-auto px-4 py-2 text-sm font-medium rounded-xl transition-all ${copiedInvite ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'}`}
            >
              {copiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedInvite ? t('copied') : t('copy')}
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">{t('inviteCodeExpiry')}</p>
        </Modal>
      )}

      {/* ── Grade Modal ──────────────────────────────────────────────────── */}
      {gradeTarget && (
        <Modal
          onClose={() => {
            setGradeTarget(null)
            setFeedbackInput('')
          }}
          maxWidth="max-w-md"
          zIndex="z-[80]"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('gradeWork')}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{gradeTarget.childName}</p>
            </div>
            <button
              onClick={() => setGradeTarget(null)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {(gradeTarget.submissionText || gradeTarget.fileUrl) && (
            <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-xs font-semibold text-blue-600 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                {t('studentAnswer')}
              </p>
              {gradeTarget.submissionText && (
                <p className="text-sm text-blue-900 leading-relaxed">
                  {gradeTarget.submissionText}
                </p>
              )}
              {gradeTarget.fileUrl && (
                <SubmissionImagePreview
                  key={gradeTarget.fileUrl}
                  fileUrl={gradeTarget.fileUrl}
                  onViewFullSize={() => setLightboxUrl(gradeTarget.fileUrl!)}
                  className="mt-2 max-h-60 rounded-lg border border-blue-200 bg-white"
                  showLabel={false}
                  labelPreviewUnavailable={t('previewUnavailable')}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => setGradeValue('approved')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${gradeValue === 'approved' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <ThumbsUp
                className={`w-5 h-5 ${gradeValue === 'approved' ? 'text-green-600' : 'text-gray-400'}`}
              />
              <span
                className={`text-sm font-semibold ${gradeValue === 'approved' ? 'text-green-700' : 'text-gray-600'}`}
              >
                {t('approve')}
              </span>
              <span className="text-xs text-gray-400 text-center">{t('excellentWork')}</span>
            </button>
            <button
              onClick={() => setGradeValue('needs_revision')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${gradeValue === 'needs_revision' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <RotateCcw
                className={`w-5 h-5 ${gradeValue === 'needs_revision' ? 'text-amber-600' : 'text-gray-400'}`}
              />
              <span
                className={`text-sm font-semibold ${gradeValue === 'needs_revision' ? 'text-amber-700' : 'text-gray-600'}`}
              >
                {t('needsRevision')}
              </span>
              <span className="text-xs text-gray-400 text-center">{t('needsFix')}</span>
            </button>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('feedbackLabel')}{' '}
              <span className="text-xs text-gray-400 font-normal">{t('feedbackOptional')}</span>
            </label>
            <textarea
              value={feedbackInput}
              onChange={(e) => setFeedbackInput(e.target.value)}
              rows={3}
              placeholder={t('feedbackPlaceholder')}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setGradeTarget(null)
                setFeedbackInput('')
              }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSubmitGrade}
              disabled={submittingGrade}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50 ${gradeValue === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            >
              {submittingGrade ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : gradeValue === 'approved' ? (
                <ThumbsUp className="w-4 h-4" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              {gradeValue === 'approved' ? t('approve') : t('needsRevision')}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Image lightbox (view only) ───────────────────────────────────────── */}
      {lightboxUrl && (
        <Lightbox
          url={lightboxUrl}
          onClose={() => setLightboxUrl(null)}
          closeHint={t('lightboxCloseHint')}
          closeLabel={t('close')}
        />
      )}
    </div>
  )
}
