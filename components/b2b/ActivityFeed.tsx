'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  FileText,
  MessageCircle,
  CheckSquare,
  TrendingUp,
  ClipboardList,
  Info,
  Activity,
  Lock,
  Globe,
  Send,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  Reply,
} from 'lucide-react'
import { apiClient, type ActivityFeedItem, type ActivityComment } from '@/lib/b2b/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  orgId: string
  childId: string
  userRole: 'specialist' | 'admin'
}

type FilterType =
  | 'all'
  | 'specialist_note'
  | 'assignment'
  | 'progress_update'
  | 'parent_comment'
  | 'internal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTimestamp(
  iso: string,
  locale: string,
  todayLabel: string,
  yesterdayLabel: string
): string {
  const d = new Date(iso)
  const now = new Date()
  const todayStr = now.toDateString()
  const dateLocale = locale === 'ru' ? 'ru-RU' : locale === 'ky' ? 'ky-KG' : 'en-US'
  const time = d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === todayStr) return `${todayLabel} ${time}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `${yesterdayLabel} ${time}`
  return d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' })
}

function typeIcon(type: ActivityFeedItem['type']): { icon: React.ReactNode; color: string } {
  switch (type) {
    case 'specialist_note':
      return { icon: <FileText className="w-4 h-4" />, color: 'text-teal-600' }
    case 'parent_comment':
      return { icon: <MessageCircle className="w-4 h-4" />, color: 'text-blue-600' }
    case 'assignment_created':
    case 'assignment_completed':
    case 'assignment_reviewed':
      return { icon: <CheckSquare className="w-4 h-4" />, color: 'text-green-600' }
    case 'progress_update':
      return { icon: <TrendingUp className="w-4 h-4" />, color: 'text-purple-600' }
    case 'intake_form_completed':
      return { icon: <ClipboardList className="w-4 h-4" />, color: 'text-orange-600' }
    case 'system_event':
    default:
      return { icon: <Info className="w-4 h-4" />, color: 'text-gray-400' }
  }
}

function roleBadge(role: ActivityFeedItem['authorRole'] | ActivityComment['authorRole']): string {
  switch (role) {
    case 'specialist':
      return 'bg-teal-50 text-teal-700'
    case 'parent':
      return 'bg-blue-50 text-blue-700'
    case 'admin':
    case 'org_admin':
      return 'bg-purple-50 text-purple-700'
    case 'system':
    default:
      return 'bg-gray-50 text-gray-500'
  }
}

function roleLabel(
  role: ActivityFeedItem['authorRole'] | ActivityComment['authorRole'],
  t: ReturnType<typeof useTranslations>
): string {
  switch (role) {
    case 'specialist':
      return t('roleSpecialist')
    case 'parent':
      return t('roleParent')
    case 'admin':
      return t('roleAdmin')
    case 'org_admin':
      return t('roleOrgAdmin')
    case 'system':
      return t('roleSystem')
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3 animate-pulse shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-gray-200 rounded w-40" />
          <div className="h-3 bg-gray-100 rounded w-24" />
        </div>
      </div>
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-3/4" />
    </div>
  )
}

function EmptyState({ onAddNote }: { onAddNote: () => void }) {
  const t = useTranslations('b2b.activityFeed')
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Activity className="w-7 h-7 text-gray-400" />
      </div>
      <p className="text-base font-semibold text-gray-700 mb-1">{t('emptyTitle')}</p>
      <p className="text-sm text-gray-500 max-w-xs mb-5">{t('emptyDescription')}</p>
      <button
        onClick={onAddNote}
        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        <Plus className="w-4 h-4" /> {t('addFirstNote')}
      </button>
    </div>
  )
}

// ── Comment thread ─────────────────────────────────────────────────────────────

interface CommentThreadProps {
  orgId: string
  childId: string
  feedItem: ActivityFeedItem
  userRole: 'specialist' | 'admin'
}

function CommentThread({ orgId, childId, feedItem, userRole: _userRole }: CommentThreadProps) {
  const t = useTranslations('b2b.activityFeed')
  const locale = useLocale()
  const feedItemId = feedItem.id
  const isParentConversation = feedItem.type === 'parent_comment'
  // Items fetched directly from conversations have a synthetic id like conv_…
  // They don't exist in the /feed subcollection, so we can't load/post comments on them.
  // Instead, replies go through the conversation endpoint.
  const isSyntheticConvItem = feedItemId.startsWith('conv_')
  const conversationId = feedItem.metadata?.conversationId as string | undefined

  const [comments, setComments] = useState<ActivityComment[]>([])
  const [loading, setLoading] = useState(!isSyntheticConvItem)
  const [replyText, setReplyText] = useState('')
  // Default visibility: parent_visible when replying to a parent, so they see the response
  const [visibility, setVisibility] = useState<'internal' | 'parent_visible'>('parent_visible')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    if (isSyntheticConvItem) return // no feed subcollection to query
    apiClient
      .listFeedComments(orgId, childId, feedItemId)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }, [orgId, childId, feedItemId, isSyntheticConvItem])

  const handleSend = async () => {
    if (!replyText.trim()) return
    setSending(true)
    setSendError('')
    try {
      if (isSyntheticConvItem && conversationId) {
        // Reply to a conversation message — write to the conversation so parent sees it
        await apiClient.sendConversationReply(conversationId, replyText.trim())
        // Show the reply optimistically
        setComments((prev) => [
          ...prev,
          {
            id: `local_${Date.now()}`,
            feedItemId,
            authorId: '',
            authorRole: 'specialist',
            authorName: t('you'),
            body: replyText.trim(),
            visibility: 'parent_visible',
            createdAt: new Date().toISOString(),
          },
        ])
      } else {
        const comment = await apiClient.addFeedComment(
          orgId,
          childId,
          feedItemId,
          replyText.trim(),
          visibility
        )
        setComments((prev) => [...prev, comment])
      }
      setReplyText('')
    } catch {
      setSendError(t('sendError'))
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 pl-4 space-y-2">
        <div className="h-3 bg-gray-100 rounded w-32 animate-pulse" />
      </div>
    )
  }

  const parentComments = comments.filter((c) => c.authorRole === 'parent')
  const hasParentReplies = parentComments.length > 0

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 pl-4 space-y-3">
      {/* Parent replies banner */}
      {hasParentReplies && (
        <div className="flex items-center gap-1.5 mb-1">
          <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-semibold text-blue-600">
            {t('parentReplied', { count: parentComments.length })}
          </span>
        </div>
      )}

      {comments.map((c) => {
        const isParent = c.authorRole === 'parent'
        return (
          <div
            key={c.id}
            className={`flex gap-2 text-sm rounded-lg p-2 -mx-2 ${
              isParent ? 'bg-blue-50 border border-blue-100' : ''
            }`}
          >
            {/* Role badge */}
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 self-start mt-0.5 ${roleBadge(c.authorRole)}`}
            >
              {roleLabel(c.authorRole, t)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className={`font-medium ${isParent ? 'text-blue-900' : 'text-gray-900'}`}>
                  {c.authorName}
                </span>
                <span className="text-xs text-gray-400">
                  {fmtTimestamp(c.createdAt, locale, t('today'), t('yesterday'))}
                </span>
                {c.visibility === 'internal' && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> {t('internal')}
                  </span>
                )}
              </div>
              <p className={`mt-0.5 ${isParent ? 'text-blue-800 font-medium' : 'text-gray-700'}`}>
                {c.body}
              </p>
            </div>
          </div>
        )
      })}

      {/* Reply input */}
      <div className="space-y-2">
        {isParentConversation && (
          <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
            <Reply className="w-3.5 h-3.5" />
            {t('replyToParentHint')}
          </p>
        )}
        {sendError && <p className="text-xs text-red-500">{sendError}</p>}
        <div className="flex gap-2 items-end">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={
              isParentConversation ? t('replyToParentPlaceholder') : t('replyPlaceholder')
            }
            rows={1}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <button
            onClick={() => setVisibility((v) => (v === 'internal' ? 'parent_visible' : 'internal'))}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              visibility === 'internal'
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-blue-200 bg-blue-50 text-blue-600'
            }`}
            title={visibility === 'internal' ? t('staffOnly') : t('visibleToParent')}
          >
            {visibility === 'internal' ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Globe className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={handleSend}
            disabled={!replyText.trim() || sending}
            className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Feed card ─────────────────────────────────────────────────────────────────

interface FeedCardProps {
  item: ActivityFeedItem
  orgId: string
  childId: string
  userRole: 'specialist' | 'admin'
  onEdited: (updated: ActivityFeedItem) => void
  onDeleted: (id: string) => void
}

function FeedCard({ item, orgId, childId, userRole, onEdited, onDeleted }: FeedCardProps) {
  const t = useTranslations('b2b.activityFeed')
  const locale = useLocale()
  const isParentMessage = item.type === 'parent_comment' || item.authorRole === 'parent'

  // Auto-expand for parent messages and items with parent replies
  const [threadOpen, setThreadOpen] = useState(isParentMessage || (item.hasParentComment ?? false))
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(item.body)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { icon, color } = typeIcon(item.type)

  const commentCount = item.commentCount ?? 0

  const handleSaveEdit = async () => {
    if (!editBody.trim() || editBody === item.body) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await apiClient.updateActivityFeedItem(orgId, childId, item.id, {
        body: editBody.trim(),
      })
      onEdited(updated)
      setEditing(false)
    } catch {
      // noop
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(t('deleteConfirm'))) return
    setDeleting(true)
    try {
      await apiClient.deleteActivityFeedItem(orgId, childId, item.id)
      onDeleted(item.id)
    } catch {
      setDeleting(false)
    }
  }

  // Card border: blue for parent messages, amber for internal, gray default
  const cardBorder = isParentMessage
    ? 'border-l-4 border-l-blue-400 border-blue-100'
    : item.visibility === 'internal'
      ? 'border-amber-200'
      : 'border-gray-100'

  return (
    <div
      className={`bg-white border rounded-xl p-4 shadow-sm transition-opacity ${
        deleting ? 'opacity-40' : ''
      } ${cardBorder}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex-shrink-0 ${color}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-sm font-semibold ${isParentMessage ? 'text-blue-900' : 'text-gray-900'}`}
              >
                {item.authorName}
              </span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleBadge(item.authorRole)}`}
              >
                {roleLabel(item.authorRole, t)}
              </span>
              {item.visibility === 'internal' && (
                <span className="flex items-center gap-0.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5" /> {t('internal')}
                </span>
              )}
              {/* Parent replied badge */}
              {!isParentMessage && (item.hasParentComment ?? false) && (
                <span className="flex items-center gap-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                  <MessageCircle className="w-2.5 h-2.5" /> {t('parentRepliedBadge')}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {fmtTimestamp(item.createdAt, locale, t('today'), t('yesterday'))}
            </span>
          </div>

          {item.title && (
            <p
              className={`text-sm font-medium mt-1 ${isParentMessage ? 'text-blue-800' : 'text-gray-800'}`}
            >
              {item.title}
            </p>
          )}

          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? t('saving') : t('save')}
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setEditBody(item.body)
                  }}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : (
            <p
              className={`text-sm mt-1.5 whitespace-pre-wrap ${isParentMessage ? 'text-blue-800 font-medium' : 'text-gray-700'}`}
            >
              {item.body}
            </p>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => setThreadOpen((o) => !o)}
              className={`flex items-center gap-1 text-xs transition-colors ${
                isParentMessage || (item.hasParentComment ?? false)
                  ? 'text-blue-600 hover:text-blue-700 font-medium'
                  : 'text-gray-500 hover:text-primary-600'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {threadOpen ? t('hide') : isParentMessage ? t('reply') : t('reply')}
              {commentCount > 0 && (
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${
                    (item.hasParentComment ?? false)
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {commentCount}
                </span>
              )}
              {threadOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {(item.authorRole === 'specialist' ||
              item.authorRole === 'admin' ||
              item.authorRole === 'org_admin') &&
              !editing && (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> {t('edit')}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t('delete')}
                  </button>
                </>
              )}
          </div>

          {threadOpen && (
            <CommentThread orgId={orgId} childId={childId} feedItem={item} userRole={userRole} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Filter list ────────────────────────────────────────────────────────────────

const FILTERS: { id: FilterType; labelKey: string }[] = [
  { id: 'all', labelKey: 'filterAll' },
  { id: 'specialist_note', labelKey: 'filterNotes' },
  { id: 'assignment', labelKey: 'filterAssignments' },
  { id: 'progress_update', labelKey: 'filterProgress' },
  { id: 'parent_comment', labelKey: 'filterParentReplies' },
  { id: 'internal', labelKey: 'filterInternal' },
]

function matchesFilter(item: ActivityFeedItem, filter: FilterType): boolean {
  if (filter === 'all') return true
  if (filter === 'internal') return item.visibility === 'internal'
  if (filter === 'assignment')
    return (
      item.type === 'assignment_created' ||
      item.type === 'assignment_completed' ||
      item.type === 'assignment_reviewed'
    )
  if (filter === 'parent_comment')
    return item.type === 'parent_comment' || item.authorRole === 'parent'
  return item.type === filter
}

function isParentActivity(item: ActivityFeedItem): boolean {
  return item.type === 'parent_comment' || item.authorRole === 'parent'
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ActivityFeed({ orgId, childId, userRole }: ActivityFeedProps) {
  const t = useTranslations('b2b.activityFeed')
  const [items, setItems] = useState<ActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [showForm, setShowForm] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [visibility, setVisibility] = useState<'internal' | 'parent_visible'>('parent_visible')
  const [posting, setPosting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.listActivityFeed(orgId, childId)
      setItems(data)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [orgId, childId])

  useEffect(() => {
    load()
  }, [load])

  const handlePost = async () => {
    if (!noteBody.trim()) return
    setPosting(true)
    try {
      const item = await apiClient.createActivityFeedItem(orgId, childId, {
        type: 'specialist_note',
        body: noteBody.trim(),
        visibility,
      })
      setItems((prev) => [item, ...prev])
      setNoteBody('')
      setShowForm(false)
    } catch {
      // noop
    } finally {
      setPosting(false)
    }
  }

  const handleEdited = (updated: ActivityFeedItem) => {
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
  }

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id))
  }

  const filtered = items.filter((x) => matchesFilter(x, activeFilter))
  const unreadParentIds = useMemo(
    () =>
      items
        .filter(
          (x) => isParentActivity(x) && (x.unreadBy?.length ?? 0) > 0 && !x.id.startsWith('conv_')
        )
        .map((x) => x.id),
    [items]
  )
  const unreadParentCount = unreadParentIds.length
  const unreadParentKey = unreadParentIds.join('|')

  useEffect(() => {
    if (activeFilter !== 'parent_comment' || unreadParentIds.length === 0) return

    const ids = [...unreadParentIds]
    apiClient
      .markActivityFeedRead(orgId, childId, ids)
      .then(() => {
        setItems((prev) =>
          prev.map((item) => (ids.includes(item.id) ? { ...item, unreadBy: [] } : item))
        )
      })
      .catch(() => undefined)
  }, [activeFilter, childId, orgId, unreadParentIds, unreadParentKey])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2 flex-1">
          {FILTERS.map((f) => {
            const isParentFilter = f.id === 'parent_comment'
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`relative px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                  activeFilter === f.id
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
                }`}
              >
                {t(f.labelKey)}
                {isParentFilter && unreadParentCount > 0 && (
                  <span
                    className={`ml-1 text-xs font-bold px-1 py-0.5 rounded-full ${
                      activeFilter === f.id
                        ? 'bg-white text-primary-600'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {unreadParentCount}
                  </span>
                )}
                {isParentFilter && unreadParentCount > 0 && activeFilter !== f.id && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setShowForm((o) => !o)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> {t('addNote')}
        </button>
      </div>

      {/* Add note form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">{t('newNote')}</h3>
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder={t('notePlaceholder')}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() =>
                setVisibility((v) => (v === 'internal' ? 'parent_visible' : 'internal'))
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                visibility === 'internal'
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300'
              }`}
            >
              {visibility === 'internal' ? (
                <>
                  <Lock className="w-3.5 h-3.5" /> {t('staffOnly')}
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" /> {t('visibleToParent')}
                </>
              )}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowForm(false)
                  setNoteBody('')
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handlePost}
                disabled={!noteBody.trim() || posting}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {posting ? t('posting') : t('publish')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feed list */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onAddNote={() => setShowForm(true)} />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              orgId={orgId}
              childId={childId}
              userRole={userRole}
              onEdited={handleEdited}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
