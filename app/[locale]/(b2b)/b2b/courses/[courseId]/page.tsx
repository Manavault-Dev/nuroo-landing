'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'
import {
  ArrowLeft,
  Loader2,
  Users,
  Calendar,
  Video,
  MapPin,
  Plus,
  Check,
  X,
  AlertCircle,
  Save,
  ExternalLink,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

// ─── Types ────────────────────────────────────────────────────────────────────

type CohortStatus = 'draft' | 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled'
type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'postponed'
type PaymentStatus = 'paid' | 'partial' | 'pending'

interface Cohort {
  id: string
  title: string
  description: string
  format: 'online' | 'offline'
  status: CohortStatus
  startDate: string
  endDate: string
  price: number
  currency: string
  maxParticipants: number
  enrolledCount: number
  instructorName: string | null
  category: string | null
  ageMin: number | null
  ageMax: number | null
  scheduleType: 'manual' | 'recurring'
}

interface Session {
  id: string
  date: string
  startTime: string
  endTime: string
  format: 'online' | 'offline'
  status: SessionStatus
  topic: string | null
  meetingUrl: string | null
  notes: string | null
}

interface Participant {
  id: string
  childId: string
  childName: string
  parentName: string
  parentPhone: string | null
  status: 'active' | 'dropped' | 'completed'
  paymentStatus: PaymentStatus
  amountPaid: number
  totalAmount: number
  currency: string
  enrolledAt: string
}

type AttendanceRecord = Record<string, 'present' | 'absent' | 'late'>

// ─── Status configs ───────────────────────────────────────────────────────────

const SESSION_STATUS: Record<SessionStatus, { dot: string; badge: string; label: string }> = {
  scheduled: { dot: 'bg-blue-400', badge: 'bg-blue-100 text-blue-700', label: 'Запланировано' },
  completed: {
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700',
    label: 'Проведено',
  },
  cancelled: { dot: 'bg-gray-300', badge: 'bg-gray-100 text-gray-500', label: 'Отменено' },
  postponed: { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', label: 'Перенесено' },
}

const PAYMENT_STYLE: Record<PaymentStatus, { bg: string; label: string }> = {
  paid: { bg: 'bg-emerald-100 text-emerald-700', label: 'Оплачено' },
  partial: { bg: 'bg-amber-100 text-amber-700', label: 'Частично' },
  pending: { bg: 'bg-gray-100 text-gray-600', label: 'Ожидает' },
}

const COHORT_STATUS: Record<CohortStatus, { bg: string; label: string }> = {
  draft: { bg: 'bg-gray-100 text-gray-500', label: 'Черновик' },
  open: { bg: 'bg-emerald-100 text-emerald-700', label: 'Набор открыт' },
  full: { bg: 'bg-amber-100 text-amber-700', label: 'Мест нет' },
  in_progress: { bg: 'bg-blue-100 text-blue-700', label: 'Идут занятия' },
  completed: { bg: 'bg-gray-100 text-gray-600', label: 'Завершён' },
  cancelled: { bg: 'bg-red-100 text-red-600', label: 'Отменён' },
}

// ─── Attendance Modal ─────────────────────────────────────────────────────────

function AttendanceModal({
  session,
  participants,
  orgId,
  cohortId,
  onClose,
  onSaved,
}: {
  session: Session
  participants: Participant[]
  orgId: string
  cohortId: string
  onClose: () => void
  onSaved: (sessionId: string) => void
}) {
  const activeParticipants = participants.filter((p) => p.status === 'active')
  const [records, setRecords] = useState<AttendanceRecord>(() =>
    Object.fromEntries(activeParticipants.map((p) => [p.childId, 'present' as const]))
  )
  const [saving, setSaving] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(true)

  useEffect(() => {
    apiClient
      .getCohortAttendance(orgId, cohortId, session.id)
      .then((res) => {
        if (res.attendance.length > 0) {
          const loaded: AttendanceRecord = {}
          for (const r of res.attendance) loaded[r.childId] = r.status
          setRecords((prev) => ({ ...prev, ...loaded }))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false))
  }, [orgId, cohortId, session.id])

  const toggle = (childId: string) => {
    setRecords((prev) => {
      const cur = prev[childId]
      return {
        ...prev,
        [childId]: cur === 'present' ? 'absent' : cur === 'absent' ? 'late' : 'present',
      }
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      await apiClient.saveCohortAttendance(
        orgId,
        cohortId,
        session.id,
        Object.entries(records).map(([childId, status]) => ({ childId, status }))
      )
      onSaved(session.id)
      onClose()
    } catch {
      alert('Не удалось сохранить посещаемость')
    } finally {
      setSaving(false)
    }
  }

  const AttendanceIcon = ({ status }: { status: 'present' | 'absent' | 'late' }) => {
    if (status === 'present') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />
    if (status === 'absent') return <XCircle className="w-5 h-5 text-red-400" />
    return <MinusCircle className="w-5 h-5 text-amber-400" />
  }

  const statusLabel = { present: 'Присутствовал', absent: 'Отсутствовал', late: 'Опоздал' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Посещаемость</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {session.date} · {session.startTime}–{session.endTime}
          </p>
        </div>
        {loadingExisting ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : activeParticipants.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">Нет активных участников</div>
        ) : (
          <div className="overflow-y-auto flex-1 p-4 space-y-2">
            {activeParticipants.map((p) => {
              const st = records[p.childId] ?? 'present'
              return (
                <button
                  key={p.childId}
                  onClick={() => toggle(p.childId)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
                >
                  <AttendanceIcon status={st} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.childName}</p>
                    {p.parentName && (
                      <p className="text-xs text-gray-400 truncate">{p.parentName}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{statusLabel[st]}</span>
                </button>
              )
            })}
          </div>
        )}
        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={save}
            disabled={saving || activeParticipants.length === 0}
            className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Session Modal ────────────────────────────────────────────────────────

function AddSessionModal({
  orgId,
  cohortId,
  defaultFormat,
  onClose,
  onAdded,
}: {
  orgId: string
  cohortId: string
  defaultFormat: 'online' | 'offline'
  onClose: () => void
  onAdded: (session: Session) => void
}) {
  const [form, setForm] = useState({
    date: '',
    startTime: '09:00',
    endTime: '10:00',
    topic: '',
    meetingUrl: '',
    format: defaultFormat,
  })
  const [saving, setSaving] = useState(false)

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const save = async () => {
    if (!form.date) return
    setSaving(true)
    try {
      const res = await apiClient.createCohortSession(orgId, cohortId, {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        topic: form.topic || null,
        meetingUrl: form.meetingUrl || null,
        format: form.format,
      })
      onAdded(res.session)
      onClose()
    } catch {
      alert('Не удалось добавить занятие')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-bold text-gray-900 mb-4">Добавить занятие</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Дата *</label>
            <input
              type="date"
              value={form.date}
              onChange={f('date')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Начало</label>
              <input
                type="time"
                value={form.startTime}
                onChange={f('startTime')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Конец</label>
              <input
                type="time"
                value={form.endTime}
                onChange={f('endTime')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Тема (необязательно)
            </label>
            <input
              type="text"
              value={form.topic}
              onChange={f('topic')}
              placeholder="Тема занятия"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Ссылка на встречу (Zoom / Google Meet)
            </label>
            <input
              type="url"
              value={form.meetingUrl}
              onChange={f('meetingUrl')}
              placeholder="https://meet.google.com/..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={save}
            disabled={!form.date || saving}
            className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────

function SessionsTab({
  sessions,
  participants,
  orgId,
  cohortId,
  isAdmin,
  cohortFormat,
  onSessionsChange,
}: {
  sessions: Session[]
  participants: Participant[]
  orgId: string
  cohortId: string
  isAdmin: boolean
  cohortFormat: 'online' | 'offline'
  onSessionsChange: (s: Session[]) => void
}) {
  const [attendanceModal, setAttendanceModal] = useState<Session | null>(null)
  const [addModal, setAddModal] = useState(false)
  const [cancelModal, setCancelModal] = useState<Session | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const handleCancelSession = async () => {
    if (!cancelModal) return
    setCancelling(true)
    try {
      await apiClient.deleteCohortSession(orgId, cohortId, cancelModal.id)
      onSessionsChange(
        sessions.map((s) => (s.id === cancelModal.id ? { ...s, status: 'cancelled' as const } : s))
      )
      setCancelModal(null)
    } catch {
      alert('Не удалось отменить занятие')
    } finally {
      setCancelling(false)
    }
  }

  const sorted = [...sessions].sort((a, b) => {
    const d = a.date.localeCompare(b.date)
    return d !== 0 ? d : a.startTime.localeCompare(b.startTime)
  })

  return (
    <div className="space-y-3">
      {isAdmin && (
        <button
          onClick={() => setAddModal(true)}
          className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <Plus className="w-4 h-4" />
          Добавить занятие
        </button>
      )}

      {sorted.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Занятия ещё не добавлены</p>
          {isAdmin && <p className="text-gray-400 text-xs mt-1">Нажмите «Добавить занятие» выше</p>}
        </div>
      ) : (
        sorted.map((s) => {
          const st = SESSION_STATUS[s.status]
          const isExpanded = expanded === s.id
          return (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(isExpanded ? null : s.id)}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${st.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{s.date}</span>
                    <span className="text-sm text-gray-500">
                      {s.startTime}–{s.endTime}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.badge}`}>
                      {st.label}
                    </span>
                  </div>
                  {s.topic && <p className="text-sm text-gray-600 mt-0.5 truncate">{s.topic}</p>}
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2">
                  {s.meetingUrl && (
                    <a
                      href={s.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ссылка на встречу
                    </a>
                  )}
                  {s.notes && <p className="text-sm text-gray-600">{s.notes}</p>}
                  {isAdmin && s.status !== 'cancelled' && (
                    <div className="flex gap-2 flex-wrap pt-1">
                      {participants.filter((p) => p.status === 'active').length > 0 && (
                        <button
                          onClick={() => setAttendanceModal(s)}
                          className="flex items-center gap-1.5 text-xs text-primary-600 border border-primary-200 rounded-lg px-3 py-1.5 hover:bg-primary-50 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Отметить посещаемость
                        </button>
                      )}
                      <button
                        onClick={() => setCancelModal(s)}
                        className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Отменить
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}

      {addModal && (
        <AddSessionModal
          orgId={orgId}
          cohortId={cohortId}
          defaultFormat={cohortFormat}
          onClose={() => setAddModal(false)}
          onAdded={(s) => {
            onSessionsChange([...sessions, s])
            setAddModal(false)
          }}
        />
      )}

      {attendanceModal && (
        <AttendanceModal
          session={attendanceModal}
          participants={participants}
          orgId={orgId}
          cohortId={cohortId}
          onClose={() => setAttendanceModal(null)}
          onSaved={(sessionId) => {
            onSessionsChange(
              sessions.map((s) => (s.id === sessionId ? { ...s, status: 'completed' as const } : s))
            )
            setAttendanceModal(null)
          }}
        />
      )}

      {cancelModal && (
        <ConfirmModal
          title="Отменить занятие?"
          subtitle={`${cancelModal.date} · ${cancelModal.startTime}–${cancelModal.endTime}`}
          description="Занятие будет отмечено как отменённое."
          confirmLabel="Отменить занятие"
          cancelLabel="Назад"
          loading={cancelling}
          onConfirm={handleCancelSession}
          onCancel={() => setCancelModal(null)}
        />
      )}
    </div>
  )
}

// ─── Participants Tab ─────────────────────────────────────────────────────────

function ParticipantsTab({
  participants,
  orgId,
  cohortId,
  isAdmin,
  cohort,
  onParticipantsChange,
}: {
  participants: Participant[]
  orgId: string
  cohortId: string
  isAdmin: boolean
  cohort: Cohort
  onParticipantsChange: (p: Participant[]) => void
}) {
  const [saving, setSaving] = useState<string | null>(null)

  const updatePayment = async (p: Participant, status: PaymentStatus) => {
    setSaving(p.id)
    try {
      await apiClient.updateCohortParticipant(orgId, cohortId, p.id, {
        paymentStatus: status,
        amountPaid: status === 'paid' ? p.totalAmount : p.amountPaid,
      })
      onParticipantsChange(
        participants.map((x) =>
          x.id === p.id
            ? {
                ...x,
                paymentStatus: status,
                amountPaid: status === 'paid' ? x.totalAmount : x.amountPaid,
              }
            : x
        )
      )
    } catch {
      alert('Не удалось обновить статус оплаты')
    } finally {
      setSaving(null)
    }
  }

  if (participants.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
        <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Участников пока нет</p>
        <p className="text-gray-400 text-xs mt-1">Родители записываются через каталог курсов</p>
      </div>
    )
  }

  const active = participants.filter((p) => p.status === 'active')
  const dropped = participants.filter((p) => p.status !== 'active')
  const paidCount = participants.filter((p) => p.paymentStatus === 'paid').length
  const pendingCount = participants.filter((p) => p.paymentStatus === 'pending').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">
          {active.length} из {cohort.maxParticipants} мест занято
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
            {paidCount} оплатили
          </span>
          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            {pendingCount} ожидают
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {active.map((p) => {
          const py = PAYMENT_STYLE[p.paymentStatus]
          return (
            <div
              key={p.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold shrink-0">
                {p.childName[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{p.childName}</p>
                <p className="text-xs text-gray-500 truncate">
                  {p.parentName || 'Родитель не указан'}
                  {p.parentPhone && ` · ${p.parentPhone}`}
                </p>
              </div>
              {isAdmin ? (
                <div className="flex items-center gap-2 shrink-0">
                  {saving === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <select
                      value={p.paymentStatus}
                      onChange={(e) => updatePayment(p, e.target.value as PaymentStatus)}
                      className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${py.bg}`}
                    >
                      <option value="paid">Оплачено</option>
                      <option value="partial">Частично</option>
                      <option value="pending">Ожидает</option>
                    </select>
                  )}
                  {cohort.price > 0 && (
                    <span className="text-sm font-medium text-gray-700 shrink-0">
                      {p.amountPaid.toLocaleString()} / {p.totalAmount.toLocaleString()}{' '}
                      {p.currency}
                    </span>
                  )}
                </div>
              ) : (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${py.bg}`}>
                  {py.label}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {dropped.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Выбыли</p>
          <div className="space-y-2 opacity-60">
            {dropped.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-sm font-bold shrink-0">
                  {p.childName[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-600 truncate">{p.childName}</p>
                  <p className="text-xs text-gray-400 truncate">{p.parentName}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {p.status === 'dropped' ? 'Выбыл' : 'Завершил'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'sessions' | 'participants'

export default function CohortDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const cohortId = params.courseId as string
  const orgId = searchParams.get('orgId') ?? ''

  const { isAdmin, isLoading: authLoading } = usePageAuth()
  const [cohort, setCohort] = useState<Cohort | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('sessions')
  const [statusChanging, setStatusChanging] = useState(false)

  const load = useCallback(async () => {
    if (!orgId || !cohortId) return
    setLoading(true)
    try {
      const [cohortRes, sessionsRes, participantsRes] = await Promise.all([
        apiClient.getCohort(orgId, cohortId),
        apiClient.getCohortSessions(orgId, cohortId),
        apiClient.getCohortParticipants(orgId, cohortId),
      ])
      setCohort(cohortRes.cohort)
      setSessions(sessionsRes.sessions)
      setParticipants(participantsRes.participants)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [orgId, cohortId])

  useEffect(() => {
    if (!authLoading) load()
  }, [authLoading, load])

  const setStatus = async (status: CohortStatus) => {
    if (!cohort) return
    setStatusChanging(true)
    try {
      const res = await apiClient.updateCohort(orgId, cohortId, { status })
      setCohort(res.cohort)
    } catch {
      alert('Не удалось обновить статус')
    } finally {
      setStatusChanging(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error || !cohort) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{error ?? 'Набор не найден'}</p>
        </div>
      </div>
    )
  }

  const st = COHORT_STATUS[cohort.status]
  const upcomingSessions = sessions.filter((s) => s.status === 'scheduled').length
  const completedSessions = sessions.filter((s) => s.status === 'completed').length

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back */}
      <Link
        href={`/b2b/courses${orgId ? `?orgId=${orgId}` : ''}`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Все группы
      </Link>

      {/* Cohort Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${st.bg}`}>
                {st.label}
              </span>
              {cohort.format === 'online' ? (
                <span className="flex items-center gap-1 text-xs text-blue-600">
                  <Video className="w-3.5 h-3.5" /> Онлайн
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="w-3.5 h-3.5" /> Офлайн
                </span>
              )}
              {cohort.category && (
                <span className="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
                  {cohort.category}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{cohort.title}</h1>
            {cohort.instructorName && (
              <p className="text-sm text-gray-500 mt-0.5">{cohort.instructorName}</p>
            )}
            {cohort.description && (
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{cohort.description}</p>
            )}
          </div>

          {isAdmin && !['cancelled', 'completed'].includes(cohort.status) && (
            <div className="flex gap-2 flex-wrap shrink-0">
              {cohort.status === 'draft' && (
                <button
                  onClick={() => setStatus('open')}
                  disabled={statusChanging}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {statusChanging ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Открыть набор
                </button>
              )}
              {cohort.status === 'open' && (
                <button
                  onClick={() => setStatus('draft')}
                  disabled={statusChanging}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Приостановить
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{cohort.enrolledCount}</p>
            <p className="text-xs text-gray-500">Участников</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{cohort.maxParticipants}</p>
            <p className="text-xs text-gray-500">Мест всего</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{completedSessions}</p>
            <p className="text-xs text-gray-500">Проведено</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{upcomingSessions}</p>
            <p className="text-xs text-gray-500">Предстоит</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {cohort.startDate} — {cohort.endDate}
          </span>
          {cohort.price > 0 && (
            <span className="font-semibold text-gray-700">
              {cohort.price.toLocaleString()} {cohort.currency}
            </span>
          )}
          {cohort.ageMin != null && (
            <span>
              Возраст: {cohort.ageMin}–{cohort.ageMax ?? '∞'} лет
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5 gap-1">
        {(
          [
            {
              key: 'sessions',
              label: 'Занятия',
              icon: Calendar,
              count: sessions.filter((s) => s.status !== 'cancelled').length,
            },
            {
              key: 'participants',
              label: 'Участники',
              icon: Users,
              count: participants.filter((p) => p.status === 'active').length,
            },
          ] as const
        ).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'sessions' ? (
        <SessionsTab
          sessions={sessions}
          participants={participants}
          orgId={orgId}
          cohortId={cohortId}
          isAdmin={isAdmin}
          cohortFormat={cohort.format}
          onSessionsChange={setSessions}
        />
      ) : (
        <ParticipantsTab
          participants={participants}
          orgId={orgId}
          cohortId={cohortId}
          isAdmin={isAdmin}
          cohort={cohort}
          onParticipantsChange={setParticipants}
        />
      )}
    </div>
  )
}
