'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  UserPlus,
  UserCircle,
  ClipboardList,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  UserMinus,
  ChevronRight,
  MessageSquare,
  Send,
  ThumbsUp,
  RotateCcw,
  Clock,
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Lock,
  Unlock,
  FileText,
  Expand,
  ImageIcon,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Group {
  id: string
  name: string
  description: string | null
  color: string
  orgId: string
  parentCount: number
  lastAssignedAt: string | null
  lastAssignedTaskTitles: string[] | null
  createdAt: string | null
  ownerId?: string
  ownerName?: string
}

interface Assignment {
  id: string
  groupId: string
  groupName: string
  title: string
  description: string | null
  dueDate: string | null
  taskTitles: string[]
  childCount: number
  tasksCreated: number
  assignedBy: string
  assignedAt: string | null
  status: 'active' | 'closed'
}

interface Submission {
  childId: string
  childName: string
  age?: number
  taskId: string | null
  status: 'pending' | 'submitted' | 'graded'
  submissionText: string | null
  fileUrl: string | null
  submittedAt: string | null
  grade: 'approved' | 'needs_revision' | null
  feedback: string | null
  feedbackAt: string | null
}

interface AssignmentDetail extends Assignment {
  ownerId: string
  submissions: Submission[]
}

interface Comment {
  id: string
  authorId: string
  authorName: string
  authorRole: string
  text: string
  createdAt: string | null
}

interface Parent {
  parentUserId: string
  name: string
  email: string | null
  children: Array<{ id: string; name: string; age?: number }>
  addedAt: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TimeT = (key: string, values?: Record<string, string | number>) => string

function relativeTime(iso: string, t: TimeT, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return t('timeJustNow')
  if (mins < 60) return t('timeMinutesAgo', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('timeHoursAgo', { n: hours })
  const days = Math.floor(hours / 24)
  if (days === 1) return t('timeYesterday')
  if (days < 30) return t('timeDaysAgo', { n: days })
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function pluralChildren(n: number, t: TimeT): string {
  return t('childrenCount', { n })
}

const PRESET_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#14b8a6',
]

// ─── Utility Components ────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
}

function Toast({
  message,
  type = 'success',
  onClose,
}: {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium text-white ${type === 'success' ? 'bg-gray-900' : 'bg-red-500'}`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function Modal({
  children,
  onClose,
  maxWidth = 'max-w-md',
  zIndex = 'z-50',
}: {
  children: React.ReactNode
  onClose: () => void
  maxWidth?: string
  zIndex?: string
}) {
  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${maxWidth} bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto`}
      >
        {children}
      </div>
    </div>
  )
}

function StatusBadge({
  status,
  t,
}: {
  status: 'pending' | 'submitted' | 'graded' | 'approved' | 'needs_revision'
  t: TimeT
}) {
  const key =
    status === 'pending'
      ? 'statusPending'
      : status === 'submitted'
        ? 'statusSubmitted'
        : status === 'graded'
          ? 'statusGraded'
          : status === 'approved'
            ? 'statusApproved'
            : 'statusNeedsRevision'
  const map: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    submitted: 'bg-blue-100 text-blue-700',
    graded: 'bg-green-100 text-green-700',
    approved: 'bg-green-100 text-green-700',
    needs_revision: 'bg-amber-100 text-amber-700',
  }
  const cls = map[status] ?? map.pending
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}
    >
      {t(key)}
    </span>
  )
}

function _Avatar({
  name,
  color,
  size = 'md',
}: {
  name: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sz =
    size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs'
  return (
    <div
      className={`${sz} rounded-xl flex items-center justify-center text-white font-bold shrink-0`}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </div>
  )
}

// ─── GroupsPage (Main) ────────────────────────────────────────────────────────

export default function GroupsPage() {
  const t = useTranslations('b2b.pages.groups')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [isOrgAdmin, setIsOrgAdmin] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Group panel (right drawer)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [groupParents, setGroupParents] = useState<Parent[]>([])
  const [groupAssignments, setGroupAssignments] = useState<Assignment[]>([])
  const [groupDetailLoading, setGroupDetailLoading] = useState(false)
  const [groupPanelTab, setGroupPanelTab] = useState<'assignments' | 'members'>('assignments')

  // Assignment detail (full-screen overlay)
  const [assignmentDetail, setAssignmentDetail] = useState<AssignmentDetail | null>(null)
  const [assignmentComments, setAssignmentComments] = useState<Comment[]>([])
  const [assignmentDetailLoading, setAssignmentDetailLoading] = useState(false)
  const [submissionFilter, setSubmissionFilter] = useState<
    'all' | 'pending' | 'submitted' | 'graded'
  >('all')
  const [commentInput, setCommentInput] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

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
  const [contentTaskLibrary, setContentTaskLibrary] = useState<
    Array<{ id: string; title: string; description?: string }>
  >([])
  const [contentRoadmapLibrary, setContentRoadmapLibrary] = useState<
    Array<{ id: string; name: string; description?: string; taskIds: string[] }>
  >([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set())
  const [selectedRoadmapIds, setSelectedRoadmapIds] = useState<Set<string>>(new Set())
  const [assignDueDate, setAssignDueDate] = useState('')
  const [creatingAssignment, setCreatingAssignment] = useState(false)

  // Parent management
  const [showAddParentModal, setShowAddParentModal] = useState(false)
  const [availableParents, setAvailableParents] = useState<Parent[]>([])
  const [selectedParentId, setSelectedParentId] = useState('')
  const [loadingParents, setLoadingParents] = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  // Invite
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [copiedInvite, setCopiedInvite] = useState(false)

  const showToast = (message: string, type: 'success' | 'error' = 'success') =>
    setToast({ message, type })
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // ─── Auth ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
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
        const resolvedOrgId = orgIdParam

        try {
          const profile = await apiClient.getMe()
          if (!resolvedOrgId) {
            const first = profile.organizations[0]
            if (first) {
              router.replace(`/b2b/groups?orgId=${first.orgId}`)
              return
            }
          }
          const currentOrg =
            profile.organizations.find((o) => o.orgId === resolvedOrgId) || profile.organizations[0]
          setIsOrgAdmin(currentOrg?.role === 'org_admin' || currentOrg?.role === 'admin')
        } catch {}

        if (!resolvedOrgId) {
          router.push('/b2b')
          return
        }
        setOrgId(resolvedOrgId)
        await loadGroups(resolvedOrgId)
      } catch {
        router.push('/b2b/login')
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams])

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
        setGroupAssignments(
          raw.map((a) => ({
            id: a.id,
            groupId: a.groupId,
            groupName: a.groupName,
            taskTitles: a.taskTitles || [],
            title: (a.taskTitles && a.taskTitles[0]) || t('assignmentDefaultTitle'),
            description: null,
            dueDate: null,
            status: 'active' as const,
            childCount: a.childCount,
            tasksCreated: a.tasksCreated,
            assignedBy: a.assignedBy,
            assignedAt: a.assignedAt,
          }))
        )
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : t('errorLoadGroup'), 'error')
      } finally {
        setGroupDetailLoading(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [orgId]
  )

  // ─── Assignment detail ──────────────────────────────────────────────────────

  const handleSelectAssignment = useCallback(
    async (assignment: Assignment) => {
      if (!orgId || !selectedGroup) return
      setAssignmentDetailLoading(true)
      setAssignmentDetail(null)
      setAssignmentComments([])
      setSubmissionFilter('all')
      setCommentInput('')
      try {
        const [detailRes, commentsRes] = await Promise.all([
          apiClient.getGroupAssignment(
            orgId,
            selectedGroup.id,
            assignment.id,
            selectedGroup.ownerId
          ),
          apiClient
            .getAssignmentComments(orgId, selectedGroup.id, assignment.id)
            .catch(() => ({ comments: [] })),
        ])
        setAssignmentDetail(detailRes.assignment as AssignmentDetail)
        setAssignmentComments(commentsRes.comments || [])
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : t('errorLoadAssignment'), 'error')
      } finally {
        setAssignmentDetailLoading(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [orgId, selectedGroup]
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
    if (!orgId || !confirm(t('confirmDeleteGroup'))) return
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
      setContentTaskLibrary(
        (tasksRes.tasks || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
        }))
      )
      setContentRoadmapLibrary(
        (roadmapsRes.roadmaps || []).map((r: any) => ({
          id: r.id,
          name: r.name || t('noName'),
          description: r.description,
          taskIds: Array.isArray(r.taskIds)
            ? r.taskIds
            : r.steps?.map((s: any) => s.taskId).filter(Boolean) || [],
        }))
      )
    } catch {
      showToast(t('errorLibrary'), 'error')
    } finally {
      setLoadingLibrary(false)
    }
  }

  const handleAssignFromLibrary = async (e: React.FormEvent) => {
    e.preventDefault()
    const taskIdsToAssign = new Set(selectedContentIds)
    for (const roadmapId of selectedRoadmapIds) {
      const r = contentRoadmapLibrary.find((x) => x.id === roadmapId)
      if (r?.taskIds?.length) r.taskIds.forEach((id) => taskIdsToAssign.add(id))
    }
    if (!orgId || !selectedGroup || taskIdsToAssign.size === 0) return
    setCreatingAssignment(true)
    try {
      await apiClient.assignGroupTasks(
        orgId,
        selectedGroup.id,
        Array.from(taskIdsToAssign),
        assignDueDate || null,
        selectedGroup.ownerId
      )
      const tasksCount = taskIdsToAssign.size
      const parts: string[] = []
      if (selectedContentIds.size > 0) parts.push(t('partTasks', { n: selectedContentIds.size }))
      if (selectedRoadmapIds.size > 0) parts.push(t('partPrograms', { n: selectedRoadmapIds.size }))
      showToast(
        parts.length
          ? t('toastAssigned', { details: parts.join(', '), count: tasksCount })
          : t('toastAssignedCount', { count: tasksCount })
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
    if (!orgId || !selectedGroup || !confirm(t('confirmDeleteAssignment', { title: a.title })))
      return
    try {
      await apiClient.deleteGroupAssignment(orgId, selectedGroup.id, a.id)
      setGroupAssignments((prev) => prev.filter((x) => x.id !== a.id))
      if (assignmentDetail?.id === a.id) setAssignmentDetail(null)
      showToast(t('toastAssignmentDeleted'))
      if (orgId) await loadGroups(orgId)
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

  // ─── Comments ─────────────────────────────────────────────────────────────────

  const handleAddComment = async () => {
    if (!orgId || !selectedGroup || !assignmentDetail || !commentInput.trim()) return
    setSubmittingComment(true)
    try {
      const res = await apiClient.addAssignmentComment(
        orgId,
        selectedGroup.id,
        assignmentDetail.id,
        commentInput.trim()
      )
      setAssignmentComments((prev) => [...prev, res.comment as Comment])
      setCommentInput('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorGeneric'), 'error')
    } finally {
      setSubmittingComment(false)
    }
  }

  // ─── Parent management ────────────────────────────────────────────────────────

  const handleOpenAddParent = async () => {
    if (!orgId) return
    setLoadingParents(true)
    try {
      const data = await apiClient.getConnections(orgId)
      setAvailableParents(
        (data.connections || []).map((c: any) => ({
          parentUserId: c.parentUserId,
          name: c.parentName || t('unnamed'),
          email: c.parentEmail || null,
          children: (c.children || []).map((ch: any) => ({
            id: ch.childId || ch.id,
            name: ch.childName || ch.name || t('unnamed'),
            age: ch.childAge || ch.age,
          })),
          addedAt: null,
        }))
      )
      setShowAddParentModal(true)
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
      showToast(t('toastParentAdded'))
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorGeneric'), 'error')
    }
  }

  const handleRemoveParent = async (parentUserId: string) => {
    if (!orgId || !selectedGroup || !confirm(t('confirmRemoveParent'))) return
    try {
      await apiClient.removeParentFromGroup(orgId, selectedGroup.id, parentUserId)
      setGroupParents((prev) => prev.filter((p) => p.parentUserId !== parentUserId))
      showToast(t('toastParentRemoved'))
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('errorGeneric'), 'error')
    }
  }

  const handleDisconnect = async (parentUserId: string) => {
    if (!orgId || !isOrgAdmin || !confirm(t('confirmDisconnectParent'))) return
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCreateInvite}
            disabled={generatingInvite || !orgId}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 shadow-sm"
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
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all shadow-sm"
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
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all"
          >
            <Plus className="w-4 h-4" />
            {t('createGroup')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              t={t}
              locale={locale}
              isSelected={selectedGroup?.id === group.id}
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
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => {
              setSelectedGroup(null)
              setAssignmentDetail(null)
            }}
          />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col">
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
                {!selectedGroup.ownerId && (
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
            {!selectedGroup.ownerId && (
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
              {groupPanelTab === 'members' && !selectedGroup.ownerId && (
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
                  isOwner={!selectedGroup.ownerId}
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
                setAssignmentComments([])
              }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('back')}
            </button>
            {assignmentDetail && (
              <>
                <span className="text-gray-200">|</span>
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
                  {!selectedGroup.ownerId && (
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
            <div className="flex-1 p-8 space-y-4 max-w-5xl mx-auto w-full">
              <Skeleton className="h-24" />
              <Skeleton className="h-64" />
            </div>
          ) : assignmentDetail ? (
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Left: Submissions */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-6 py-5">
                  {assignmentDetail.description && (
                    <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed">
                      {assignmentDetail.description}
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
                  <div className="flex items-center gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
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
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${submissionFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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
                          isOwner={!selectedGroup.ownerId}
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

              {/* Right: Comments */}
              <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col shrink-0">
                <div className="px-5 py-3.5 border-b border-gray-100 shrink-0">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    {t('comments')}
                    {assignmentComments.length > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        {assignmentComments.length}
                      </span>
                    )}
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {assignmentComments.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-400">
                      {t('noComments')}
                      <br />
                      {t('writeFirst')}
                    </div>
                  )}
                  {assignmentComments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center text-[10px] font-bold text-primary-700 shrink-0">
                        {initials(c.authorName)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-900">
                            {c.authorName}
                          </span>
                          {c.createdAt && (
                            <span className="text-[10px] text-gray-400">
                              {relativeTime(c.createdAt, t, locale)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
                          {c.text}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={commentsEndRef} />
                </div>
                <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleAddComment()
                        }
                      }}
                      placeholder={t('commentPlaceholder')}
                      rows={2}
                      className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={submittingComment || !commentInput.trim()}
                      className="p-2.5 text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {submittingComment ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
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
                {/* Задания */}
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

                {/* Программы */}
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
          }}
          zIndex="z-[70]"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">{t('addParticipant')}</h2>
            <button
              onClick={() => {
                setShowAddParentModal(false)
                setSelectedParentId('')
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
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('selectParent')}
                </label>
                <select
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                  <option value="">{t('selectParentOption')}</option>
                  {availableParents
                    .filter((p) => !groupParents.some((gp) => gp.parentUserId === p.parentUserId))
                    .map((p) => (
                      <option key={p.parentUserId} value={p.parentUserId}>
                        {p.name}
                        {p.email ? ` (${p.email})` : ''}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddParentModal(false)
                    setSelectedParentId('')
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

// ─── GroupCard ─────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  t,
  locale,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  onAssign,
}: {
  group: Group
  t: TimeT
  locale: string
  isSelected: boolean
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  onAssign?: (e: React.MouseEvent) => void
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${isSelected ? 'border-primary-300 shadow-md ring-2 ring-primary-100' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'}`}
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: group.color }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate pr-2">{group.name}</h3>
            {group.ownerName && (
              <div className="flex items-center gap-1 mt-0.5">
                <UserCircle className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500 truncate">{group.ownerName}</span>
              </div>
            )}
          </div>
          {!group.ownerId && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={onEdit}
                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {group.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{group.description}</p>
        )}

        {group.lastAssignedTaskTitles && group.lastAssignedTaskTitles.length > 0 ? (
          <div className="mb-3 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <BookOpen className="w-3 h-3 text-primary-500 shrink-0" />
              <span className="text-[10px] font-semibold text-primary-600 uppercase tracking-wide">
                {t('lastAssignment')}
              </span>
              {group.lastAssignedAt && (
                <span className="ml-auto text-[10px] text-primary-400">
                  {relativeTime(group.lastAssignedAt, t, locale)}
                </span>
              )}
            </div>
            <p className="text-xs text-primary-800 truncate">
              {group.lastAssignedTaskTitles.slice(0, 2).join(', ')}
              {group.lastAssignedTaskTitles.length > 2 &&
                ` +${group.lastAssignedTaskTitles.length - 2}`}
            </p>
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-400 italic">{t('noAssignmentsYet')}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5" />
            <span>{t('parentCount', { count: group.parentCount })}</span>
          </div>
          <div className="flex items-center gap-1">
            {!group.ownerId && onAssign && (
              <button
                onClick={onAssign}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Plus className="w-3 h-3" />
                {t('taskShort')}
              </button>
            )}
            <div className="flex items-center gap-0.5 text-xs text-gray-400 group-hover:text-primary-600 transition-colors">
              {t('open')}
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── AssignmentsTab ────────────────────────────────────────────────────────────

function AssignmentsTab({
  t,
  locale,
  assignments,
  isOwner,
  selectedId,
  onSelect,
  onDelete,
  onToggleStatus,
  onNew,
}: {
  t: TimeT
  locale: string
  assignments: Assignment[]
  isOwner: boolean
  selectedId?: string
  onSelect: (a: Assignment) => void
  onDelete: (a: Assignment) => void
  onToggleStatus: (a: Assignment) => void
  onNew: () => void
}) {
  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mb-3">
          <ClipboardList className="w-6 h-6 text-primary-400" />
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">{t('noAssignments')}</p>
        <p className="text-xs text-gray-400 mb-4">{t('createFirstAssignment')}</p>
        {isOwner && (
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-200 rounded-xl hover:bg-primary-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('newAssignment')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      {assignments.map((a) => (
        <div
          key={a.id}
          onClick={() => onSelect(a)}
          className={`group flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${selectedId === a.id ? 'border-primary-200 bg-primary-50/60' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}
        >
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${a.status === 'active' ? 'bg-green-400' : 'bg-gray-300'}`}
          />
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-semibold truncate ${selectedId === a.id ? 'text-primary-800' : 'text-gray-800'}`}
            >
              {a.title}
            </p>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {a.assignedAt && (
                <span className="text-xs text-gray-400">
                  {relativeTime(a.assignedAt, t, locale)}
                </span>
              )}
              {a.dueDate && (
                <span className="text-xs flex items-center gap-1 text-amber-600">
                  <Clock className="w-3 h-3" />
                  {t('dueDateUntil', { date: formatDate(a.dueDate, locale) })}
                </span>
              )}
              <span className="text-xs text-gray-400">{pluralChildren(a.childCount, t)}</span>
            </div>
          </div>
          {isOwner && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleStatus(a)
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title={a.status === 'active' ? t('closeAccept') : t('openAccept')}
              >
                {a.status === 'active' ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(a)
                }}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <ChevronRight
            className={`w-4 h-4 shrink-0 transition-colors ${selectedId === a.id ? 'text-primary-400' : 'text-gray-300 group-hover:text-gray-400'}`}
          />
        </div>
      ))}
    </div>
  )
}

// ─── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({
  url,
  onClose,
  closeHint = '',
  closeLabel = '',
}: {
  url: string
  onClose: () => void
  closeHint?: string
  closeLabel?: string
}) {
  const mediaType = getMediaTypeFromUrl(url)
  const [imageUseDirect, setImageUseDirect] = useState(false)
  const imageSrc = imageUseDirect ? url : proxyUrl(url)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label={closeLabel}
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="relative max-w-[92vw] max-h-[92vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {mediaType === 'video' ? (
          <video
            src={imageSrc}
            controls
            autoPlay
            playsInline
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
            className="max-w-full max-h-[88vh] rounded-2xl shadow-2xl"
            style={{ background: '#000' }}
          />
        ) : (
          <img
            src={imageSrc}
            alt=""
            referrerPolicy="no-referrer"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onError={() => {
              if (!imageUseDirect) setImageUseDirect(true)
            }}
            className="max-w-full max-h-[88vh] w-auto h-auto object-contain rounded-2xl shadow-2xl select-none"
          />
        )}
      </div>

      <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-white/40 pointer-events-none">
        {closeHint}
      </p>
    </div>
  )
}

// ─── Media helpers ─────────────────────────────────────────────────────────────

function getMediaTypeFromUrl(url: string): 'image' | 'video' {
  try {
    const pathSegment = new URL(url).pathname.split('/o/')[1] || ''
    const ext = decodeURIComponent(pathSegment).split('.').pop()?.toLowerCase().split('?')[0] || ''
    if (['mp4', 'mov', 'avi', 'webm', 'm4v', '3gp'].includes(ext)) return 'video'
  } catch {
    /* ignore */
  }
  return 'image'
}

// ─── SubmissionImagePreview ────────────────────────────────────────────────────

function proxyUrl(url: string): string {
  return `/api/media?url=${encodeURIComponent(url)}`
}

function SubmissionImagePreview({
  fileUrl,
  onViewFullSize,
  className = '',
  showLabel = true,
  labelViewFullSize = '',
  labelPreviewUnavailable = '',
}: {
  fileUrl: string
  onViewFullSize: () => void
  className?: string
  showLabel?: boolean
  labelViewFullSize?: string
  labelPreviewUnavailable?: string
}) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [tryDirect, setTryDirect] = useState(false)
  const mediaType = getMediaTypeFromUrl(fileUrl)
  const src = tryDirect ? fileUrl : proxyUrl(fileUrl)

  const handleImageError = () => {
    if (!tryDirect) {
      setTryDirect(true)
      setLoaded(false)
    } else {
      setFailed(true)
    }
  }

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 py-8 rounded-xl bg-gray-50 border border-dashed border-gray-200 ${className}`}
      >
        <ImageIcon className="w-8 h-8 text-gray-300" />
        <span className="text-sm text-gray-400">{labelPreviewUnavailable}</span>
      </div>
    )
  }

  if (mediaType === 'video') {
    return (
      <div className={`w-full overflow-hidden rounded-xl bg-black ${className}`}>
        <video
          src={src}
          controls
          playsInline
          controlsList="nodownload"
          className="w-full max-h-72"
          onContextMenu={(e) => e.preventDefault()}
          onError={() => setFailed(true)}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onViewFullSize}
      className={`group relative block w-full overflow-hidden rounded-xl bg-gray-100 border border-gray-100 transition-all duration-200 hover:border-primary-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 ${className}`}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
        </div>
      )}
      <img
        key={src}
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        className={`w-full max-h-64 object-contain transition-all duration-300 group-hover:scale-[1.02] ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={handleImageError}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
      />
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20 rounded-xl pointer-events-none">
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm">
            <Expand className="w-3.5 h-3.5 text-gray-700" />
            <span className="text-xs font-medium text-gray-700">{labelViewFullSize}</span>
          </div>
        </div>
      )}
    </button>
  )
}

// ─── SubmissionCard ────────────────────────────────────────────────────────────

function SubmissionCard({
  submission,
  groupColor,
  isOwner,
  onGrade,
  t,
  locale,
  onViewImage,
}: {
  submission: Submission
  groupColor: string
  isOwner: boolean
  onGrade: () => void
  t: TimeT
  locale: string
  onViewImage?: (url: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const displayStatus =
    submission.grade === 'approved'
      ? 'approved'
      : submission.grade === 'needs_revision'
        ? 'needs_revision'
        : submission.status

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ backgroundColor: groupColor }}
        >
          {initials(submission.childName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{submission.childName}</p>
            {submission.age && (
              <span className="text-xs text-gray-400">
                {submission.age} {t('yearsOld')}
              </span>
            )}
            <StatusBadge status={displayStatus} t={t} />
          </div>
          {submission.submittedAt && (
            <p className="text-xs text-gray-400 mt-0.5">
              {t('submittedAt', { time: relativeTime(submission.submittedAt, t, locale) })}
            </p>
          )}
          {(submission.submissionText || submission.fileUrl) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:text-blue-700"
            >
              <FileText className="w-3 h-3" />
              {expanded ? t('hideAnswer') : t('showAnswer')}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {submission.status === 'pending' && !submission.submittedAt && (
            <p className="text-xs text-gray-400 mt-0.5 italic">{t('notSubmitted')}</p>
          )}
        </div>
        {isOwner && submission.status !== 'pending' && (
          <button
            onClick={onGrade}
            className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${submission.grade === 'approved' ? 'bg-green-50 text-green-700 hover:bg-green-100' : submission.grade === 'needs_revision' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-primary-50 text-primary-700 hover:bg-primary-100'}`}
          >
            {submission.grade ? t('change') : t('check')}
          </button>
        )}
      </div>
      {expanded && (submission.submissionText || submission.fileUrl) && (
        <div className="px-4 pb-4 space-y-2">
          {submission.submissionText && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-900 leading-relaxed">
              {submission.submissionText}
            </div>
          )}
          {submission.fileUrl && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden">
              <SubmissionImagePreview
                key={submission.fileUrl}
                fileUrl={submission.fileUrl}
                onViewFullSize={
                  onViewImage ? () => onViewImage(submission.fileUrl!) : () => undefined
                }
                className="max-h-72"
                showLabel={!!onViewImage}
                labelViewFullSize={t('viewFullSize')}
                labelPreviewUnavailable={t('previewUnavailable')}
              />
            </div>
          )}
        </div>
      )}
      {submission.feedback && (
        <div className="px-4 pb-4">
          <div
            className={`rounded-lg p-3 text-xs leading-relaxed border ${submission.grade === 'approved' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}
          >
            <span className="font-semibold">{t('feedbackTitle')} </span>
            {submission.feedback}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MembersTab ────────────────────────────────────────────────────────────────

function MembersTab({
  t,
  parents,
  selectedGroup,
  isOrgAdmin,
  disconnecting,
  onRemove,
  onDisconnect,
}: {
  t: TimeT
  parents: Parent[]
  selectedGroup: Group
  isOrgAdmin: boolean
  disconnecting: string | null
  onRemove: (id: string) => void
  onDisconnect: (id: string) => void
}) {
  if (parents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
          <Users className="w-6 h-6 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">{t('noMembers')}</p>
        <p className="text-xs text-gray-400">{t('addParentsToGroup')}</p>
      </div>
    )
  }
  return (
    <div className="p-4 space-y-3">
      {parents.map((parent) => (
        <div key={parent.parentUserId} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: selectedGroup.color }}
            >
              {initials(parent.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{parent.name}</p>
              {parent.email && <p className="text-xs text-gray-400 truncate">{parent.email}</p>}
              {parent.children.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {parent.children.map((child) => (
                    <span
                      key={child.id}
                      className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full"
                    >
                      {child.name}
                      {child.age ? `, ${child.age}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!selectedGroup.ownerId && (
                <button
                  onClick={() => onRemove(parent.parentUserId)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title={t('removeFromGroup')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {isOrgAdmin && (
                <button
                  onClick={() => onDisconnect(parent.parentUserId)}
                  disabled={disconnecting === parent.parentUserId}
                  className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                  title={t('disconnectFromOrg')}
                >
                  {disconnecting === parent.parentUserId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserMinus className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
