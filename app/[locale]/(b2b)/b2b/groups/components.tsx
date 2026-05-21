import { useEffect, useState, type MouseEvent } from 'react'
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  UserCircle,
  ClipboardList,
  Loader2,
  UserMinus,
  ChevronRight,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  FileText,
  Expand,
  ImageIcon,
} from 'lucide-react'

import type { Assignment, Group, Parent, Submission, TimeT } from './types'
import { formatDate, initials, pluralChildren, relativeTime } from './utils'

export function StatusBadge({
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

export function GroupCard({
  group,
  t,
  locale,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  onAssign,
  canManage,
}: {
  group: Group
  t: TimeT
  locale: string
  isSelected: boolean
  onClick: () => void
  onEdit: (e: MouseEvent) => void
  onDelete: (e: MouseEvent) => void
  onAssign?: (e: MouseEvent) => void
  canManage: boolean
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
          {canManage && (
            <div className="flex items-center gap-0.5 opacity-100 transition-opacity shrink-0 sm:opacity-0 sm:group-hover:opacity-100">
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5" />
            <span>{t('parentCount', { count: group.parentCount })}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {canManage && onAssign && (
              <button
                onClick={onAssign}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
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

export function AssignmentsTab({
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
            <div className="flex items-center gap-1.5 flex-wrap">
              {a.contentRoadmapIds.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 shrink-0">
                  <BookOpen className="w-3 h-3" />
                  {t('program')}
                </span>
              )}
              <p
                className={`text-sm font-semibold truncate ${selectedId === a.id ? 'text-primary-800' : 'text-gray-800'}`}
              >
                {a.title}
              </p>
            </div>
            {a.taskTitles.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {a.taskTitles.slice(0, 3).join(' · ')}
                {a.taskTitles.length > 3 && ` +${a.taskTitles.length - 3}`}
              </p>
            )}
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

function proxyUrl(url: string): string {
  return `/api/media?url=${encodeURIComponent(url)}`
}

export function SubmissionImagePreview({
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

export function SubmissionCard({
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

export function Lightbox({
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

export function MembersTab({
  t,
  parents,
  selectedGroup,
  isOrgAdmin,
  canManage,
  disconnecting,
  onRemove,
  onDisconnect,
}: {
  t: TimeT
  parents: Parent[]
  selectedGroup: Group
  isOrgAdmin: boolean
  canManage: boolean
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
              {canManage && (
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
