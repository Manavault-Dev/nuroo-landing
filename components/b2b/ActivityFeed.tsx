'use client'

import { useState, useEffect, useCallback } from 'react'
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

function fmtTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const todayStr = now.toDateString()
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === todayStr) return `Сегодня ${time}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `Вчера ${time}`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
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

function roleBadge(role: ActivityFeedItem['authorRole']): string {
  switch (role) {
    case 'specialist':
      return 'bg-teal-50 text-teal-700'
    case 'parent':
      return 'bg-blue-50 text-blue-700'
    case 'admin':
      return 'bg-purple-50 text-purple-700'
    case 'system':
    default:
      return 'bg-gray-50 text-gray-500'
  }
}

function roleLabel(role: ActivityFeedItem['authorRole']): string {
  switch (role) {
    case 'specialist':
      return 'Специалист'
    case 'parent':
      return 'Родитель'
    case 'admin':
      return 'Администратор'
    case 'system':
      return 'Система'
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 space-y-3 animate-pulse shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-40" />
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-24" />
        </div>
      </div>
      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full" />
      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
    </div>
  )
}

function EmptyState({ onAddNote }: { onAddNote: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <Activity className="w-7 h-7 text-gray-400" />
      </div>
      <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
        Обновлений пока нет
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-5">
        Заметки специалистов, обновления заданий и ответы родителей будут отображаться здесь.
      </p>
      <button
        onClick={onAddNote}
        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        <Plus className="w-4 h-4" /> Добавить первую заметку
      </button>
    </div>
  )
}

interface CommentThreadProps {
  orgId: string
  childId: string
  feedItemId: string
  userRole: 'specialist' | 'admin'
}

function CommentThread({ orgId, childId, feedItemId, userRole }: CommentThreadProps) {
  const [comments, setComments] = useState<ActivityComment[]>([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [visibility, setVisibility] = useState<'internal' | 'parent_visible'>('parent_visible')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    apiClient
      .listFeedComments(orgId, childId, feedItemId)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }, [orgId, childId, feedItemId])

  const handleSend = async () => {
    if (!replyText.trim()) return
    setSending(true)
    try {
      const comment = await apiClient.addFeedComment(
        orgId,
        childId,
        feedItemId,
        replyText.trim(),
        visibility
      )
      setComments((prev) => [...prev, comment])
      setReplyText('')
    } catch {
      // noop — errors visible from network tab
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 pl-4 space-y-2">
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-32 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 pl-4 space-y-3">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2 text-sm">
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${roleBadge(c.authorRole)}`}
          >
            {roleLabel(c.authorRole)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-medium text-gray-900 dark:text-gray-100">{c.authorName}</span>
              <span className="text-xs text-gray-400">{fmtTimestamp(c.createdAt)}</span>
              {c.visibility === 'internal' && (
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> Внутренний
                </span>
              )}
            </div>
            <p className="text-gray-700 dark:text-gray-300 mt-0.5">{c.body}</p>
          </div>
        </div>
      ))}

      <div className="flex gap-2 items-end pt-1">
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Ответить..."
          rows={1}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
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
              : 'border-gray-200 bg-white dark:bg-gray-800 text-gray-500'
          }`}
          title={visibility === 'internal' ? 'Только для сотрудников' : 'Видно родителю'}
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
  )
}

interface FeedCardProps {
  item: ActivityFeedItem
  orgId: string
  childId: string
  userRole: 'specialist' | 'admin'
  onEdited: (updated: ActivityFeedItem) => void
  onDeleted: (id: string) => void
}

function FeedCard({ item, orgId, childId, userRole, onEdited, onDeleted }: FeedCardProps) {
  const [threadOpen, setThreadOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(item.body)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { icon, color } = typeIcon(item.type)

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
    if (!window.confirm('Удалить эту запись?')) return
    setDeleting(true)
    try {
      await apiClient.deleteActivityFeedItem(orgId, childId, item.id)
      onDeleted(item.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div
      className={`bg-white dark:bg-gray-900 border rounded-xl p-4 shadow-sm transition-opacity ${
        deleting ? 'opacity-40' : ''
      } ${
        item.visibility === 'internal'
          ? 'border-amber-200 dark:border-amber-800'
          : 'border-gray-100 dark:border-gray-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex-shrink-0 ${color}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {item.authorName}
              </span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleBadge(item.authorRole)}`}
              >
                {roleLabel(item.authorRole)}
              </span>
              {item.visibility === 'internal' && (
                <span className="flex items-center gap-0.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5" /> Внутренний
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {fmtTimestamp(item.createdAt)}
            </span>
          </div>

          {item.title && (
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">
              {item.title}
            </p>
          )}

          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setEditBody(item.body)
                  }}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1.5 whitespace-pre-wrap">
              {item.body}
            </p>
          )}

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => setThreadOpen((o) => !o)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {threadOpen ? 'Скрыть' : 'Ответить'}
              {threadOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {(item.authorRole === 'specialist' || item.authorRole === 'admin') && !editing && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Изменить
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Удалить
                </button>
              </>
            )}
          </div>

          {threadOpen && (
            <CommentThread
              orgId={orgId}
              childId={childId}
              feedItemId={item.id}
              userRole={userRole}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Filter chip labels ─────────────────────────────────────────────────────────

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'specialist_note', label: 'Заметки' },
  { id: 'assignment', label: 'Задания' },
  { id: 'progress_update', label: 'Прогресс' },
  { id: 'parent_comment', label: 'Ответы родителей' },
  { id: 'internal', label: 'Только внутренние' },
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
  return item.type === filter
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ActivityFeed({ orgId, childId, userRole }: ActivityFeedProps) {
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2 flex-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                activeFilter === f.id
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm((o) => !o)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Добавить заметку
        </button>
      </div>

      {/* Add note form */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Новая заметка</h3>
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Запишите наблюдение, итог сессии или важную информацию..."
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-900 dark:text-gray-100"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() =>
                setVisibility((v) => (v === 'internal' ? 'parent_visible' : 'internal'))
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                visibility === 'internal'
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-gray-200 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              {visibility === 'internal' ? (
                <>
                  <Lock className="w-3.5 h-3.5" /> Только для сотрудников
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" /> Видно родителю
                </>
              )}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowForm(false)
                  setNoteBody('')
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handlePost}
                disabled={!noteBody.trim() || posting}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {posting ? 'Публикация...' : 'Опубликовать'}
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
